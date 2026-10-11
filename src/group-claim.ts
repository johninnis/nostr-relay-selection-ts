import type { Event, RelayUrl } from "./types.ts"
import { buildRelaySet } from "./relay-set.ts"

export type GroupClaim =
  | { readonly namesGroup: true; readonly hint: RelayUrl | null }
  | { readonly namesGroup: false }

// Deliberate: every h tag is read as one claim, so tag order never decides the group or its hint — see ADR-0011
export const groupClaimOf = (event: Event): GroupClaim | null => {
  const groupTags = event.tags.filter((tag) => tag[0] === "h" && (tag[1] ?? "").length > 0)
  if (groupTags.length === 0) return null
  if (new Set(groupTags.map((tag) => tag[1])).size !== 1) return { namesGroup: false }
  const hints = buildRelaySet(groupTags.flatMap((tag) => tag[2] === undefined ? [] : [tag[2]]))
  return { namesGroup: true, hint: hints.length === 1 ? hints[0] ?? null : null }
}
