// REST client. URLs are RELATIVE to the ingress prefix: HA serves the UI
// under a dynamic path, so we derive the base from the current location and
// prepend it to every request (parity with the original app.js §1).

export const API_BASE = document.location.pathname.replace(/\/$/, "");

export async function apiGet(path) {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

export async function apiPost(path, body = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => null);
    throw new Error(data?.error || `API error: ${resp.status}`);
  }
  return resp.json();
}

export async function apiPut(path, body = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => null);
    throw new Error(data?.error || `API error: ${resp.status}`);
  }
  return resp.json();
}
