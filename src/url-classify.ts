import type { RelayUrl } from "./types.ts"

const IPV4_REGEX = /^\d+\.\d+\.\d+\.\d+$/
const PRIVATE_IPV4_REGEX = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/

const hostOf = (url: RelayUrl): string => url.slice(url.indexOf("//") + 2).split(/[:/?]/, 1)[0] ?? ""

const isIpv4 = (host: string): boolean => IPV4_REGEX.test(host)

/** Host ends with `.onion`. */
export const isOnionUrl = (url: RelayUrl): boolean => hostOf(url).endsWith(".onion")

/** Host is `localhost` or an IPv4 address in `127.0.0.0/8`. */
export const isLoopbackUrl = (url: RelayUrl): boolean => {
  const host = hostOf(url)
  return host === "localhost" || (isIpv4(host) && host.startsWith("127."))
}

/** Loopback, an RFC 1918 IPv4 address (`10/8`, `172.16/12`, `192.168/16`), or a `.local` mDNS host. */
export const isLocalAddrUrl = (url: RelayUrl): boolean => {
  const host = hostOf(url)
  return isLoopbackUrl(url) || host.endsWith(".local") || (isIpv4(host) && PRIVATE_IPV4_REGEX.test(host))
}

/** `ws://` and not an onion host. */
export const isInsecureUrl = (url: RelayUrl): boolean => url.startsWith("ws://") && !isOnionUrl(url)
