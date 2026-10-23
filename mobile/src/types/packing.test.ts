import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { packingListFromItems, packingProgressLabel } from './packing';

describe('packingProgressLabel', () => {
  it('describes an empty list', () => {
    assert.equal(packingProgressLabel(0, 0), 'Nothing packed yet');
  });

  it('counts remaining items independently of packed items', () => {
    assert.equal(packingProgressLabel(3, 7), '3 of 7 packed · 4 remaining');
    assert.equal(packingProgressLabel(4, 4), '4 of 4 packed');
  });
});

describe('packingListFromItems', () => {
  it('recomputes packedCount and total from the current rows', () => {
    const list = packingListFromItems([
      { packed: true },
      { packed: false },
      { packed: true },
    ]);
    assert.equal(list.total, 3);
    assert.equal(list.packedCount, 2);
  });
});
