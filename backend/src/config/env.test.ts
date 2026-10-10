import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EnvConfigError, parseEnv } from './env';

describe('parseEnv', () => {
  it('applies local defaults and splits origins', () => {
    const env = parseEnv({
      MONGODB_URI: 'mongodb://127.0.0.1:27017/tavelo',
      CORS_ORIGINS: 'http://localhost:8081, http://localhost:19006',
    });

    assert.equal(env.NODE_ENV, 'development');
    assert.equal(env.PORT, 4000);
    assert.equal(env.API_PREFIX, '/api/v1');
    assert.deepEqual(env.CORS_ORIGINS, [
      'http://localhost:8081',
      'http://localhost:19006',
    ]);
  });

  it('does not echo a rejected value', () => {
    assert.throws(
      () =>
        parseEnv({
          MONGODB_URI: 'supersecret-not-a-database-uri',
        }),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigError);
        assert.equal(error.message.includes('supersecret-not-a-database-uri'), false);
        return true;
      },
    );
  });

  it('rejects a wildcard CORS origin without revealing other secrets', () => {
    assert.throws(
      () =>
        parseEnv({
          NODE_ENV: 'production',
          MONGODB_URI: 'mongodb+srv://user:secret@cluster.mongodb.net/tavelo',
          CORS_ORIGINS: '*',
        }),
      (error: unknown) => {
        assert.ok(error instanceof EnvConfigError);
        assert.match(error.message, /wildcard/i);
        assert.equal(error.message.includes('secret'), false);
        return true;
      },
    );
  });
});
