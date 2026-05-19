import type { RelayUrl } from "./types.ts"

// Pure URL classification predicates. The library does NOT apply these itself
// to routing outputs — callers compose filters with them when they want to
// exclude classes of relay (e.g. onion-only mode, no insecure clearnet).

const hostnameOf = (url: RelayUrl): string => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ""
  }
}

/** Host ends with `.onion`. */
export const isOnionUrl = (url: RelayUrl): boolean => hostnameOf(url).endsWith(".onion")

/** Host is `localhost`, the `127.0.0.0/8` range, or `::1`. */
export const isLoopbackUrl = (url: RelayUrl): boolean => {
  const host = hostnameOf(url)
  return host === "localhost" || host === "::1" || host.startsWith("127.")
}

/** Loopback, RFC1918 (`10/8`, `172.16/12`, `192.168/16`), or `.local` mDNS. */
export const isLocalAddrUrl = (url: RelayUrl): boolean => {
  if (isLoopbackUrl(url)) return true
  const host = hostnameOf(url)
  if (host.endsWith(".local")) return true
  if (/^10\./.test(host)) return true
  if (/^192\.168\./.test(host)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true
  return false
}

/** `ws://` and not an onion host. */
export const isInsecureUrl = (url: RelayUrl): boolean =>
  url.startsWith("ws://") && !isOnionUrl(url)
