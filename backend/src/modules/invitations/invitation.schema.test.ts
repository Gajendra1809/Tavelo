import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inviteSchema } from './invitation.schema';

describe('inviteSchema', () => {
  it('normalizes an email and ignores identity fields', () => {
    const parsed = inviteSchema.parse({
      email: '  Friend@Example.com ',
      userId: '507f1f77bcf86cd799439011',
      status: 'accepted',
    });

    assert.equal(parsed.email, 'friend@example.com');
    assert.equal('userId' in parsed, false);
    assert.equal('status' in parsed, false);
  });

  it('rejects an email that is not an address', () => {
    assert.equal(inviteSchema.safeParse({ email: 'not-an-email' }).success, false);
  });
});
