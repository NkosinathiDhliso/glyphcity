/**
 * Ground colours (`--bg-base`) per theme, for places CSS variables cannot
 * reach: the `theme-color` meta, the PWA manifest and the pre-hydration
 * `<html>` backstop. Pinned to `tokens.css` by a parity test.
 * Dark is Veld night, light is Lichen (Outdoor_Palette).
 */
export const THEME_GROUND = {
  dark: '#090e0c',
  light: '#edf0e8',
} as const
