import type { ChannelKey, Item } from "@/lib/types";

/**
 * Distinct, non-empty itemType values ranked by how often they're used, so the
 * itemType <input>'s <datalist> offers "pick, don't type" suggestions instead
 * of bare free text — this is what collapses spelling variants of the same
 * repeated itemType (combined with the existing `.trim()` on submit).
 *
 * Ties break alphabetically (Thai collation) for a stable order. When a
 * channel is given, itemTypes already used on that channel are listed first
 * (still ranked by their own frequency), followed by the rest.
 */
export function rankedItemTypeOptions(items: Item[], channel?: ChannelKey): string[] {
  const counts = new Map<string, number>();
  const channelMatches = new Set<string>();

  for (const item of items) {
    const itemType = item.itemType.trim();
    if (!itemType) continue;
    counts.set(itemType, (counts.get(itemType) || 0) + 1);
    if (channel && item.channel === channel) channelMatches.add(itemType);
  }

  const ranked = [...counts.keys()].sort((a, b) => {
    const byFrequency = (counts.get(b) || 0) - (counts.get(a) || 0);
    return byFrequency !== 0 ? byFrequency : a.localeCompare(b, "th");
  });

  if (!channel) return ranked;

  const matching = ranked.filter((itemType) => channelMatches.has(itemType));
  const rest = ranked.filter((itemType) => !channelMatches.has(itemType));
  return [...matching, ...rest];
}
