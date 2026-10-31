// Sign-in token helpers (2026-10-31): the same dashboard is opened on this Mac and from home devices
// (iPad, phone). quant_ai and the job_agent dashboard serve this machine freely and a home device only
// with a valid Keycloak token: sent as a Bearer header on API calls, and as the qt_token cookie for the
// embedded Jobs / Budget / Time pages (an iframe cannot add headers; cookies ignore the port).
import React from "react";
import { jwtDecode } from "jwt-decode";

const KEYCLOAK_TOKEN_URL = `${window.location.protocol}//${window.location.hostname}:18082/realms/quant/protocol/openid-connect/token`;
const REFRESH_EVERY_MS = 4 * 60 * 1000;

/** quant_ai and the job_agent dashboard on the host this page was opened from. */
export const hostUrl = (port: number) => `${window.location.protocol}//${window.location.hostname}:${port}`;

const expiry = (token: string | null): number => {
    if (!token) return 0;
    try {
        return jwtDecode<{ exp?: number }>(token).exp ?? 0;
    } catch {
        return 0;
    }
};

export const tokenValid = (token: string | null = localStorage.getItem("token")) => expiry(token) > Date.now() / 1000 + 5;

export function syncTokenCookie(): void {
    const token = localStorage.getItem("token");
    const left = Math.floor(expiry(token) - Date.now() / 1000);
    document.cookie = token && left > 0
        ? `qt_token=${token}; path=/; max-age=${left}; SameSite=Lax`
        : "qt_token=; path=/; max-age=0; SameSite=Lax";
}

export function authHeaders(): Record<string, string> {
    const token = localStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

export function signOut(): void {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    syncTokenCookie();
}

/** Swap the refresh token for a new access token; false when the session is over. */
export async function refreshToken(): Promise<boolean> {
    const refresh = localStorage.getItem("refresh_token");
    if (!refresh) return false;
    const params = new URLSearchParams({ grant_type: "refresh_token", client_id: "quant-ui", refresh_token: refresh });
    try {
        const res = await fetch(KEYCLOAK_TOKEN_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params,
        });
        if (!res.ok) return false;
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        syncTokenCookie();
        return true;
    } catch {
        return false;
    }
}

/** Keeps the session alive while the dashboard is open: refreshes now if the access token has
 *  lapsed (a tablet that slept), then every 4 minutes. Returns whether the token is usable yet. */
export function useSession(): boolean {
    const [ready, setReady] = React.useState(() => tokenValid());
    React.useEffect(() => {
        let stopped = false;
        const end = () => {
            signOut();
            window.location.replace("/");
        };
        const tick = async () => {
            if (await refreshToken()) {
                if (!stopped) setReady(true);
            } else if (!tokenValid()) {
                end();
            }
        };
        syncTokenCookie();
        if (!tokenValid()) void tick();
        const id = window.setInterval(tick, REFRESH_EVERY_MS);
        return () => {
            stopped = true;
            window.clearInterval(id);
        };
    }, []);
    return ready;
}

