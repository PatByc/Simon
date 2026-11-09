const sensitiveKey = /password|secret|token|credential|authorization/i;

export function redactRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKey.test(key) ? "[REDACTED]" : item]));
}
