import mongoose from 'mongoose';
import { UserModel } from '../auth/user.model';
import { loadUserSummaries, publicUserFromDocument } from '../users/user.service';
import { TripModel } from '../trips/trip.model';
import { AppError } from '../../utils/AppError';
import { loadActorName, notifyTripInvitation } from '../notifications/notification.service';
import { InvitationModel } from './invitation.model';
import type { InviteInput } from './invitation.schema';

export type SentInvitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  respondedAt: string | null;
  invitee: { id: string; name: string; email: string; username: string | null };
};

export type ReceivedInvitation = {
  id: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  trip: { id: string; name: string; destination: string };
  inviter: { id: string; name: string; avatarUrl: string | null };
};

export async function inviteToTrip(
  ownerId: string,
  tripId: string,
  input: InviteInput,
): Promise<SentInvitation> {
  assertDatabaseConnected();
  const trip = await findOwnedTrip(ownerId, tripId);
  const invitee = input.userId
    ? await UserModel.findById(input.userId).select('name email username')
    : await UserModel.findOne({ email: input.email }).select('name email username');
  if (!invitee) {
    throw new AppError(
      404,
      'NOT_FOUND',
      input.userId ? 'User not found.' : 'No account uses that email.',
    );
  }

  const inviteeId = invitee._id.toString();
  if (inviteeId === ownerId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'You cannot invite yourself.');
  }
  if ((trip.members ?? []).some((member) => member.userId.toString() === inviteeId)) {
    throw new AppError(409, 'CONFLICT', 'That person is already on this trip.');
  }

  try {
    const invitation = await InvitationModel.create({
      tripId: trip._id,
      inviterId: ownerId,
      inviteeId: invitee._id,
      status: 'pending',
    });
    await notifyTripInvitation({
      inviteeId,
      actorId: ownerId,
      invitationId: invitation._id.toString(),
      tripId: trip._id.toString(),
      tripName: trip.name,
      actorName: await loadActorName(ownerId),
    });
    return {
      id: invitation._id.toString(),
      status: 'pending',
      createdAt: invitation.createdAt.toISOString(),
      respondedAt: null,
      invitee: {
        id: inviteeId,
        name: invitee.name,
        email: invitee.email,
        username: invitee.username ?? null,
      },
    };
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new AppError(409, 'CONFLICT', 'An invitation is already waiting for that person.');
    }
    throw error;
  }
}

export async function listSentInvitations(ownerId: string, tripId: string): Promise<SentInvitation[]> {
  await findOwnedTrip(ownerId, tripId);
  const invitations = await InvitationModel.find({ tripId }).sort({ createdAt: -1 });
  const invitees = await UserModel.find({
    _id: { $in: invitations.map((invitation) => invitation.inviteeId) },
  }).select('name email username');
  const byId = new Map(invitees.map((user) => [user._id.toString(), user]));

  return invitations.flatMap((invitation) => {
    const invitee = byId.get(invitation.inviteeId.toString());
    if (!invitee) {
      return [];
    }
    return [
      {
        id: invitation._id.toString(),
        status: invitation.status,
        createdAt: invitation.createdAt.toISOString(),
        respondedAt: invitation.respondedAt ? invitation.respondedAt.toISOString() : null,
        invitee: {
          id: invitee._id.toString(),
          name: invitee.name,
          email: invitee.email,
          username: invitee.username ?? null,
        },
      },
    ];
  });
}

export async function listReceivedInvitations(userId: string): Promise<ReceivedInvitation[]> {
  assertDatabaseConnected();
  const invitations = await InvitationModel.find({ inviteeId: userId, status: 'pending' }).sort({
    createdAt: -1,
  });
  if (invitations.length === 0) {
    return [];
  }

  const trips = await TripModel.find({
    _id: { $in: invitations.map((invitation) => invitation.tripId) },
  }).select('name destination');
  const inviterProfiles = await loadUserSummaries(
    invitations.map((invitation) => invitation.inviterId.toString()),
  );
  const tripById = new Map(trips.map((trip) => [trip._id.toString(), trip]));

  return invitations.flatMap((invitation) => {
    const trip = tripById.get(invitation.tripId.toString());
    if (!trip) {
      return [];
    }
    return [
      {
        id: invitation._id.toString(),
        status: 'pending' as const,
        createdAt: invitation.createdAt.toISOString(),
        trip: { id: trip._id.toString(), name: trip.name, destination: trip.destination },
        inviter: {
          id: invitation.inviterId.toString(),
          name: inviterProfiles.get(invitation.inviterId.toString())?.name ?? 'Traveler',
          avatarUrl: inviterProfiles.get(invitation.inviterId.toString())?.avatarUrl ?? null,
        },
      },
    ];
  });
}

