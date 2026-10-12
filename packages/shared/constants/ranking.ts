// The browse order a guest chooses (north-star-alignment decision 1,
// vibe-order-toggle). Pure data, so the web ranker and the backend gets ranker
// read the same two modes. `busy` is aliveness first, taste second; `crowd` is
// taste first, aliveness second. Everything below those two levels is the same
// in both modes.

export const ORDER_MODES = ['busy', 'crowd'] as const

export type OrderMode = (typeof ORDER_MODES)[number]

/** Unset anywhere reads as busy: the north star is the live map of busy rooms. */
export const DEFAULT_ORDER_MODE: OrderMode = 'busy'

export function isOrderMode(value: unknown): value is OrderMode {
  return typeof value === 'string' && (ORDER_MODES as readonly string[]).includes(value)
}
