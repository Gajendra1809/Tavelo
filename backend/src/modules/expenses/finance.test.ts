import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeBalances,
  maxSettlementMinor,
  splitEqualMinor,
  suggestSettlements,
  validateCustomShares,
} from './finance';

describe('splitEqualMinor', () => {
  it('distributes remainder in stable userId order', () => {
    const shares = splitEqualMinor(100, ['b', 'a', 'c']);
    assert.deepEqual(shares, [
      { userId: 'a', amountMinor: 34 },
      { userId: 'b', amountMinor: 33 },
      { userId: 'c', amountMinor: 33 },
    ]);
    assert.equal(shares.reduce((sum, share) => sum + share.amountMinor, 0), 100);
  });
});

describe('validateCustomShares', () => {
  it('requires an exact total and unique participants', () => {
    const shares = validateCustomShares(500, [
      { userId: 'u2', amountMinor: 200 },
      { userId: 'u1', amountMinor: 300 },
    ]);
    assert.deepEqual(shares, [
      { userId: 'u1', amountMinor: 300 },
      { userId: 'u2', amountMinor: 200 },
    ]);
    assert.throws(() =>
      validateCustomShares(500, [
        { userId: 'u1', amountMinor: 100 },
        { userId: 'u1', amountMinor: 400 },
      ]),
    );
  });
});

describe('computeBalances', () => {
  it('handles payer excluded from participants and settlements', () => {
    const balances = computeBalances(
      [
        {
          id: 'e1',
          amountMinor: 1000,
          currency: 'INR',
          paidBy: 'alice',
          shares: [
            { userId: 'bob', amountMinor: 600 },
            { userId: 'carol', amountMinor: 400 },
          ],
        },
      ],
      [
        {
          id: 's1',
          currency: 'INR',
          payerId: 'bob',
          recipientId: 'alice',
          amountMinor: 300,
          status: 'recorded',
        },
      ],
    );
    const byId = new Map(balances.map((row) => [`${row.userId}:${row.currency}`, row.netMinor]));
    assert.equal(byId.get('alice:INR'), 700);
    assert.equal(byId.get('bob:INR'), -300);
    assert.equal(byId.get('carol:INR'), -400);
  });

  it('keeps currencies separate', () => {
    const balances = computeBalances(
      [
        {
          id: 'e1',
          amountMinor: 100,
          currency: 'INR',
          paidBy: 'a',
          shares: [{ userId: 'a', amountMinor: 100 }],
        },
        {
          id: 'e2',
          amountMinor: 50,
          currency: 'USD',
          paidBy: 'b',
          shares: [{ userId: 'b', amountMinor: 50 }],
        },
      ],
      [],
    );
    assert.equal(balances.length, 2);
    assert.equal(balances.every((row) => row.netMinor === 0), true);
  });
});

describe('suggestSettlements', () => {
  it('suggests deterministic transfers that never exceed owed amounts', () => {
    const balances = computeBalances(
      [
        {
          id: 'e1',
          amountMinor: 900,
          currency: 'INR',
          paidBy: 'alice',
          shares: [
            { userId: 'alice', amountMinor: 300 },
            { userId: 'bob', amountMinor: 300 },
            { userId: 'carol', amountMinor: 300 },
          ],
        },
      ],
      [],
    );
    const suggestions = suggestSettlements(balances);
    assert.equal(suggestions.length, 2);
    assert.equal(
      suggestions.reduce((sum, row) => sum + row.amountMinor, 0),
      600,
    );
    for (const suggestion of suggestions) {
      assert.notEqual(suggestion.fromUserId, suggestion.toUserId);
      assert.ok(suggestion.amountMinor > 0);
      assert.ok(
        maxSettlementMinor(
          balances,
          suggestion.fromUserId,
          suggestion.toUserId,
          suggestion.currency,
        ) >= suggestion.amountMinor,
      );
    }
  });
});
