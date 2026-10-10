import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { getEnv } from '../config/env';
import { AppError } from '../utils/AppError';
import { sendError } from '../utils/apiResponse';
import { redactSecrets } from '../utils/sanitize';
import { formatZodIssues } from '../utils/validate';

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.statusCode, error.code, error.message, error.details);
    return;
  }

  if (error instanceof ZodError) {
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Request validation failed.',
      formatZodIssues('request', error),
    );
    return;
  }

  if (isJsonParseError(error)) {
    sendError(res, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
    return;
  }

  console.error(
    error instanceof Error ? redactSecrets(error.stack ?? error.message) : error,
  );

  const message =
    getEnv().NODE_ENV === 'production'
      ? 'Something went wrong.'
      : error instanceof Error
        ? redactSecrets(error.message)
        : 'Something went wrong.';

  sendError(res, 500, 'INTERNAL_ERROR', message);
}

function isJsonParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as { type?: string }).type === 'entity.parse.failed'
  );
}
