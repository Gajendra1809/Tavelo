import type { NextFunction, Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';
import { AppError, type ValidationIssue } from './AppError';

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

type SchemaSource = keyof RequestSchemas;

export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: ValidationIssue[] = [];
    const validated: NonNullable<Request['validated']> = {};

    (Object.keys(schemas) as SchemaSource[]).forEach((source) => {
      const schema = schemas[source];
      if (!schema) {
        return;
      }

      const result = schema.safeParse(readSource(req, source));
      if (result.success) {
        validated[source] = result.data;
        return;
      }

      issues.push(...formatZodIssues(source, result.error));
    });

    if (issues.length > 0) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', issues));
      return;
    }

    req.validated = validated;
    next();
  };
}

export function formatZodIssues(source: string, error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => {
    const fieldPath = issue.path.map((part) => String(part)).join('.');
    const path = fieldPath ? `${source}.${fieldPath}` : source;
    return {
      path,
      message: issue.message,
    };
  });
}

function readSource(req: Request, source: SchemaSource): unknown {
  if (source === 'body') {
    return req.body;
  }
  if (source === 'query') {
    return req.query;
  }
  return req.params;
}
