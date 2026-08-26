// Every backend response is wrapped the same way — { success, data } or
// { success: false, error }. RTK Query endpoints unwrap `data` themselves
// via `transformResponse`, so each module's Api file works with these
// directly. This is the one type genuinely shared across every module —
// domain types (Account, Student, etc.) live inside their own module folder.
export interface ApiEnvelope<T> {
  success: boolean
  data: T
}
