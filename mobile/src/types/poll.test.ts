import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POLL_CATEGORIES, POLL_CATEGORY_LABELS } from './poll';

describe('poll categories', () => {
  it('has a label for every preset', () => {
    for (const category of POLL_CATEGORIES) {
      assert.equal(typeof POLL_CATEGORY_LABELS[category], 'string');
    }
  });
});
