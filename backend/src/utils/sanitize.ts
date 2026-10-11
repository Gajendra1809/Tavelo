const CONNECTION_STRING = /mongodb(?:\+srv)?:\/\/\S+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function redactSecrets(value: string): string {
  return value.replace(CONNECTION_STRING, 'mongodb://[redacted]').replace(BEARER, 'Bearer [redacted]');
}
