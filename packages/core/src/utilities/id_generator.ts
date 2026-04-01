const counters: Record<string, number> = {};

export function generateID(prefix?: string): string {
  const key = prefix ?? "";
  counters[key] = (counters[key] ?? 0) + 1;
  return prefix ? `${prefix}-${counters[key]}` : String(counters[key]);
}
