import type { NoDmRelaysFailure } from "./types.ts"

/** The one refusal value: what `routePublish` and `routeRead` return when a DM has no relay to use (NIP-17: no fallback). */
export const NO_DM_RELAYS: NoDmRelaysFailure = Object.freeze({ failure: "noDmRelays" })
