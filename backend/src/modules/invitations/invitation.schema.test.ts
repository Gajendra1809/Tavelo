import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inviteSchema } from './invitation.schema';

describe('inviteSchema', () => {
  it('normalizes an email invite', () => {
    const parsed = inviteSchema.parse({
      email: '  Friend@Example.com ',
    });

    assert.equal(parsed.email, 'friend@example.com');
  });

  it('accepts userId invites', () => {
    const parsed = inviteSchema.parse({
      userId: '507f1f77bcf86cd799439011',
    });
    assert.equal(parsed.userId, '507f1f77bcf86cd799439011');
  });

  it('rejects an email that is not an address', () => {
    assert.equal(inviteSchema.safeParse({ email: 'not-an-email' }).success, false);
  });

  it('rejects both email and userId', () => {
    assert.equal(
      inviteSchema.safeParse({ email: 'a@b.com', userId: '507f1f77bcf86cd799439011' }).success,
      false,
    );
  });
});
