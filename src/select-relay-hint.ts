import type { PublicKey, RelayDirectory, RelayUrl } from "./types.ts"

/**
 * What a relay hint points at. `pubkey` is whose events the hint should find:
 * the referenced event's author for an `e` / `q` / `a` tag, the tagged user for
 * a `p` tag. `seenOn` is a relay the caller received the target from, when
 * known: the referenced event itself, or an event by the tagged user.
 */
export interface RelayHintTarget {
  readonly pubkey: PublicKey
  readonly seenOn?: RelayUrl | undefined
}

/**
 * Pick one relay URL hint for a tag pointing at `target`: a relay where the
 * target's events are found. `null` when no candidate remains. Blocked relays
 * are never chosen.
 *
 * Candidates, in order: `seenOn`, then the first of the target's outbox
 * relays, then the first of the user's inbox relays.
 */
export const selectRelayHint = (
  userPubkey: PublicKey,
  target: RelayHintTarget,
  directory: RelayDirectory,
): RelayUrl | null =>
  directory.permitted(
    target.seenOn === undefined ? [] : [target.seenOn],
    directory.relaysOf(target.pubkey, "outbox"),
    directory.relaysOf(userPubkey, "inbox"),
  )[0] ?? null
