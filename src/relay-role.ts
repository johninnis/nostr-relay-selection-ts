import type { RelayRole, RelaySet } from "./types.ts"
import { KIND_BLOCKED_RELAYS_LIST, KIND_DM_RELAY_LIST, KIND_RELAY_LIST, KIND_SEARCH_RELAYS_LIST } from "./kinds.ts"
import { buildRelaySet } from "./relay-set.ts"

interface RoleRule {
  readonly kind: number
  readonly tagName: "r" | "relay"
  readonly oppositeMarker?: "read" | "write"
}

const ROLE_RULES: Readonly<Record<RelayRole, RoleRule>> = {
  inbox: { kind: KIND_RELAY_LIST, tagName: "r", oppositeMarker: "write" },
  outbox: { kind: KIND_RELAY_LIST, tagName: "r", oppositeMarker: "read" },
  dm: { kind: KIND_DM_RELAY_LIST, tagName: "relay" },
  search: { kind: KIND_SEARCH_RELAYS_LIST, tagName: "relay" },
  blocked: { kind: KIND_BLOCKED_RELAYS_LIST, tagName: "relay" },
}

const accepts = (rule: RoleRule, tag: ReadonlyArray<string>): boolean =>
  tag[0] === rule.tagName && (rule.oppositeMarker === undefined || tag[2] !== rule.oppositeMarker)

/** The replaceable relay-list kind a role is read from: 10002, 10050, 10007 or 10006. */
export const relayListKindOf = (role: RelayRole): number => ROLE_RULES[role].kind

/**
 * Read a role's relays from a relay-list event's tags: `r` tags for
 * `"inbox"` / `"outbox"`, `relay` tags for the others. An `r` tag serves both
 * directions unless its marker is exactly `read` or `write`, and a relay named
 * by several `r` tags serves the union of them. URLs are
 * normalised; malformed entries are dropped and duplicates collapse.
 */
export const extractRelays = (tags: ReadonlyArray<ReadonlyArray<string>>, role: RelayRole): RelaySet => {
  const rule = ROLE_RULES[role]
  return buildRelaySet(
    tags
      .filter((tag) => accepts(rule, tag))
      .flatMap((tag) => tag[1] === undefined ? [] : [tag[1]]),
  )
}
