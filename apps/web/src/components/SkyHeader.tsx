import type { NodeCategory, NodeState } from '@area-code/shared/types'
import type { ReactNode } from 'react'

import { ConeNodeMount } from './ConeNodeMount'

export interface SkyHeaderProps {
  nodeId: string
  category: NodeCategory
  state: NodeState
  archetypeId: string
  score?: number
  /** Header height in px. Kept compact so the detail CTA stays reachable. */
  height?: number
  /** Optional overlay content (for example the wordmark on the auth landing). */
  children?: ReactNode
  className?: string
}

/** Fixed star field, percent positions in the upper sky. Static by design. */
const STARS: ReadonlyArray<{ left: number; top: number; size: number }> = [
  { left: 8, top: 14, size: 2 },
  { left: 19, top: 32, size: 1 },
  { left: 27, top: 9, size: 1.5 },
  { left: 38, top: 24, size: 1 },
  { left: 61, top: 12, size: 1.5 },
  { left: 70, top: 30, size: 1 },
  { left: 79, top: 8, size: 2 },
  { left: 88, top: 22, size: 1 },
  { left: 94, top: 38, size: 1.5 },
]

/** Ridge silhouette on a 100 by 40 box, stretched to the header width. */
const RIDGE_PATH = 'M0 26 C12 18 20 22 30 17 C40 12 48 20 58 18 C70 15 78 8 88 14 C94 17 97 20 100 19 L100 40 L0 40 Z'

/** Share of the header height the ridge occupies. */
const RIDGE_SHARE = 0.32

/**
 * Dawn (light) or Dusk (dark) sky with a ridge and the venue's own Cone_Node
 * (glyphcity-rebrand R5.5). Colours come only from the sky tokens; stars use
 * `--star`, which has zero alpha in light, so they show only at dusk. The node
 * is built by the map's marker builder through {@link ConeNodeMount}, and the
 * whole header is decorative (`aria-hidden`).
 */
export function SkyHeader({
  nodeId,
  category,
  state,
  archetypeId,
  score = 0,
  height = 136,
  children,
  className = '',
}: SkyHeaderProps) {
  const ridgeHeight = Math.round(height * RIDGE_SHARE)
  // The cone tip sits on the ridge's shoulder, so the node rises out of the ground.
  const nodeHeight = height - Math.round(ridgeHeight * 0.4) - 8

  return (
    <div
      data-testid="sky-header"
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      style={{
        height,
        background: 'linear-gradient(to bottom, var(--sky-top), var(--sky-mid) 55%, var(--sky-horizon))',
      }}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {STARS.map((s) => (
          <span
            key={`${s.left}-${s.top}`}
            data-star
            className="absolute rounded-full"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              background: 'var(--star)',
            }}
          />
        ))}
        <svg
          className="absolute bottom-0 left-0 w-full"
          style={{ height: ridgeHeight }}
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          focusable="false"
        >
          <path d={RIDGE_PATH} fill="var(--ridge)" />
        </svg>
        <div
          className="absolute inset-x-0 flex flex-row justify-center"
          style={{ bottom: Math.round(ridgeHeight * 0.4) }}
        >
          <ConeNodeMount
            nodeId={nodeId}
            category={category}
            state={state}
            archetypeId={archetypeId}
            score={score}
            height={nodeHeight}
          />
        </div>
      </div>
      {children && <div className="relative flex h-full flex-col">{children}</div>}
    </div>
  )
}
