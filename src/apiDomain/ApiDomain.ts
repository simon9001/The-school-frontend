// Backend base URL. Read from the environment so a deployed build points at the
// real API — a hardcoded localhost resolves to the *visitor's* machine, not the
// server, and an https:// site is blocked from calling http:// at all.
// Set VITE_API_DOMAIN in the Vercel/Netlify dashboard; the fallback below is
// only for local development.
export const apiDomain =
  import.meta.env.VITE_API_DOMAIN ?? 'http://localhost:4100/api/'
