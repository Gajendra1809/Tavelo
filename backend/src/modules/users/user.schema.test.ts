import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { updateProfileSchema } from './user.schema';

describe('updateProfileSchema', () => {
  it('accepts partial profile updates', () => {
    const parsed = updateProfileSchema.parse({ name: '  Ada  ' });
    assert.equal(parsed.name, 'Ada');
  });

  it('rejects an empty patch', () => {
    assert.equal(updateProfileSchema.safeParse({}).success, false);
  });
});
