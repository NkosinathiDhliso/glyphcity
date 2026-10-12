import type { OrderMode } from '@area-code/shared/constants/ranking'
import type { Translate } from '@area-code/shared/lib/accessibleNodeName'
import { api } from '@area-code/shared/lib/api'
import { useErrorStore } from '@area-code/shared/stores/errorStore'
import { useUserStore } from '@area-code/shared/stores/userStore'
import type { User } from '@area-code/shared/types'

/**
 * The one write path for the browse order (vibe-order-toggle R2.3, R3.2).
 * The store holds the choice for every visitor; a signed-in visitor's choice
 * also goes to the user record so web and mobile agree.
 */

/** PATCH the record. Throws on failure so the caller surfaces it. */
async function saveToRecord(mode: OrderMode): Promise<void> {
  await api.patch('/v1/users/me', { orderMode: mode })
  useUserStore.setState((state) => {
    if (state.user) state.user.orderMode = mode
  })
}

function reportSaveFailed(t: Translate): void {
  useErrorStore.getState().showError(t('map.order.saveFailed', "Couldn't save your order choice"))
}

/**
 * Apply a choice now and, when signed in, save it. A failed save keeps the
 * local choice and tells the visitor; the next change retries.
 */
export async function chooseOrderMode(mode: OrderMode, t: Translate): Promise<void> {
  const store = useUserStore.getState()
  store.setOrderMode(mode)
  if (!store.user) return
  try {
    await saveToRecord(mode)
  } catch {
    reportSaveFailed(t)
  }
}

/** Users reconciled in this page lifetime. */
const reconciled = new Set<string>()

/**
 * Two homes, one owner (vibe-order-toggle R3.2). On the first server profile
 * of a page lifetime, a stored choice wins; with none, the local choice goes
 * up once. Later refreshes leave the local choice alone, so a failed save is
 * not undone by the next fetch.
 */
export async function reconcileOrderMode(profile: User, t: Translate): Promise<void> {
  if (reconciled.has(profile.id)) return
  reconciled.add(profile.id)
  if (profile.orderMode) {
    useUserStore.getState().setOrderMode(profile.orderMode)
    return
  }
  try {
    await saveToRecord(useUserStore.getState().orderMode)
  } catch {
    reportSaveFailed(t)
  }
}
