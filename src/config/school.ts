/**
 * The school's own name, printed as the letterhead on fee receipts and
 * statements.
 *
 * Read from the frontend's .env rather than the API on purpose: a printed
 * receipt must never wait on a network call for its letterhead, and a failed
 * request would otherwise hand a parent a receipt with no school name on it.
 * The trade is that changing the name needs a rebuild.
 *
 * The fallback is deliberately obvious rather than a plausible-looking name —
 * a receipt reading "SCHOOL NAME NOT CONFIGURED" gets fixed immediately,
 * where a quietly wrong name gets printed for a term before anyone notices.
 */
export const schoolName = import.meta.env.VITE_SCHOOL_NAME?.trim() || 'SCHOOL NAME NOT CONFIGURED'
