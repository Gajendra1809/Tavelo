import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, afterEach, before, describe, it } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { uniqueTestUsername } from '../../test/helpers.js';
import { clearWeatherCacheForTests } from './weatherCache';

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.API_PREFIX = '/api/v1';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-32-characters';

type SessionBody = {
  success: true;
  data: { user: { id: string; email: string }; accessToken: string };
};

const password = 'correct-horse-1';
let baseUrl = '';
let server: Server;
let memory: MongoMemoryServer;
let originalFetch: typeof fetch;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

const mockForecast = {
  timezone: 'Asia/Kolkata',
  current: {
    time: '2026-12-25T11:30',
    temperature_2m: 29,
    apparent_temperature: 32,
    weather_code: 2,
  },
  daily: { temperature_2m_max: [31], temperature_2m_min: [25] },
  hourly: {
    time: ['2026-12-25T12:00'],
    temperature_2m: [30],
    precipitation_probability: [5],
    weather_code: [2],
  },
};

describe('trip weather', () => {
  before(async () => {
    originalFetch = globalThis.fetch;
    memory = await MongoMemoryServer.create({ binary: { checkMD5: false } });
    process.env.MONGODB_URI = memory.getUri();
    const { resetEnvCache } = await import('../../config/env');
    resetEnvCache();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    const { connectDatabase } = await import('../../config/database');
    await connectDatabase();
    const { createApp } = await import('../../app');
    server = createServer(createApp());
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearWeatherCacheForTests();
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    clearWeatherCacheForTests();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await mongoose.disconnect();
    await memory.stop();
  });

  it('requires membership and verified coordinates', async () => {
    clearWeatherCacheForTests();
    globalThis.fetch = originalFetch;

    const stamp = `${Date.now()}-a`;
    const owner = await register(`Owner ${stamp}`, `weather-owner-${stamp}@example.com`);
    const stranger = await register(`Stranger ${stamp}`, `weather-str-${stamp}@example.com`);
    const tripId = await createTripWithPlace(owner.accessToken, {
      source: 'provider',
      verified: true,
      latitude: 15.2993,
      longitude: 74.124,
    });

    const denied = await send('GET', `/api/v1/trips/${tripId}/weather`, undefined, stranger.accessToken);
    assert.equal(denied.status, 403);

    const manualTrip = await createTripWithPlace(owner.accessToken, {
      name: 'Manual Goa',
      source: 'manual',
      verified: false,
    });
    const manual = await send(
      'GET',
      `/api/v1/trips/${manualTrip}/weather`,
      undefined,
      owner.accessToken,
    );
    assert.equal(manual.status, 200);
    const manualBody = json<{ success: true; data: { available: boolean; reason?: string } }>(manual);
    assert.equal(manualBody.data.available, false);
    assert.equal(manualBody.data.reason, 'manual_location');
  });

  it('returns provider data and uses cache on repeat', async () => {
    clearWeatherCacheForTests();
    let providerCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('open-meteo.com')) {
        providerCalls += 1;
        return new Response(JSON.stringify(mockForecast), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await register(`Owner2 ${stamp}`, `weather-owner2-${stamp}@example.com`);
    const tripId = await createTripWithPlace(owner.accessToken, {
      source: 'provider',
      verified: true,
      latitude: 15.2993,
      longitude: 74.124,
    });

    const first = await send('GET', `/api/v1/trips/${tripId}/weather`, undefined, owner.accessToken);
    assert.equal(first.status, 200);
    const firstBody = json<{ success: true; data: { available: boolean; current?: { temperatureC: number } } }>(
      first,
    );
    assert.equal(firstBody.data.available, true);
    assert.equal(firstBody.data.current?.temperatureC, 29);
    assert.equal(providerCalls, 1);

    const second = await send('GET', `/api/v1/trips/${tripId}/weather`, undefined, owner.accessToken);
    assert.equal(second.status, 200);
    const secondBody = json<{ success: true; data: { meta: { cacheStatus: string } } }>(second);
    assert.equal(secondBody.data.meta.cacheStatus, 'hit');
    assert.equal(providerCalls, 1);
  });

  it('serves stale cache when the provider fails', async () => {
    clearWeatherCacheForTests();
    let providerCalls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('open-meteo.com')) {
        providerCalls += 1;
        if (providerCalls === 1) {
          return new Response(JSON.stringify(mockForecast), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('upstream down', { status: 503 });
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await register(`Owner3 ${stamp}`, `weather-owner3-${stamp}@example.com`);
    const tripId = await createTripWithPlace(owner.accessToken, {
      source: 'provider',
      verified: true,
      latitude: 15.2993,
      longitude: 74.124,
    });

    const first = await send('GET', `/api/v1/trips/${tripId}/weather`, undefined, owner.accessToken);
    assert.equal(first.status, 200);

    const { WEATHER_CACHE_TTL_MS, readWeatherCache } = await import('./weatherCache');
    const entry = readWeatherCache('15.2993:74.1240');
    assert.ok(entry);
    entry.providerFetchedAtMs = Date.now() - WEATHER_CACHE_TTL_MS - 1_000;

    const stale = await send(
      'GET',
      `/api/v1/trips/${tripId}/weather?refresh=true`,
      undefined,
      owner.accessToken,
    );
    assert.equal(stale.status, 200);
    const staleBody = json<{ success: true; data: { meta: { isStale: boolean; cacheStatus: string } } }>(
      stale,
    );
    assert.equal(staleBody.data.meta.isStale, true);
    assert.equal(staleBody.data.meta.cacheStatus, 'stale');
  });
});

async function register(name: string, email: string): Promise<SessionBody['data']> {
  const username = uniqueTestUsername(email);
  const response = await send('POST', '/api/v1/auth/register', { name, email, username, password });
  assert.equal(response.status, 201);
  return json<SessionBody>(response).data;
}

async function createTripWithPlace(
  accessToken: string,
  place: Record<string, unknown>,
): Promise<string> {
  const response = await send(
    'POST',
    '/api/v1/trips',
    {
      name: 'Weather trip',
      destination: 'Goa',
      destinationPlace: {
        name: 'Goa',
        formattedAddress: 'Goa, India',
        latitude: place.latitude ?? null,
        longitude: place.longitude ?? null,
        placeId: place.source === 'provider' ? 'test-place' : null,
        provider: place.source === 'provider' ? 'nominatim' : null,
        source: place.source,
        verified: place.verified,
      },
      startDate: '2026-12-25',
      endDate: '2026-12-28',
      description: '',
    },
    accessToken,
  );
  assert.equal(response.status, 201);
  return json<{ success: true; data: { id: string } }>(response).data.id;
}

async function send(
  method: string,
  path: string,
  body?: unknown,
  accessToken?: string,
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    parsed = JSON.parse(text) as unknown;
  }
  return { status: response.status, body: parsed };
}

function json<T>(response: { body: unknown }): T {
  return response.body as T;
}
