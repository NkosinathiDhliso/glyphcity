import { Wordmark } from '@area-code/shared/components/Wordmark'
import { APP_NAME, APP_URL, BRAND_LINE, BUSINESS_URL, SUPPORT_EMAIL } from '@area-code/shared/constants/brand'
import { PLAIN_SCALE_EN, stateLabelKey, toNodeState } from '@area-code/shared/constants/state-labels'
import { api } from '@area-code/shared/lib/api'
import { recordEvent } from '@area-code/shared/lib/rum'
import { trackEvent } from '@area-code/shared/lib/usageEvents'
import { useQuery } from '@tanstack/react-query'
import { Zap, Sparkles, UtensilsCrossed, Coffee, Moon, ShoppingBag, Dumbbell, Palette, MapPin } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { SkyHeader } from '../components/SkyHeader'
import { DEFAULT_ARCHETYPE_ID } from '../lib/carouselConstants'
import type { AppRoute } from '../types'

interface AuthLandingProps {
  onNavigate: (route: AppRoute) => void
}

interface TrendingSpot {
  name: string
  area: string
  state: string
  checkIns: number
  nodeId?: string
  slug?: string
  category?: string
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  coffee: Coffee,
  nightlife: Moon,
  retail: ShoppingBag,
  fitness: Dumbbell,
  arts: Palette,
}

// The three-step "how it works" shown high on the landing page. Copy lives
// behind i18n keys with inline English fallbacks.
const HOW_IT_WORKS = [
  {
    Icon: MapPin,
    titleKey: 'landing.step1Title',
    titleFallback: 'Open the map',
    bodyKey: 'landing.step1Body',
    bodyFallback: 'See what’s busy near you.',
  },
  {
    Icon: Zap,
    titleKey: 'landing.step2Title',
    titleFallback: 'Check in',
    bodyKey: 'landing.step2Body',
    bodyFallback: 'Tap in when you arrive.',
  },
  {
    Icon: Sparkles,
    titleKey: 'landing.step3Title',
    titleFallback: 'Earn rewards',
    bodyKey: 'landing.step3Body',
    bodyFallback: 'Unlock perks. Climb the board.',
  },
] as const

