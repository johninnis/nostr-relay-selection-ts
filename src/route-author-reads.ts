import type { AuthorReadPolicy, AuthorReadRoute, PublicKey, RelayDirectory, RelaySet, RelayUrl } from "./types.ts"
import { requireCount, requireCountOrAll } from "./counts.ts"

const DEFAULT_MAX_AUTHORS_PER_FILTER = 200
const DEFAULT_REDUNDANCY = 3

interface Candidate {
  readonly relay: RelayUrl
  readonly authors: ReadonlyArray<PublicKey>
}

const chunk = <T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

const candidatesOf = (outboxes: ReadonlyMap<PublicKey, RelaySet>): ReadonlyArray<Candidate> => {
  const authorsByRelay = new Map<RelayUrl, ReadonlyArray<PublicKey>>()
  for (const [author, outbox] of outboxes) {
    for (const relay of outbox) authorsByRelay.set(relay, [...authorsByRelay.get(relay) ?? [], author])
  }
  return [...authorsByRelay].map(([relay, authors]) => ({ relay, authors }))
}

const bestOf = (candidates: ReadonlyArray<Candidate>): Candidate | null =>
  candidates.reduce<Candidate | null>(
    (best, candidate) => candidate.authors.length > (best?.authors.length ?? 0) ? candidate : best,
    null,
  )

/*
 * Greedy set cover: repeatedly pick the relay that reaches the most authors who
 * are still below the redundancy target, until no relay reaches such an author.
 * Ties go to the relay seen first, so the plan is deterministic.
 */
const greedyCover = (candidates: ReadonlyArray<Candidate>, redundancy: number): ReadonlyArray<Candidate> => {
  const coverage = new Map<PublicKey, number>()
  const needing = (candidate: Candidate): Candidate => ({
    relay: candidate.relay,
    authors: candidate.authors.filter((author) => (coverage.get(author) ?? 0) < redundancy),
  })
  const picks: Array<Candidate> = []
  let remaining = candidates
  for (let best = bestOf(remaining.map(needing)); best !== null; best = bestOf(remaining.map(needing))) {
    const picked = best.relay
    picks.push(best)
    remaining = remaining.filter((candidate) => candidate.relay !== picked)
    for (const author of best.authors) coverage.set(author, (coverage.get(author) ?? 0) + 1)
  }
  return picks
}

/**
 * Decide which outbox relays to read a set of authors from. Greedy set cover
 * groups authors who share a relay, reading each author from up to
 * `redundancy` relays (`Infinity` for every relay they list); each route's
 * authors are chunked to at most `maxAuthorsPerFilter`. Authors with no usable
 * outbox (no kind 10002, no write entries, or every entry blocked) are read
 * from `fallbackRelays` in a final route, which is omitted when no fallback
 * relay remains after blocking. No route ever names zero relays.
 *
 * Throws `RangeError` when `maxAuthorsPerFilter` is not a positive integer or
 * `redundancy` is neither a positive integer nor `Infinity`.
 */
export const routeAuthorReads = (
  authors: ReadonlyArray<PublicKey>,
  directory: RelayDirectory,
  policy: AuthorReadPolicy = {},
): ReadonlyArray<AuthorReadRoute> => {
  const maxAuthors = requireCount("maxAuthorsPerFilter", policy.maxAuthorsPerFilter ?? DEFAULT_MAX_AUTHORS_PER_FILTER)
  const redundancy = requireCountOrAll("redundancy", policy.redundancy ?? DEFAULT_REDUNDANCY)
  const outboxes = new Map([...new Set(authors)].map((author) => [author, directory.relaysOf(author, "outbox")]))
  const covered = greedyCover(candidatesOf(outboxes), redundancy)
    .map(({ relay, authors }) => ({ relays: [relay], authorChunks: chunk(authors, maxAuthors) }))
  const uncovered = [...outboxes].filter(([, outbox]) => outbox.length === 0).map(([author]) => author)
  const fallback = directory.permitted(policy.fallbackRelays ?? [])
  return uncovered.length > 0 && fallback.length > 0
    ? [...covered, { relays: fallback, authorChunks: chunk(uncovered, maxAuthors) }]
    : covered
}
