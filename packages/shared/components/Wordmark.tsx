import { APP_NAME } from '../constants/brand'

/** Wordmark sizes. Static classes so Tailwind can see them. */
const SIZE_CLASS = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-3xl',
} as const

export type WordmarkSize = keyof typeof SIZE_CLASS

interface WordmarkProps {
  size?: WordmarkSize
  className?: string
}

/**
 * The wordmark (glyphcity-rebrand R5.7): APP_NAME lowercase in Funnel Display
 * 800, tracking -0.05em, in ink. Screen readers hear the Brand_Name as written.
 * Web only: `apps/mobile` does not import `packages/shared/components`.
 */
export function Wordmark({ size = 'md', className = '' }: WordmarkProps) {
  return (
    <span
      role="img"
      aria-label={APP_NAME}
      className={`font-display font-extrabold tracking-[-0.05em] leading-none text-[var(--text-primary)] ${SIZE_CLASS[size]} ${className}`.trim()}
    >
      {APP_NAME.toLowerCase()}
    </span>
  )
}
