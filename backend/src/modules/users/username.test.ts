import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLoginIdentifier, normalizeUsername, validateUsernameFormat } from './username';

describe('username rules', () => {
  it('normalizes to lowercase', () => {
    assert.equal(normalizeUsername('  Gajendra '), 'gajendra');
  });

  it('accepts valid handles', () => {
    assert.equal(validateUsernameFormat('gajendra'), null);
    assert.equal(validateUsernameFormat('gaj_123'), null);
  });

  it('rejects invalid handles', () => {
    assert.ok(validateUsernameFormat('ab'));
    assert.ok(validateUsernameFormat('.gaj'));
    assert.ok(validateUsernameFormat('gaj..endra'));
    assert.ok(validateUsernameFormat('bad space'));
  });

  it('normalizes login identifiers', () => {
    assert.equal(normalizeLoginIdentifier(' Ada@Example.com '), 'ada@example.com');
    assert.equal(normalizeLoginIdentifier('@gajendra'), 'gajendra');
  });
});
