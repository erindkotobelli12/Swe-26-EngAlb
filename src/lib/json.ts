/** JSON-in-string columns (SQLite) are parsed defensively: malformed data never crashes a page. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export const toJson = (value: unknown): string => JSON.stringify(value ?? null);
