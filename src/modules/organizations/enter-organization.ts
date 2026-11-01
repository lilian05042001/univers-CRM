/**
 * Intră în organizația devenită activă printr-o navigare completă: layout-ul, permisiunile
 * și datele se încarcă proaspăt, fără rute din cache-ul routerului (vezi actions.ts).
 */
export function enterOrganization() {
  // Intenționat nu router.push(): routerul ar refolosi un redirect /dashboard → /onboarding din cache.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/dashboard")
}
