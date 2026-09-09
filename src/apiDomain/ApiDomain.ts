// Backend base URL. Endpoints are declared relative to this (e.g. 'auth/login'),
// and the backend mounts every route under /api — so the trailing '/api/' and
// its final slash are both load-bearing.
//
// Picked by build mode: `vite build` gets production, `vite dev` gets localhost.
// A hardcoded localhost in a deployed build would resolve to the *visitor's*
// machine, and an https:// page is blocked from calling http:// at all.
//
// VITE_API_DOMAIN overrides both, for pointing a build at a staging API.
const PRODUCTION_API = 'https://ipsus-ready-school-management-system.onrender.com/api/'
const DEVELOPMENT_API = 'http://localhost:4100/api/'

export const apiDomain =
  import.meta.env.VITE_API_DOMAIN ??
  (import.meta.env.PROD ? PRODUCTION_API : DEVELOPMENT_API)
