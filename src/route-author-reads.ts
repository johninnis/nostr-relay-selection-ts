import type { AuthorReadRoute, AuthorReadRouteContext, PublicKey, RelayUrl } from "./types.ts"
import { KIND_RELAY_LIST } from "./kinds.ts"
import { subtractRelays } from "./build-relay-set.ts"
import { extractOutboxRelayUrls } from "./relay-list.ts"
import { newestEventByPubkeyAndKind } from "./event-utils.ts"

const DEFAULT_MAX_AUTHORS_PER_FILTER = 200
const DEFAULT_REDUNDANCY = 3

const chunkArray = <T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> => {
  if (size <= 0 || items.length <= size) return [items]
  const chunks: Array<ReadonlyArray<T>> = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Decide which outbox relays cover a list of author pubkeys. Uses greedy set
 * cover so authors who share a relay are queried together; chunks each plan if
 * the author count exceeds `maxAuthorsPerFilter`; falls back to
 * `fallbackRelays` for authors with no NIP-65 list. `redundancy` controls how
 * many relays each author should be queried on (default 3, `null` for
 * unbounded). `blockedRelays` is subtracted from every output.
 */
export const routeAuthorReads = (
  context: AuthorReadRouteContext,
): ReadonlyArray<AuthorReadRoute> => {
  const uniqueAuthors = [...new Set(context.authorPubkeys)]
  const cap = context.maxAuthorsPerFilter ?? DEFAULT_MAX_AUTHORS_PER_FILTER
  const target = context.redundancy === null ? Number.POSITIVE_INFINITY : context.redundancy ?? DEFAULT_REDUNDANCY
  const blockedSet = new Set<RelayUrl>(context.blockedRelays ?? [])

  const relayToAuthors = new Map<RelayUrl, Set<PublicKey>>()
  const pubkeysWithRelays = new Set<PublicKey>()

  for (const pubkey of uniqueAuthors) {
    const list = newestEventByPubkeyAndKind(context.relayListEvents, pubkey, KIND_RELAY_LIST)
    if (!list) continue
    const outbox = extractOutboxRelayUrls(list.tags)
    if (outbox.length === 0) continue
    let recorded = false
    for (const url of outbox) {
      if (blockedSet.has(url)) continue
      let set = relayToAuthors.get(url)
      if (!set) {
        set = new Set()
        relayToAuthors.set(url, set)
      }
      set.add(pubkey)
      recorded = true
    }
    if (recorded) pubkeysWithRelays.add(pubkey)
  }

  const maxCoverByAuthor = new Map<PublicKey, number>()
  for (const set of relayToAuthors.values()) {
    for (const pk of set) {
      maxCoverByAuthor.set(pk, (maxCoverByAuthor.get(pk) ?? 0) + 1)
    }
  }

  const coverByAuthor = new Map<PublicKey, number>()
  // Authors whose coverage reached min(target, maxCover) are permanently done (cover never
  // decreases); they are pruned from the shared sets lazily so later rounds stop rescoring them.
  const saturated = new Set<PublicKey>()
  const remaining = new Map(relayToAuthors)
  const pickedRelays: Array<{ readonly relay: RelayUrl; readonly authors: ReadonlyArray<PublicKey> }> = []

  while (remaining.size > 0) {
    let bestUrl: RelayUrl | null = null
    let bestAuthors: ReadonlyArray<PublicKey> = []
    for (const [url, authors] of remaining) {
      const needed: Array<PublicKey> = []
      for (const pk of authors) {
        if (saturated.has(pk)) {
          authors.delete(pk)
          continue
        }
        needed.push(pk)
      }
      if (authors.size === 0) {
        remaining.delete(url)
        continue
      }
      if (needed.length > bestAuthors.length) {
        bestUrl = url
        bestAuthors = needed
      }
    }
    if (bestUrl === null || bestAuthors.length === 0) break
    pickedRelays.push({ relay: bestUrl, authors: bestAuthors })
    remaining.delete(bestUrl)
    for (const pk of bestAuthors) {
      const next = (coverByAuthor.get(pk) ?? 0) + 1
      coverByAuthor.set(pk, next)
      if (next >= Math.min(target, maxCoverByAuthor.get(pk) ?? 0)) saturated.add(pk)
    }
  }

  const routes: Array<AuthorReadRoute> = []
  for (const { relay, authors } of pickedRelays) {
    routes.push({ relays: [relay], authorChunks: chunkArray(authors, cap) })
  }

  const pubkeysWithoutRelays = uniqueAuthors.filter((pk) => !pubkeysWithRelays.has(pk))
  if (pubkeysWithoutRelays.length > 0) {
    const fallback = subtractRelays(context.fallbackRelays, context.blockedRelays)
    routes.push({ relays: fallback, authorChunks: chunkArray(pubkeysWithoutRelays, cap) })
  }

  return routes
}
