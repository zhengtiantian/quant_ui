/**
 * Shared fetch wrapper that attaches the access token to every platform API call.
 *
 * Why this exists (R.5 phase 1). The API had `.anyRequest().permitAll()`, so almost
 * nothing required a token, and only two of eight API modules bothered to send one.
 * Tightening the server first would have broken every page and every MCP tool at once,
 * so the order is: make clients carry credentials while the server still permits all,
 * then require them. Adding the credential before requiring it is the only sequence
 * that has no broken window in the middle.
 *
 * Centralising it also removes the failure mode where a module added later simply
 * forgets: modules cannot opt in one at a time if there is only one way to call the API.
 *
 * Note on where the token comes from: `AuthController` proxies a password grant to
 * Keycloak and the browser keeps the result in localStorage. Both halves of that are
 * weaker than they look — the password grant is deprecated in OAuth 2.1 precisely
 * because it makes the app handle the user's password, and a token in localStorage is
 * readable by any XSS. Replacing it with an authorization-code + PKCE flow (which is
 * what the unused `keycloak-js` dependency is for) is tracked separately; this wrapper
 * deliberately hides *where* the token comes from so that change touches one file.
 */

const TOKEN_KEY = "token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  // Declared explicitly rather than as constructor parameter properties: this project
  // builds with `erasableSyntaxOnly`, which rejects any TypeScript syntax that emits
  // runtime code.
  status: number;
  path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

/**
 * Fetch a platform API path with credentials attached.
 *
 * A 401 clears the stored token and reports it as such rather than surfacing a generic
 * failure — "Failed to fetch signals" sends the user looking for an outage when the real
 * answer is that their session expired.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    clearToken();
    throw new ApiError("Session expired — sign in again", 401, path);
  }
  if (res.status === 403) {
    throw new ApiError("Not permitted for this account", 403, path);
  }
  if (!res.ok) {
    // Prefer the server's own message: ApiExceptionHandler returns a reason for 400 and
    // 404, and discarding it in favour of a generic string throws away the one piece of
    // information that would tell the user what to change.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.message || body?.error || "";
    } catch {
      /* body was not JSON; the status alone is what we have */
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status, path);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
