import { connectDatabase, describeDbError, disconnectDatabase } from './config/database';
import { getEnv } from './config/env';
import { createApp } from './app';
import { shutdownServer } from './shutdown';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function start(): void {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Invalid environment configuration.',
    );
    process.exit(1);
  }

  if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.length === 0) {
    console.warn(
      'CORS_ORIGINS is empty. Cross-origin browser requests will be rejected.',
    );
  }

  const app = createApp();
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${env.PORT} is already in use.`);
      process.exit(1);
    }
    console.error(error.message);
    process.exit(1);
  });

  void connectDatabase();

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`Received ${signal}. Closing the server.`);

    const timer = setTimeout(() => {
      console.error('Shutdown timed out.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    shutdownServer(server, disconnectDatabase)
      .catch((error: unknown) => {
        console.error(`Shutdown failed: ${describeDbError(error)}`);
        process.exitCode = 1;
      })
      .finally(() => {
        clearTimeout(timer);
        process.exit();
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
