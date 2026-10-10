import { pingDatabase } from '../../config/database';

export type HealthReport = {
  status: 'ok' | 'degraded';
  api: 'up';
  database: 'connected' | 'disconnected';
  timestamp: string;
};

export async function getHealthReport(): Promise<HealthReport> {
  const connected = await pingDatabase();

  return {
    status: connected ? 'ok' : 'degraded',
    api: 'up',
    database: connected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };
}
