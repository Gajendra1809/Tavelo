import express, { type Express } from 'express';
import { createCorsMiddleware } from './config/cors';
import { getEnv } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';
import { requestLogger } from './middleware/requestLogger';
import { createApiRouter } from './routes';

export function createApp(): Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(requestLogger);
  app.use(createCorsMiddleware(env));
  app.use(express.json({ limit: '1mb' }));
  app.use(env.API_PREFIX, createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
