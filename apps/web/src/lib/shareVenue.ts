import { api } from '@area-code/shared/lib/api'
import { clipboardFailureCopy, copyToClipboard } from '@area-code/shared/lib/clipboard'
import { useErrorStore } from '@area-code/shared/stores/errorStore'
import type { Node } from '@area-code/shared/types'
import type { TFunction } from 'i18next'

import { APP_SHARE_URL } from './shareCard'

/**
 * Share a venue: the native share sheet when there is one, else copy the link.
 * The one share path for venue detail and Point_Mode.
 */
export function shareVenue(node: Node, t: TFunction): void {
  const url = `${APP_SHARE_URL}/node/${node.slug}`
  // Tag the venue's own social handle in the share text so a customer's post
  // credits the venue (word-of-mouth that points back, not just a link out).
  const links = node.socialLinks ?? {}
  const primaryHandle = links.instagram ?? links.tiktok ?? links.x ?? links.facebook ?? links.youtube
  const shareText = primaryHandle
    ? t('share.venueTagged', { name: node.name, handle: `@${primaryHandle}` })
    : t('share.venue', { name: node.name })
  // Record a completed share so the venue's weekly digest can show an honest
  // "shares recorded" count. Fire-and-forget beacon, never blocks the share
  // and never surfaces an error to the user.
  const recordShare = () => {
    void api.post(`/v1/nodes/${node.id}/share`, {}).catch(() => {})
  }
  // Two surfaces, neither guaranteed. The native share sheet is absent on
  // desktop browsers, and `navigator.clipboard` is absent (not merely
  // blocked) on an insecure origin and inside the in-app webviews a
  // consumer arrives through. Ask before calling, and when neither exists
  // say so rather than throwing a TypeError that reads as a crash (R15.22).
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    void navigator.share({ title: node.name, text: shareText, url }).then(recordShare, () => {})
    return
  }
  void copyToClipboard(url).then((outcome) => {
    const failure = clipboardFailureCopy(outcome)
    if (failure) {
      useErrorStore.getState().showError(failure)
      return
    }
    recordShare()
    useErrorStore.getState().showError(t('share.copied', 'Link copied'))
  })
}
