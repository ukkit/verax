// Structured error logging: one JSON line per event, never a bare string.
// Context must not hold statement data (folios, amounts) or query values; see docs/SECURITY.md.

const describe = (error: unknown) => (error instanceof Error ? { name: error.name, message: error.message } : String(error));

export function logError(event: string, context: Record<string, unknown> = {}): void {
  const { error, ...rest } = context;
  console.error(JSON.stringify({ level: 'error', event, ...rest, ...(error === undefined ? {} : { error: describe(error) }) }));
}
