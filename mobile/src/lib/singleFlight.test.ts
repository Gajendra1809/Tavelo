import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { singleFlight } from './singleFlight';

describe('singleFlight', () => {
  it('runs one shared request while several callers wait', async () => {
    let calls = 0;
    const run = singleFlight(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return 'ok';
    });

    const results = await Promise.all([run(), run(), run()]);
    assert.deepEqual(results, ['ok', 'ok', 'ok']);
    assert.equal(calls, 1);
  });
});
