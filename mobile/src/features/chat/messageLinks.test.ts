import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isHttpsUrl, splitMessageLinks } from './messageLinks';

describe('splitMessageLinks', () => {
  it('keeps plain text intact', () => {
    const parts = splitMessageLinks('Meet at the fort');
    assert.deepEqual(parts, [{ type: 'text', value: 'Meet at the fort' }]);
  });

  it('extracts https links only', () => {
    const parts = splitMessageLinks('See https://maps.google.com/goa tonight');
    assert.equal(parts.some((part) => part.type === 'link' && part.value.startsWith('https://')), true);
    assert.equal(parts.at(-1)?.value.includes('tonight'), true);
  });
});

describe('isHttpsUrl', () => {
  it('rejects javascript and http urls', () => {
    assert.equal(isHttpsUrl('javascript:alert(1)'), false);
    assert.equal(isHttpsUrl('http://example.com'), false);
    assert.equal(isHttpsUrl('https://example.com/hotel'), true);
  });
});
