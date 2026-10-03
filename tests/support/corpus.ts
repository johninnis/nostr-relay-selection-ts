import {
  createEvent,
  createFilter,
  createPublicKey,
  createRelayDirectory,
  type Event,
  type Filter,
  normaliseRelayUrl,
  type PublicKey,
  type RelayDirectory,
  type RelayRole,
  type RelayUrl,
} from "../../mod.ts"

export type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const fail = (message: string): never => {
  throw new Error(message)
}

export const corpusUrl = (path: string): URL => new URL(`../corpus/${path}`, import.meta.url)

export const loadJson = (path: string): unknown => JSON.parse(Deno.readTextFileSync(corpusUrl(path)))

export const listOf = (value: unknown): ReadonlyArray<unknown> =>
  Array.isArray(value) ? value : fail(`expected a list, got ${JSON.stringify(value)}`)

export const objectOf = (value: unknown): Json => isJson(value) ? value : fail(`expected an object, got ${value}`)

export const loadVectors = (file: string): ReadonlyArray<Json> => listOf(loadJson(file)).map(objectOf)

export const stringOf = (value: unknown): string =>
  typeof value === "string" ? value : fail(`expected a string, got ${JSON.stringify(value)}`)

export const stringsOf = (value: unknown): ReadonlyArray<string> => listOf(value).map(stringOf)

export const tagsOf = (value: unknown): ReadonlyArray<ReadonlyArray<string>> => listOf(value).map(stringsOf)

export const relayUrlOf = (value: unknown): RelayUrl =>
  normaliseRelayUrl(stringOf(value)) ?? fail(`invalid relay URL in fixture: ${value}`)

export const relayUrlsOf = (value: unknown): ReadonlyArray<RelayUrl> => listOf(value).map(relayUrlOf)

export const pubkeyOf = (value: unknown): PublicKey =>
  createPublicKey(stringOf(value)) ?? fail(`invalid pubkey in fixture: ${value}`)

export const pubkeysOf = (value: unknown): ReadonlyArray<PublicKey> => listOf(value).map(pubkeyOf)

export const eventOf = (value: unknown): Event => createEvent(value) ?? fail(`invalid event in fixture: ${value}`)

export const eventsOf = (value: unknown): ReadonlyArray<Event> => listOf(value).map(eventOf)

export const filtersOf = (value: unknown): ReadonlyArray<Filter> =>
  listOf(value).map((raw) => createFilter(raw) ?? fail(`invalid filter in fixture: ${JSON.stringify(raw)}`))

const ROLES: ReadonlyArray<RelayRole> = ["inbox", "outbox", "dm", "search", "blocked"]

export const roleOf = (value: unknown): RelayRole =>
  ROLES.find((role) => role === value) ?? fail(`unknown role in fixture: ${value}`)

export const directoryOf = (value: unknown): RelayDirectory => {
  const raw = objectOf(value)
  return createRelayDirectory(eventsOf(raw.relayListEvents), relayUrlsOf(raw.blockedRelays))
}

export const optionalNumberOf = (value: unknown): number | undefined =>
  value === undefined ? undefined : typeof value === "number" ? value : fail(`expected a number, got ${value}`)

export const isInvalidArgument = (expected: unknown): boolean =>
  isJson(expected) && expected.error === "invalidArgument"
