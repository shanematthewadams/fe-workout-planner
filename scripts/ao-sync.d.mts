export function parseSchedule(html: string, checkedAt: string): unknown[];
export function mergeSchedule<T extends { id: string }>(
  previous: T[],
  incoming: T[],
): T[];
