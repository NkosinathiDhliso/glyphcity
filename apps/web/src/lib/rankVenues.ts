import { useLocationStore, useMapStore } from '@area-code/shared/stores'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { Node } from '@area-code/shared/types'

import { canRecenter } from './cameraControl'
import { vibeRank } from './carouselRanking'

/**
 * `vibeRank` over the live store snapshots: the one way a surface orders
 * venues (map markers, carousel, Point_Mode). Reads at call time so ranking
 * always sees the latest pulse, presence, taste and live-gets signals.
 */
export function rankVenuesFromStores(venues: Node[]): Node[] {
  const mapState = useMapStore.getState()
  const location = useLocationStore.getState()
  return vibeRank({
    venues,
    pulseScores: mapState.pulseScores,
    checkInCounts: mapState.checkInCounts,
    lastKnownPosition: location.lastKnownPosition,
    positionFresh: canRecenter(location.capturedAt, Date.now()),
    consumerArchetypeId: useUserStore.getState().user?.archetypeId ?? null,
    venueArchetypeIds: mapState.archetypeIds,
    friendsAtVenue: mapState.friendsAtVenue,
    hasLiveGets: mapState.hasLiveGets,
  })
}
