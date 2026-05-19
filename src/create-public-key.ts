import type { PublicKey } from "./types.ts"

const PUBKEY_REGEX = /^[0-9a-f]{64}$/

/**
 * Validate a hex string and brand it as `PublicKey`. Returns `null` for any
 * input that is not exactly 64 lowercase hex characters.
 */
export const createPublicKey = (hex: string): PublicKey | null =>
  PUBKEY_REGEX.test(hex) ? hex as PublicKey : null
