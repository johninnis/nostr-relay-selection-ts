import type { RelayUrl } from "./types.ts"

const HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/
const URL_CHARACTERS_REGEX = /^[A-Za-z0-9\-._~:/?[\]@!$&()*+,;=%]+$/
const ENCODED_CONTROL_REGEX = /%(?:[01][0-9a-f]|20|7f)/i
const NUMERIC_LABEL_REGEX = /^(?:0x[0-9a-f]*|[0-9]+)$/i
const DOTTED_QUAD_REGEX = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/
const CONCATENATED_WSS_REGEX = /wss?:\/\//
// Deliberate: the trim set written out, never the runtime's own trim — see shared ADR-0002
const SPACE_AND_NUL_ENDS = /^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g

const isCanonicalNumericHost = (host: string): boolean => {
  const labels = host.replace(/\.$/, "").split(".")
  return !NUMERIC_LABEL_REGEX.test(labels[labels.length - 1] ?? "") || DOTTED_QUAD_REGEX.test(host)
}

const rawAuthorityOf = (url: string): string => url.slice(url.indexOf("//") + 2).split(/[/?]/, 1)[0] ?? ""

const isDefaultPort = (scheme: string, port: number): boolean =>
  (scheme === "wss" && port === 443) || (scheme === "ws" && port === 80)

/**
 * Normalise an arbitrary URL string into a branded `RelayUrl`. Trims space, tab,
 * line feed, carriage return, NUL and vertical tab from its ends, lowercases scheme
 * and host, strips default ports, resolves dot segments, and strips trailing
 * slashes and `,.;!` in one pass. Rejects non-ws(s), whitespace, fragments,
 * `%20` in paths, percent-encoded or malformed hostnames, out-of-range ports,
 * concatenated URLs, and inputs over 200 chars. Returns `null` on malformed input. The rules are
 * pinned by `tests/corpus/normalise-url.json`, shared with the PHP port and
 * with the nostr-core libraries.
 */
export const normaliseRelayUrl = (url: string | null | undefined): RelayUrl | null => {
  if (!url) return null

  const trimmed = url.replace(SPACE_AND_NUL_ENDS, "")
  if (!URL_CHARACTERS_REGEX.test(trimmed) || ENCODED_CONTROL_REGEX.test(trimmed)) return null

  const lower = trimmed.toLowerCase()
  if (!lower.startsWith("ws://") && !lower.startsWith("wss://")) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  const authority = rawAuthorityOf(trimmed)
  if (authority === "" || /[@%]/.test(authority) || !isCanonicalNumericHost(authority.replace(/:[0-9]*$/, ""))) {
    return null
  }

  const scheme = parsed.protocol.slice(0, -1)
  const hostname = parsed.hostname
  if (!HOSTNAME_REGEX.test(hostname) || hostname.includes("..")) return null

  let portSuffix = ""
  if (parsed.port !== "") {
    const port = Number(parsed.port)
    if (port === 0) return null
    if (!isDefaultPort(scheme, port)) portSuffix = `:${port}`
  }

  const path = parsed.pathname.replace(/[,.;!/]+$/, "")

  if (path.includes("//")) return null
  if (path !== "" && path.includes(hostname)) return null

  const query = parsed.search

  const normalised = `${scheme}://${hostname}${portSuffix}${path}${query}`

  if (normalised.length > 200) return null

  const afterHost = normalised.slice(normalised.indexOf(hostname) + hostname.length)
  if (CONCATENATED_WSS_REGEX.test(afterHost)) return null

  // Deliberate: the one construction point of the RelayUrl brand — see ADR-0005
  return normalised as RelayUrl
}
