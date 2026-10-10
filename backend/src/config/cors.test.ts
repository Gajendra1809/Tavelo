import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AppEnv } from './env';
import { isOriginAllowed } from './cors';

const baseEnv: AppEnv = {
  NODE_ENV: 'development',
  PORT: 4000,
  MONGODB_URI: 'mongodb://127.0.0.1:27017/tavelo',
  API_PREFIX: '/api/v1',
  CORS_ORIGINS: ['http://localhost:8081'],
};

describe('isOriginAllowed', () => {
  it('allows native clients that omit Origin', () => {
    assert.equal(isOriginAllowed(undefined, baseEnv), true);
  });

  it('allows private LAN origins only in development', () => {
    assert.equal(isOriginAllowed('http://192.168.1.20:8081', baseEnv), true);
    assert.equal(
      isOriginAllowed('http://192.168.1.20:8081', { ...baseEnv, NODE_ENV: 'production' }),
      false,
    );
  });

  it('rejects public origins that are not on the allow list', () => {
    assert.equal(isOriginAllowed('https://evil.example', baseEnv), false);
  });
});
