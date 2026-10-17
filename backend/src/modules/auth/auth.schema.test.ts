import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loginSchema, registerSchema } from './auth.schema';

describe('registerSchema', () => {
  it('accepts a normalized account', () => {
    const parsed = registerSchema.parse({
      name: '  Ada Lovelace  ',
      username: ' Ada_Lovelace ',
      email: ' Ada@Example.com ',
      password: 'correct-horse-1',
    });

    assert.equal(parsed.name, 'Ada Lovelace');
    assert.equal(parsed.username, 'ada_lovelace');
    assert.equal(parsed.email, 'ada@example.com');
  });

  it('rejects a weak password and a mismatched email', () => {
    const result = registerSchema.safeParse({
      name: '',
      email: 'not-an-email',
      password: 'short',
    });

    assert.equal(result.success, false);
  });
});

describe('loginSchema', () => {
  it('does not apply the registration password rules to a login attempt', () => {
    const parsed = loginSchema.parse({
      email: 'ada@example.com',
      password: 'whatever-they-typed',
    });

    assert.equal(parsed.email, 'ada@example.com');
  });
});
