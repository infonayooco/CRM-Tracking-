// Pure change-detection between two snapshots of the store's CRM collections.
// The sync layer uses this to turn "the store changed" into granular Supabase
// upsert/delete ops, without touching any store action.

export type ById = { id: string };
export type IdDiff<T> = { upserts: T[]; deletes: string[] };

// Rows come from normalize.* with a stable field order, so a JSON compare is a
// sound (and cheap) "did this row change" check.
export function diffById<T extends ById>(prev: readonly T[], next: readonly T[]): IdDiff<T> {
  const prevById = new Map(prev.map((row) => [row.id, row] as const));
  const nextIds = new Set<string>();
  const upserts: T[] = [];

  for (const row of next) {
    nextIds.add(row.id);
    const before = prevById.get(row.id);
    if (before === undefined || JSON.stringify(before) !== JSON.stringify(row)) {
      upserts.push(row);
    }
  }

  const deletes: string[] = [];
  for (const id of prevById.keys()) {
    if (!nextIds.has(id)) deletes.push(id);
  }

  return { upserts, deletes };
}

export function diffStringSet(
  prev: readonly string[],
  next: readonly string[],
): { added: string[]; removed: string[] } {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  return {
    added: next.filter((name) => !prevSet.has(name)),
    removed: prev.filter((name) => !nextSet.has(name)),
  };
}

export function diffNumberRecord(
  prev: Record<string, number>,
  next: Record<string, number>,
): { set: [string, number][]; removed: string[] } {
  const set: [string, number][] = [];
  for (const [key, value] of Object.entries(next)) {
    if (prev[key] !== value) set.push([key, value]);
  }
  const removed: string[] = [];
  for (const key of Object.keys(prev)) {
    if (!(key in next)) removed.push(key);
  }
  return { set, removed };
}
