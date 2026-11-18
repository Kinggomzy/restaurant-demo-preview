/* Static preview: answers the website's /api/public requests from saved files; writes are switched off. */
(() => {
  const real = window.fetch.bind(window), NOTE = "This is a read-only preview of the website. Bookings, orders and sign-in are switched off.";
  const json = (o, status) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url, m = String(url).match(/^\/api\/public(\/[^?#]*)/);
    if (!m) return real(input, init);
    if (((init && init.method) || "GET").toUpperCase() !== "GET") return Promise.resolve(json({ error: NOTE }, 403));
    return real("data" + m[1] + ".json").then(async (r) => {
      if (!r.ok) return json({ error: "Not available in the preview" }, 404);
      if (m[1] !== "/hours" && m[1] !== "/fulfilment") return r;
      const d = await r.json(), now = new Date().toISOString(); if ("at" in d) d.at = now; if ("now" in d) d.now = now; return json(d, 200);
    });
  };
})();
