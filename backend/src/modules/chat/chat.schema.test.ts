import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMessageSchema, listMessagesQuerySchema } from './chat.schema';

describe('createMessageSchema', () => {
  it('trims the body and strips identity fields', () => {
    const parsed = createMessageSchema.parse({
      body: '  Hello Goa  ',
      senderId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012',
    });
    assert.equal(parsed.body, 'Hello Goa');
    assert.equal('senderId' in parsed, false);
    assert.equal('userId' in parsed, false);
  });

  it('rejects a blank body', () => {
    assert.equal(createMessageSchema.safeParse({ body: '   ' }).success, false);
  });

  it('rejects a body over 2000 characters', () => {
    assert.equal(createMessageSchema.safeParse({ body: 'x'.repeat(2001) }).success, false);
  });
});

describe('listMessagesQuerySchema', () => {
  it('defaults the limit', () => {
    const parsed = listMessagesQuerySchema.parse({});
    assert.equal(parsed.limit, 30);
  });
});
