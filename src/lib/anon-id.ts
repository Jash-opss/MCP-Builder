const STORAGE_KEY = "mcp_builder_anon_id";

/** Get or create an anonymous user id (client-side only). Persisted in localStorage. */
export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Headers to send with project API requests so the server can scope by owner. */
export function projectApiHeaders(): Record<string, string> {
  const id = getAnonymousId();
  return id ? { "X-Anonymous-Id": id } : {};
}
