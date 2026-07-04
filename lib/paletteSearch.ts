// Pure search/cap logic for the command palette (⌘K), extracted so it is
// testable without mounting the dialog. Kept generic over the entry shape so
// the component can pass its real Command objects (label/keywords/group)
// straight through.
export interface PaletteSearchable {
  label: string;
  // free-text extra fields (e.g. province, salesOwner, qtNo) the query should
  // also match against, even though they are not shown in the label itself.
  keywords?: string;
  // only "item" entries are capped (see maxItemResults) — nav/action/customer
  // entries always render in full.
  group?: string;
}

export const DEFAULT_MAX_ITEM_RESULTS = 20;

// Filters `commands` by a plain case-insensitive substring match against
// `label + keywords` (Thai-aware via toLocaleLowerCase("th-TH")), then caps
// how many "item"-group entries survive so a 100+ item dataset never floods
// the results list. Order is preserved — callers should list nav/action
// commands first, then customers, then items, so the cap only ever trims off
// the tail of the item group.
export function filterPaletteCommands<T extends PaletteSearchable>(
  commands: T[],
  query: string,
  maxItemResults: number = DEFAULT_MAX_ITEM_RESULTS,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("th-TH");
  const matches = normalizedQuery
    ? commands.filter((command) =>
        `${command.label} ${command.keywords ?? ""}`.toLocaleLowerCase("th-TH").includes(normalizedQuery),
      )
    : commands;

  let itemMatchCount = 0;
  return matches.filter((command) => {
    if (command.group !== "item") return true;
    itemMatchCount += 1;
    return itemMatchCount <= maxItemResults;
  });
}
