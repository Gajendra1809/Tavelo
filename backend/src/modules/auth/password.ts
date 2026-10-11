import bcrypt from 'bcryptjs';
import { getEnv } from '../../config/env';

let dummyHash: string | null = null;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, rounds());
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    dummyHash ??= await bcrypt.hash('tavelo-not-a-user', rounds());
    await bcrypt.compare(password, dummyHash);
    return false;
  }

  return bcrypt.compare(password, hash);
}

function rounds(): number {
  return getEnv().NODE_ENV === 'test' ? 4 : 12;
}