export async function acceptInvitation(userId: string, invitationId: string): Promise<ReceivedInvitation> {
  const invitation = await claimResponse(userId, invitationId, 'accepted');
  const added = await TripModel.updateOne(
    { _id: invitation.tripId, 'members.userId': { $ne: userId } },
    { $push: { members: { userId, role: 'member' } } },
  );
  if (added.matchedCount === 0) {
    const tripStillExists = await TripModel.exists({ _id: invitation.tripId });
    if (!tripStillExists) {
      await InvitationModel.updateOne(
        { _id: invitation._id, inviteeId: userId, status: 'accepted' },
        { $set: { status: 'pending', respondedAt: null } },
      );
      throw new AppError(404, 'NOT_FOUND', 'This invitation is no longer available.');
    }
  }
  return toReceived(invitation);
}

export async function declineInvitation(userId: string, invitationId: string): Promise<ReceivedInvitation> {
  const invitation = await claimResponse(userId, invitationId, 'declined');
  return toReceived(invitation);
}

export async function cancelInvitation(
  ownerId: string,
  tripId: string,
  invitationId: string,
): Promise<void> {
  await findOwnedTrip(ownerId, tripId);
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }
  const removed = await InvitationModel.findOneAndDelete({
    _id: invitationId,
    tripId,
    status: 'pending',
  });
  if (!removed) {
    const existing = await InvitationModel.findOne({ _id: invitationId, tripId }).select('status');
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
    }
    throw new AppError(409, 'CONFLICT', 'This invitation has already been answered.');
  }
}

export async function removeMember(ownerId: string, tripId: string, memberId: string): Promise<void> {
  const trip = await findOwnedTrip(ownerId, tripId);
  if (!mongoose.isValidObjectId(memberId)) {
    throw new AppError(404, 'NOT_FOUND', 'That person is not on this trip.');
  }
  if (memberId === trip.ownerId.toString()) {
    throw new AppError(403, 'FORBIDDEN', 'The trip creator cannot be removed.');
  }

  const removed = await TripModel.updateOne(
    { _id: trip._id, ownerId },
    { $pull: { members: { userId: memberId, role: 'member' } } },
  );
  if (removed.modifiedCount === 0) {
    throw new AppError(404, 'NOT_FOUND', 'That person is not on this trip.');
  }
}

export async function deleteInvitationsForTrip(tripId: mongoose.Types.ObjectId): Promise<void> {
  await InvitationModel.deleteMany({ tripId });
}

async function claimResponse(userId: string, invitationId: string, status: 'accepted' | 'declined') {
  assertDatabaseConnected();
  if (!mongoose.isValidObjectId(invitationId)) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }

  const existing = await InvitationModel.findById(invitationId);
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Invitation not found.');
  }
  if (existing.inviteeId.toString() !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot respond to this invitation.');
  }
  if (existing.status !== 'pending') {
    throw new AppError(409, 'CONFLICT', 'This invitation has already been answered.');
  }

  const trip = await TripModel.findById(existing.tripId).select('name destination');
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'This invitation is no longer available.');
  }

  const updated = await InvitationModel.findOneAndUpdate(
    { _id: existing._id, inviteeId: userId, status: 'pending' },
    { $set: { status, respondedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!updated) {
    throw new AppError(409, 'CONFLICT', 'This invitation has already been answered.');
  }

  return Object.assign(updated, {
    tripName: trip.name,
    tripDestination: trip.destination,
  });
}

async function toReceived(invitation: {
  _id: { toString(): string };
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  tripId: { toString(): string };
  inviterId: { toString(): string };
  tripName?: string;
  tripDestination?: string;
}): Promise<ReceivedInvitation> {
  const trip =
    invitation.tripName && invitation.tripDestination
      ? { name: invitation.tripName, destination: invitation.tripDestination }
      : await TripModel.findById(invitation.tripId).select('name destination');
  const inviterDoc = await UserModel.findById(invitation.inviterId).select('name email avatarObjectKey');
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'This invitation is no longer available.');
  }
  const inviterPublic = inviterDoc ? await publicUserFromDocument(inviterDoc) : null;
  return {
    id: invitation._id.toString(),
    status: invitation.status,
    createdAt: invitation.createdAt.toISOString(),
    trip: {
      id: invitation.tripId.toString(),
      name: trip.name,
      destination: trip.destination,
    },
    inviter: {
      id: invitation.inviterId.toString(),
      name: inviterPublic?.name ?? 'Traveler',
      avatarUrl: inviterPublic?.avatarUrl ?? null,
    },
  };
}

async function findOwnedTrip(ownerId: string, tripId: string) {
  assertDatabaseConnected();
  if (!mongoose.isValidObjectId(tripId)) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
  const trip = await TripModel.findById(tripId);
  if (!trip) {
    throw new AppError(404, 'NOT_FOUND', 'Trip not found.');
  }
  const isOwner = trip.ownerId?.toString() === ownerId;
  const isMember = (trip.members ?? []).some((member) => member.userId.toString() === ownerId);
  if (!isOwner && !isMember) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have access to this trip.');
  }
  if (!isOwner) {
    throw new AppError(403, 'FORBIDDEN', 'Only the trip creator can change this trip.');
  }
  return trip;
}

function assertDatabaseConnected(): void {
  if (mongoose.connection.readyState !== 1) {
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'The database is unavailable. Try again in a moment.',
    );
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 11000
  );
}
