const CONNECTION_STRING = /mongodb(?:\+srv)?:\/\/\S+/gi;

export function redactSecrets(value: string): string {
  return value.replace(CONNECTION_STRING, 'mongodb://[redacted]');
}
