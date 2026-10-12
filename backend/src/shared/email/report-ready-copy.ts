import { APP_NAME } from '@area-code/shared/constants/brand'

/**
 * Copy for the report-ready email, one home (north-star-alignment R7.3).
 *
 * Kept apart from the SES sender so the honest-copy property test can import
 * every sentence the email renders. The renderer in `ses.ts` adds only the
 * greeting name, the link and the reference id. This email may name the report
 * (R7.2); it still says what was recorded, never what was caused.
 */
export interface ReportReadyCopy {
  subject: string
  heading: string
  textIntro: string
  textCta: string
  htmlIntro: string
  button: string
  referenceLabel: string
}

export function buildReportReadyCopy(periodType: string): ReportReadyCopy {
  const period = periodType === 'monthly' ? 'monthly' : 'weekly'
  return {
    subject: `Your ${APP_NAME} report is ready`,
    heading: 'Your report is ready',
    textIntro: `Your ${period} ${APP_NAME} intelligence report is ready.`,
    textCta: 'Open the Reports panel to see your latest crowd insights:',
    htmlIntro: `your ${period} ${APP_NAME} intelligence report is ready with your latest crowd insights.`,
    button: 'Open Reports',
    referenceLabel: 'Report reference:',
  }
}
