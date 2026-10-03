import type { Event, PublicKey, RelayUrl } from "./types.ts"
import { createPublicKey } from "./create-public-key.ts"
import { isPubkeyDataKind } from "./kinds.ts"
import { normaliseRelayUrl } from "./normalise-url.ts"

export interface Recipient {
  readonly pubkey: PublicKey
  readonly hint: RelayUrl | null
}

const recipientOf = (tag: ReadonlyArray<string>): Recipient | null => {
  const pubkey = tag[0] === "p" && tag[1] !== undefined ? createPublicKey(tag[1]) : null
  return pubkey === null ? null : { pubkey, hint: normaliseRelayUrl(tag[2]) }
}

export const recipientsOf = (event: Event): ReadonlyArray<Recipient> => {
  if (isPubkeyDataKind(event.kind)) return []
  const byPubkey = new Map<PublicKey, Recipient>()
  for (const recipient of event.tags.map(recipientOf)) {
    if (recipient !== null && !byPubkey.has(recipient.pubkey)) byPubkey.set(recipient.pubkey, recipient)
  }
  return [...byPubkey.values()]
}
