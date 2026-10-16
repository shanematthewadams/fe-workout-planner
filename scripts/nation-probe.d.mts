export function probeNation(
  env: Record<string, string | undefined>,
  fetcher?: typeof fetch,
): Promise<Record<string, unknown>>;
