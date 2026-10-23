import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGroupPackingSchema,
  createPersonalPackingSchema,
  updateGroupPackingSchema,
  updatePersonalPackingSchema,
} from './packing.schema';

describe('createGroupPackingSchema', () => {
  it('trims the name and strips identity fields', () => {
    const parsed = createGroupPackingSchema.parse({
      name: '  Adapter  ',
      userId: '507f1f77bcf86cd799439011',
      createdBy: '507f1f77bcf86cd799439012',
    });
    assert.equal(parsed.name, 'Adapter');
    assert.equal('userId' in parsed, false);
    assert.equal('createdBy' in parsed, false);
  });

  it('rejects a blank name', () => {
    assert.equal(createGroupPackingSchema.safeParse({ name: '   ' }).success, false);
  });

  it('treats an empty owner as unassigned', () => {
    const parsed = createGroupPackingSchema.parse({ name: 'Kit', ownerId: '' });
    assert.equal(parsed.ownerId, null);
  });
});

describe('updateGroupPackingSchema', () => {
  it('rejects an empty patch', () => {
    assert.equal(updateGroupPackingSchema.safeParse({}).success, false);
  });
});

describe('createPersonalPackingSchema', () => {
  it('rejects client-supplied userId', () => {
    const parsed = createPersonalPackingSchema.parse({
      name: 'Passport',
      userId: '507f1f77bcf86cd799439011',
    });
    assert.equal(parsed.name, 'Passport');
    assert.equal('userId' in parsed, false);
  });
});

describe('updatePersonalPackingSchema', () => {
  it('rejects an empty patch', () => {
    assert.equal(updatePersonalPackingSchema.safeParse({}).success, false);
  });

  it('strips client-supplied ownership fields', () => {
    const parsed = updatePersonalPackingSchema.parse({
      packed: true,
      userId: '507f1f77bcf86cd799439011',
      createdBy: '507f1f77bcf86cd799439012',
    });
    assert.equal(parsed.packed, true);
    assert.equal('userId' in parsed, false);
    assert.equal('createdBy' in parsed, false);
  });
});
