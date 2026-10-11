import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/tavelo-test';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

type SuccessBody = {
  success: true;
  data: {
    status: string;
    api: string;
    database: string;
    timestamp: string;
  };
};

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

describe('HTTP API', () => {
  let baseUrl = '';
  let server: Server;

  before(async () => {
    const { createApp } = await import('./app');
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('reports a disconnected database without infrastructure details', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: 'http://localhost:8081' },
    });
    const body = (await response.json()) as SuccessBody;

    assert.equal(response.status, 503);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'degraded');
    assert.equal(body.data.api, 'up');
    assert.equal(body.data.database, 'disconnected');
    assert.equal(Number.isNaN(Date.parse(body.data.timestamp)), false);
    assert.equal(JSON.stringify(body).includes('mongodb'), false);
    assert.equal(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:8081',
    );
  });

  it('rejects browser origins that are not on the allow list', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    const body = (await response.json()) as ErrorBody;

    assert.equal(response.status, 403);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  });

  it('returns a consistent not-found response', async () => {
    const response = await fetch(`${baseUrl}/api/v1/missing`, {
      headers: { Origin: 'http://localhost:8081' },
    });
    const body = (await response.json()) as ErrorBody;

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
    assert.equal('stack' in body, false);
  });

  it('rejects registration that misses a password', async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:8081',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Ada', email: 'ada@example.com' }),
    });
    const body = (await response.json()) as ErrorBody;

    assert.equal(response.status, 400);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.equal(JSON.stringify(body).toLowerCase().includes('passwordhash'), false);
  });

  it('rejects a trip request without a session', async () => {
    const response = await fetch(`${baseUrl}/api/v1/trips`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:8081',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Missing fields' }),
    });
    const body = (await response.json()) as ErrorBody & {
      error: { details?: { path: string }[] };
    };

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
    assert.equal(JSON.stringify(body).includes('stack'), false);
  });

  it('rejects a trip request with a bad or expired token', async () => {
    const expired = jwt.sign(
      {
        sub: '507f1f77bcf86cd799439011',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      'test-access-secret-must-be-32-characters',
      { issuer: 'tavelo' },
    );

    for (const token of ['not-a-token', expired]) {
      const response = await fetch(`${baseUrl}/api/v1/trips`, {
        headers: {
          Origin: 'http://localhost:8081',
          Authorization: `Bearer ${token}`,
        },
      });
      const body = (await response.json()) as ErrorBody;
      assert.equal(response.status, 401);
      assert.equal(body.error.code, 'UNAUTHORIZED');
      assert.equal(JSON.stringify(body).includes(token), false);
    }
  });

  it('rejects malformed JSON', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:8081',
        'Content-Type': 'application/json',
      },
      body: '{',
    });
    const body = (await response.json()) as ErrorBody;

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_JSON');
  });
});
