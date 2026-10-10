import mongoose from 'mongoose';
import { redactSecrets } from '../utils/sanitize';
import { getEnv } from './env';

const PING_TIMEOUT_MS = 2000;

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(getEnv().MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log('MongoDB connection established.');
  } catch (error) {
    console.error(`MongoDB connection failed: ${describeDbError(error)}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

export async function pingDatabase(): Promise<boolean> {
  const database = mongoose.connection.db;
  if (mongoose.connection.readyState !== 1 || !database) {
    return false;
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      database.admin().ping(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('Database ping timed out.')),
          PING_TIMEOUT_MS,
        );
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function describeDbError(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return 'Unknown database error.';
}
