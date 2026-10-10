import type { Response } from 'express';
import type { ValidationIssue } from './AppError';

export type ErrorBody = {
  code: string;
  message: string;
  details?: ValidationIssue[];
};

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ValidationIssue[],
): void {
  const error: ErrorBody = { code, message };
  if (details && details.length > 0) {
    error.details = details;
  }

  res.status(statusCode).json({
    success: false,
    error,
  });
}
