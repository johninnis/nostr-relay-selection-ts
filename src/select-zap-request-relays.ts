import type { PublicKey, RelayDirectory, RelaySet } from "./types.ts"
import { unionRelays } from "./relay-set.ts"

/**
 * Relays for a zap request (NIP-57): the zapper's kind 10002 inbox relays, then
 * the recipient's, deduplicated, with blocked relays removed.
 */
export const selectZapRequestRelays = (
  zapperPubkey: PublicKey,
  recipientPubkey: PublicKey,
  directory: RelayDirectory,
): RelaySet => unionRelays(directory.relaysOf(zapperPubkey, "inbox"), directory.relaysOf(recipientPubkey, "inbox"))
