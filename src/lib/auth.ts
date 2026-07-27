/**
 * Anonymous user ID for request-scoped ownership.
 * No login: client sends X-Anonymous-Id (from localStorage); we scope projects by it.
 */
const ANON_ID_HEADER = "x-anonymous-id";

export function getAnonymousId(request: Request): string | null {
  return request.headers.get(ANON_ID_HEADER)?.trim() || null;
}

export function getAnonymousIdOrEmpty(request: Request): string {
  return getAnonymousId(request) ?? "";
}

/**
 * Projects with ownerId === "" are treated as "unclaimed" and visible to everyone.
 * Projects with ownerId set are only visible to that anonymous user.
 */
export function canAccessProject(projectOwnerId: string, requestAnonymousId: string | null): boolean {
  if (projectOwnerId === "") return true;
  return requestAnonymousId !== null && projectOwnerId === requestAnonymousId;
}
