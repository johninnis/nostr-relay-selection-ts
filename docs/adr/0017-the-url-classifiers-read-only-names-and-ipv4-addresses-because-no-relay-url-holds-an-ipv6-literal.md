# 17. The URL classifiers read only names and IPv4 addresses, because no relay URL holds an IPv6 literal

## Status

Accepted

## Context

The URL classifiers (`isOnionUrl`, `isLoopbackUrl`, `isLocalAddrUrl`, `isInsecureUrl` in TypeScript; `RelayUrl::isOnion`, `isLoopback`, `isLocalAddr`, `isInsecure` in PHP) take a relay URL and inspect its host. Earlier versions also counted `::1` as loopback, and a reader expects an IPv6 loopback, link-local or unique-local address to be classified like its IPv4 counterpart.

None can reach a classifier. A classifier takes a `RelayUrl`, and a `RelayUrl` is only ever the normaliser's output (ADR-0005). The normaliser, as the shared canonical form decides (nostr-adrs ADR-0002), refuses a malformed host, and a host is letters, digits, dots and hyphens: a bracketed IPv6 literal such as `ws://[::1]` is refused in both ports. The `::1` check was dead code, and it did not even match, since a URL parser reports that host as `[::1]`.

## Decision

The classifiers match a host only as a name or a dotted-quad IPv4 address: loopback is `localhost` or `127.0.0.0/8`, a local address is loopback, `10/8`, `172.16/12`, `192.168/16` or a `.local` name. They have no IPv6 rules, because no relay URL holds an IPv6 address.

## Consequences

- The corpus pins the refusal this rests on: a `build-relay-set.json` vector keeps no relay from `ws://[::1]`, `ws://[::1]:7777` or `wss://[2001:db8::1]`.
- If the shared canonical form ever accepts IPv6 literals, that change lands in the corpus first, and the classifiers gain IPv6 loopback and local ranges in the same change, with their own vectors. Until then, do not add IPv6 rules a relay URL can never reach.
