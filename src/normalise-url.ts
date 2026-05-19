import type { RelayUrl } from "./types.ts"

// Validation behaviour mirrors innis/nostr-core's PHP RelayUrl value object, so
// the same input is accepted or rejected on both sides and the canonical output
// compares equal across libraries. The lib has zero runtime dependencies, so it
// cannot reuse another package's URL handling — the rules are re-declared here.
// Malformed hostnames, fragments, %20 in paths, concatenated URLs, out-of-range
// ports, and URLs over 200 chars are rejected at the boundary.

const HOSTNAME_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/
const CONCATENATED_WSS_REGEX = /wss?:\/\//

const isDefaultPort = (scheme: string, port: number): boolean =>
  (scheme === "wss" && port === 443) || (scheme === "ws" && port === 80)

/**
 * Normalise an arbitrary URL string into a branded `RelayUrl`. Lowercases scheme
 * and host, strips default ports and trailing slashes. Rejects non-ws(s),
 * fragments, `%20` in paths, malformed hostnames, out-of-range ports,
 * concatenated URLs, and inputs over 200 chars. Returns `null` on malformed
 * input.
 */
export const normaliseRelayUrl = (url: string | null | undefined): RelayUrl | null => {
  if (!url) return null

  const trimmed = url.trim()
  if (trimmed === "") return null

  const lower = trimmed.toLowerCase()
  if (!lower.startsWith("ws://") && !lower.startsWith("wss://")) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.hash !== "") return null

  const scheme = parsed.protocol.slice(0, -1).toLowerCase()
  if (scheme !== "ws" && scheme !== "wss") return null

  const hostname = parsed.hostname.toLowerCase()
  if (!HOSTNAME_REGEX.test(hostname)) return null

  let portSuffix = ""
  if (parsed.port !== "") {
    const port = Number(parsed.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null
    if (!isDefaultPort(scheme, port)) portSuffix = `:${port}`
  }

  let path = parsed.pathname
  if (path !== "" && path !== "/") {
    path = path.replace(/[,.;!]+$/, "")
    path = path.replace(/\/+$/, "")
    if (path === "" || path === "/") {
      path = ""
    }
  } else {
    path = ""
  }

  if (path.includes("%20")) return null
  if (path.includes("//")) return null
  if (path !== "" && path.includes(hostname)) return null

  const query = parsed.search

  const normalised = `${scheme}://${hostname}${portSuffix}${path}${query}`

  if (normalised.length > 200) return null

  const afterHost = normalised.slice(normalised.indexOf(hostname) + hostname.length)
  if (CONCATENATED_WSS_REGEX.test(afterHost)) return null

  return normalised as RelayUrl
}