export function AuthLanding({ onNavigate }: AuthLandingProps) {
  const { t } = useTranslation()

  const { data: trendingData } = useQuery({
    queryKey: ['trending'],
    queryFn: () => api.get<{ items: TrendingSpot[] }>('/v1/nodes/trending'),
    staleTime: 60_000,
    retry: 1,
  })

  const trending = trendingData?.items ?? []
  const hasLiveData = trendingData?.items !== undefined

  const go = (route: AppRoute, path: string) => {
    window.history.pushState({ route }, '', path)
    onNavigate(route)
  }

  // Funnel: landing view. Read alongside the CTA events below to measure whether
  // the clearer hero lifts comprehension (Path A: measure before/after, not a
  // split test, until traffic supports one). No-op when RUM is not configured.
  useEffect(() => {
    recordEvent('landing_view')
    // Signup-funnel entry: the auth landing / auth gate is on screen. The usage
    // beacon gates this on consent, so an anonymous session emits nothing
    // (audit-gap-closure R4.1, R4.2).
    trackEvent('auth_gate_shown')
  }, [])

  return (
    <div className="relative h-full overflow-y-auto bg-[var(--bg-base)] text-[var(--text-primary)]">
      <div
        className="relative mx-auto w-full max-w-md flex flex-col min-h-full px-5"
        style={{
          paddingTop: 'max(3rem, env(safe-area-inset-top))',
          paddingBottom: '2rem',
        }}
      >
        {/* Sky header with a representative Cone_Node as brand art (R5.5). A
            fixed state and category, not a real venue, so it claims no presence. */}
        <SkyHeader
          nodeId="brand-art"
          category="nightlife"
          state="popping"
          archetypeId={DEFAULT_ARCHETYPE_ID}
          height={160}
          className="mb-8"
        >
          <Wordmark size="md" className="px-4 pt-3" />
          {/* Brand_Line: landing, share cards and OG image only (R5.9). */}
          <p className="px-4 pt-1 font-sans text-sm text-[var(--text-secondary)]">{BRAND_LINE}</p>
        </SkyHeader>

        {/* Hero */}
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-[-0.01em]">
          {t('landing.heroLine1', 'Find the spots')}
          <span className="block text-[var(--accent-bright)]">{t('landing.heroLine2', 'buzzing right now.')}</span>
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs">
          {t('landing.subtitle', 'See which bars, cafés and clubs are alive near you | right now.')}
        </p>

        {/* How it works: the quick idea, before we ask for anything. The deeper
            "About" and live "Trending" sections below are the drill-down. */}
        <div className="mt-6 flex flex-col gap-3">
          {HOW_IT_WORKS.map(({ Icon, titleKey, titleFallback, bodyKey, bodyFallback }) => (
            <div key={titleKey} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/15 ring-1 ring-[var(--border)]">
                <Icon size={18} strokeWidth={1.75} className="text-[var(--accent-bright)]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{t(titleKey, titleFallback)}</p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-snug">{t(bodyKey, bodyFallback)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs - lead with the low-friction value action (see the live map)
            and keep sign-up as the secondary step, per landing-page attention-
            ratio / show-value-before-commitment research. */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              recordEvent('landing_cta_explore', { source: 'hero' })
              go('map', '/map')
            }}
            className="flex-1 rounded-xl bg-[var(--accent)] py-3.5 text-sm font-semibold text-[var(--on-accent)] transition-all active:scale-95 hover:bg-[var(--accent-bright)]"
          >
            {t('landing.exploreMap', 'Explore Map')}
          </button>
          <button
            onClick={() => {
              recordEvent('landing_cta_signin')
              go('login', '/login')
            }}
            className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] py-3.5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
          >
            {t('landing.signIn', 'Sign In')}
          </button>
        </div>

        {/*
          About section.

          Required by Google's OAuth brand-verification policy
          (https://support.google.com/cloud/answer/13464321):
            - "The homepage must accurately represent and identify your app or brand"
            - "The homepage must describe your app's functionality to its users.
               Your homepage can not be only a login page"

          Without this block, the page reads as a sign-in/sign-up surface and
          the brand-verification reviewer rejects with "home page does not
          explain the purpose of your app" and "home page is behind a login page".
          Do not remove unless replacing with equivalent prose.
        */}
        <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <h2 className="font-display text-base font-bold mb-2">About {APP_NAME}</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {APP_NAME} is a real-time venue discovery and rewards app for South Africa. It shows a live map of cafes,
            restaurants, bars, and nightlife in Johannesburg, Cape Town, and Durban, with each venue&apos;s status (from
            quiet to very busy) updated as customers check in.
          </p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-2">
            Customers check in when they arrive at a venue to earn rewards from that venue, climb local leaderboards,
            and discover places that match their taste. Sign in with Google or with email and password. No phone number
            required.
          </p>
        </section>

        {/* Trending now */}
        {trending.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono font-medium tracking-widest text-[var(--text-muted)] uppercase">
                {t('landing.trendingNow', 'Trending Now')}
              </span>
              {hasLiveData && (
                <span className="rounded-full bg-[var(--success)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--success)] animate-pulse">
                  {t('landing.live', 'Live')}
                </span>
              )}
            </div>
            {trending.slice(0, 5).map((spot) => {
              const CategoryIcon = CATEGORY_ICONS[spot.category ?? ''] ?? MapPin
              const labelKey = stateLabelKey(toNodeState(spot.state))

              return (
                <button
                  key={spot.nodeId ?? spot.name}
                  onClick={() => {
                    recordEvent('landing_cta_explore', { source: 'trending', nodeId: spot.nodeId })
                    go('map', '/map')
                  }}
                  className="w-full flex items-center justify-between rounded-xl bg-[var(--bg-raised)] px-3 py-2.5 mb-2 last:mb-0 text-left transition-all hover:border-[var(--accent)] border border-transparent group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CategoryIcon
                      size={16}
                      strokeWidth={1.5}
                      className="text-[var(--text-secondary)] shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold group-hover:text-[var(--accent)]">{spot.name}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{spot.area}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-1.5">
                    <div>
                      <p className="text-xs font-medium">{t(labelKey, PLAIN_SCALE_EN[labelKey])}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {t('landing.checkIns', { count: spot.checkIns, defaultValue: `${spot.checkIns} check-ins` })}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Bottom links */}
        <div className="mt-auto pt-8 flex flex-col items-center gap-2">
          <p className="text-[11px] text-[var(--text-secondary)]">Cape Town · Johannesburg · Durban</p>
          {/*
            Legal footer.
            Required by the OAuth brand-verification policy: "You must add the
            link of your privacy policy to your homepage and this link should
            match the link you added on your OAuth consent screen configuration".
            The Privacy Policy URL configured in Google Cloud → Branding is
            https://glyphcity.com/legal/privacy (APP_URL). Keep these in sync.
          */}
          <nav aria-label="Legal" className="mt-3 flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
            <a
              href={`${APP_URL}/legal/privacy`}
              onClick={(e) => {
                e.preventDefault()
                go('legal-privacy', '/legal/privacy')
              }}
              className="hover:text-[var(--accent)] underline underline-offset-2"
            >
              Privacy Policy
            </a>
            <span aria-hidden="true">·</span>
            <a
              href={`${APP_URL}/legal/terms`}
              onClick={(e) => {
                e.preventDefault()
                go('legal-terms', '/legal/terms')
              }}
              className="hover:text-[var(--accent)] underline underline-offset-2"
            >
              Terms
            </a>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[var(--accent)] underline underline-offset-2">
              Contact
            </a>
            <span aria-hidden="true">·</span>
            {/*
              Discoverable, low-key entry point to the business portal. Lives
              here (not in the sign-up sheet, not in the hero CTAs) so that a
              business owner who lands on the consumer site can still find
              their way to the business portal, without surfacing the
              business path to ordinary customers. Uses a regular external
              link so the subdomain handles its own auth flow.
            */}
            <a href={BUSINESS_URL} className="hover:text-[var(--accent)] underline underline-offset-2">
              For businesses →
            </a>
          </nav>
        </div>
      </div>
    </div>
  )
}
