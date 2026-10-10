import type { NextFunction, Request, Response } from 'express';
import { getEnv } from '../config/env';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (getEnv().NODE_ENV !== 'development') {
    next();
    return;
  }

  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${durationMs.toFixed(0)}ms`);
  });
  next();
}
