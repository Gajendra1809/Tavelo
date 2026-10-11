export type HealthReport = {
  status: 'ok' | 'degraded';
  api: 'up';
  database: 'connected' | 'disconnected';
  timestamp: string;
};
