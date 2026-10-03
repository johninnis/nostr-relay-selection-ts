const isCount = (value: number): boolean => Number.isInteger(value) && value >= 1

export const requireCount = (name: string, value: number): number => {
  if (!isCount(value)) throw new RangeError(`${name} must be a positive integer, got ${value}`)
  return value
}

export const requireCountOrAll = (name: string, value: number): number => {
  if (value !== Number.POSITIVE_INFINITY && !isCount(value)) {
    throw new RangeError(`${name} must be a positive integer or Infinity, got ${value}`)
  }
  return value
}
