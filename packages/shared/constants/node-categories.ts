import type { NodeCategory } from '../types'

export const NODE_CATEGORIES: readonly { value: NodeCategory; label: string; colour: string }[] = [
  { value: 'food', label: 'Food', colour: 'var(--node-food)' },
  { value: 'coffee', label: 'Coffee', colour: 'var(--node-coffee)' },
  { value: 'nightlife', label: 'Nightlife', colour: 'var(--node-nightlife)' },
  { value: 'retail', label: 'Retail', colour: 'var(--node-retail)' },
  { value: 'fitness', label: 'Fitness', colour: 'var(--node-fitness)' },
  { value: 'arts', label: 'Arts', colour: 'var(--node-arts)' },
] as const

const CATEGORY_LABELS = Object.fromEntries(NODE_CATEGORIES.map((c) => [c.value, c.label])) as Record<
  NodeCategory,
  string
>

/** i18n key for a category word, e.g. `map.categories.nightlife`. */
export function categoryLabelKey(category: NodeCategory): string {
  return `map.categories.${category}`
}

/** English category word, the i18n default for {@link categoryLabelKey}. */
export function categoryLabel(category: NodeCategory): string {
  return CATEGORY_LABELS[category]
}
