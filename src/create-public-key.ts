import type { EventId, PublicKey } from "./types.ts"

const HEX_64_REGEX = /^[0-9a-f]{64}$/

const isPublicKey = (hex: string): hex is PublicKey => HEX_64_REGEX.test(hex)

const isEventId = (hex: string): hex is EventId => HEX_64_REGEX.test(hex)

/**
 * Validate a hex string and brand it as `PublicKey`. Returns `null` for any
 * input that is not exactly 64 lowercase hex characters.
 */
export const createPublicKey = (hex: string): PublicKey | null => isPublicKey(hex) ? hex : null

/**
 * Validate a hex string and brand it as `EventId`. Returns `null` for any
 * input that is not exactly 64 lowercase hex characters.
 */
export const createEventId = (hex: string): EventId | null => isEventId(hex) ? hex : null
