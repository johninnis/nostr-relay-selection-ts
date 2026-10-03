import type { Event, PublicKey, RelayDirectory } from "./types.ts"
import { isDraftKind, isGiftWrapKind } from "./kinds.ts"
import { recipientsOf } from "./recipients.ts"

/**
 * The `p`-tagged recipients `routePublish` could not fan out to through an
 * inbox: those with no kind 10002, a kind 10002 with no read entries, or every
 * inbox relay blocked. The `"general"` branch falls back to the `p` tag's relay
 * hint for exactly these recipients. Empty for gift wrap and draft kinds, whose private
 * content never fans out, and for kinds whose `p` tags are data
 * (`isPubkeyDataKind`), which go to the author's outbox only. Useful for
 * fetching missing relay lists before a publish.
 */
export const recipientsWithoutInbox = (event: Event, directory: RelayDirectory): ReadonlyArray<PublicKey> =>
  isGiftWrapKind(event.kind) || isDraftKind(event.kind) ? [] : recipientsOf(event)
    .filter(({ pubkey }) => directory.relaysOf(pubkey, "inbox").length === 0)
    .map(({ pubkey }) => pubkey)
