export type TripMember = {
  userId: string;
  role: 'owner' | 'member';
  name: string;
};

export type Trip = {
  id: string;
  name: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImageUrl: string | null;
  creatorId: string | null;
  creator: { id: string; name: string } | null;
  members: TripMember[];
  createdAt: string;
  updatedAt: string;
};

export type CreateTripInput = {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
};

export type UpdateTripInput = {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  coverImageUrl?: string | null;
};
