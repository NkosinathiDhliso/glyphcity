/**
 * Brand_Constants: the one home for the product name, domain and brand line.
 * Every user-facing surface (i18n, HTML title, manifest, emails, share
 * builders, legal text) reads these. Never write the values as literals
 * elsewhere; `scripts/check-brand-strings.mjs` enforces that.
 */

/** Product name shown in every portal, email and link. */
export const APP_NAME = 'GlyphCity' as const

/**
 * Spoken short name. Never use it alone to mean the app in a sentence that
 * also refers to a glyph (Requirement 1.8); use APP_NAME there instead.
 */
export const SPOKEN_NAME = 'Glyph' as const

/** The single product domain. */
export const APP_DOMAIN = 'glyphcity.com' as const

/** Consumer web origin. Every absolute app link, QR code and share URL starts here. */
export const APP_URL = `https://${APP_DOMAIN}` as const

/** Business portal origin. */
export const BUSINESS_URL = `https://business.${APP_DOMAIN}` as const

/** Public API origin. */
export const API_URL = `https://api.${APP_DOMAIN}` as const

/**
 * Mail domain for the contact mailboxes. Area Code's company mail stays on
 * areacode.co.za (decision 4 in docs/decisions/glyphcity-rebrand.md);
 * glyphcity.com sends mail but receives none. Change it here, once, when a
 * glyphcity.com inbox exists.
 */
export const CONTACT_MAIL_DOMAIN = 'areacode.co.za' as const

export const SUPPORT_EMAIL = `support@${CONTACT_MAIL_DOMAIN}` as const
export const PRIVACY_EMAIL = `privacy@${CONTACT_MAIL_DOMAIN}` as const
export const LEGAL_EMAIL = `legal@${CONTACT_MAIL_DOMAIN}` as const

/**
 * Operating company. Legal text only (Requirements 1.3, 1.4); never a
 * product name. Stays 'Area Code' until the CIPC registered name is supplied
 * (docs/decisions/glyphcity-rebrand.md, decision 2).
 */
export const COMPANY_NAME = 'Area Code' as const

/**
 * i18next `interpolation.defaultVariables` for every app. Locale strings
 * write `{{appName}}`; this is the one place the variable is bound.
 */
export const BRAND_I18N_VARIABLES = { appName: APP_NAME } as const

/** Brand line used on share cards, OG image and landing. */
export const BRAND_LINE = 'Check the beams.' as const
