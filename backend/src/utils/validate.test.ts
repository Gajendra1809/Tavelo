import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from './AppError';
import { validate } from './validate';

describe('validate', () => {
  it('stores parsed request data', () => {
    const req = { body: { name: 'Ada' } } as Request;
    let forwarded: unknown = 'not-called';

    validate({ body: z.object({ name: z.string().min(1) }) })(
      req,
      {} as Response,
      (error) => {
        forwarded = error;
      },
    );

    assert.equal(forwarded, undefined);
    assert.deepEqual(req.validated?.body, { name: 'Ada' });
  });

  it('returns field errors without copying the submitted value into the message path', () => {
    const req = { body: {} } as Request;
    let forwarded: unknown;

    validate({ body: z.object({ name: z.string().min(1) }) })(
      req,
      {} as Response,
      (error) => {
        forwarded = error;
      },
    );

    assert.ok(forwarded instanceof AppError);
    assert.equal(forwarded.statusCode, 400);
    assert.equal(forwarded.code, 'VALIDATION_ERROR');
    assert.equal(forwarded.details?.[0]?.path, 'body.name');
  });
});
