/* Answers the admin's /api calls from the saved copies; refuses every write. */
const BASE = "/restaurant-demo-preview", NOTE = "This is a read-only preview. Changes are not saved.";
let man = null; const load = () => (man ||= fetch(BASE + "/rec/manifest.json").then((r) => r.json()).catch(() => ({})));
let pho = null; const photos = () => (pho ||= fetch(BASE + "/rec/photos.json").then((r) => r.json()).catch(() => ({})));
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  const p = u.pathname.startsWith(BASE + "/") ? u.pathname.slice(BASE.length) : u.pathname;
  if (u.searchParams.has("_rsc")) return e.respondWith(new Response("", { status: 404 }));
  if (!(p.startsWith("/api/") || p === "/admin-manifest" || p.startsWith("/_next/image") || p.startsWith("/fonts/"))) {
    if (!u.pathname.startsWith(BASE + "/") && p.startsWith("/_next/")) return e.respondWith(fetch(BASE + p + u.search));
    return;
  }
  if (e.request.method !== "GET") return e.respondWith(json({ error: NOTE }, 403));
  if (p.startsWith("/_next/image")) { const m = (u.searchParams.get("url") || "").match(/\/api\/public\/media\/([0-9a-f-]{36})/); return e.respondWith(photos().then((ph) => (m && ph[m[1]] ? fetch(BASE + "/media/" + ph[m[1]]) : new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#d9cbb8"/></svg>', { headers: { "content-type": "image/svg+xml" } })))); }
  e.respondWith(load().then((m) => { const q = [...u.searchParams].filter(([k]) => k !== "_rsc" && k !== "_t"), k = p + (q.length ? "?" + new URLSearchParams(q) : ""), hit = m[k]; return hit ? fetch(BASE + "/rec/" + hit.file) : json({ error: "Not part of the preview" }, 404); }));
});
