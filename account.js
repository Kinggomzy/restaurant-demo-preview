/* Guest account on the restaurant's own guest API: email + 6 digit code sign-in, profile, bookings and orders, rewards, preferences, privacy.
   Nothing is stored here except the short-lived session token; all records live in the restaurant's database. */
(() => {
  const root = document.querySelector("[data-app=account]"); if (!root) return;
  const H = window.HV, { $, $$, esc, store, notice, draft, validate, enhance, gbp, ICON, api, tokenStore, signedIn, refreshAcct, BRAND } = H;
  const A = (m, p, b) => api(m, "/guest" + p, b, { auth: true });
  const code6 = (s) => (s || "").replace(/\D/g, "").slice(0, 6);
  const day = (t) => { try { return new Date(t).toLocaleDateString(BRAND.locale, { day: "numeric", month: "long", year: "numeric", timeZone: BRAND.tz }); } catch { return ""; } };
  const dt = (t) => { try { return new Date(t).toLocaleString(BRAND.locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: BRAND.tz }); } catch { return ""; } };
  const nice = (s) => String(s || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  const tabs = [["overview", "Overview"], ["bookings", "Bookings and orders"], ["rewards", "Rewards"], ["preferences", "Preferences"], ["details", "My details"], ["privacy", "Privacy and data"]];
  const alias = { "": "overview", data: "privacy", orders: "bookings" };
  let flash = "", mode = "form", pending = null, me = null;
  const busy = (b, on, t) => { if (!b) return; if (on) { b.dataset.l = b.innerHTML; b.disabled = true; b.textContent = t; } else { b.disabled = false; if (b.dataset.l) b.innerHTML = b.dataset.l; } };
  const csv = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

  /* ---------- Signed out ---------- */
  function signedOut(msg) {
    root.innerHTML = `<div class="split center acct-out"><div class="stack-md"><span class="label">${mode === "form" ? "Welcome" : "Check your email"}</span><h2 class="h2">Sign in to <em>your table.</em></h2>
      <p class="muted">No password. We email you a 6 digit code. New here? The same steps create your account.</p>
      <ul class="ticks"><li>See your bookings, tickets and orders</li><li>Earn and spend rewards points</li><li>Save dietary needs and allergies</li><li>Your details pre-fill every form</li></ul></div>
      <div class="box">${mode === "form" ? `<form class="form" id="auth" novalidate>${msg ? notice("err", msg) : ""}<div class="form-grid">
        <div class="field full"><label for="a-e">Email</label><input class="input" id="a-e" type="email" data-v="email" autocomplete="email" placeholder="you@example.com" required></div></div>
        <div class="acts"><button class="btn solid">Email me a code ${ICON.arrow}</button></div></form>` : `
      <form class="form" id="code" novalidate>${msg ? notice("err", msg) : notice("ok", pending.sent ? `We sent a 6 digit code to <b>${esc(pending.email)}</b>. It works for 10 minutes.` : `We could not email a code because this restaurant has not set up outgoing email yet. Please contact the restaurant.`)}
        <div class="form-grid" style="margin-top:18px"><div class="field"><label for="a-c">6 digit code</label><input class="input" id="a-c" data-v="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" data-nodraft="1" required style="letter-spacing:.4em;font-size:2rem"></div>
        <div class="field"><label for="a-n">Your name <span class="faint">(only if you are new)</span></label><input class="input" id="a-n" autocomplete="name" data-nodraft="1" placeholder="Alex Morgan"></div></div>
        <div class="acts"><button class="btn solid">Confirm</button><button type="button" class="link" id="a-back">Use another email</button></div></form>`}</div></div>`;
    const f = $("#auth");
    if (f) { draft.bind(f, "auth"); f.onsubmit = async (e) => { e.preventDefault(); if (!validate(f)) return; const email = $("#a-e").value.trim(), b = $("button", f); busy(b, true, "Sending…"); const r = await api("POST", "/guest/verify/start", { email }); busy(b, false); if (!r.ok) return signedOut(r.data.error || "We could not send a code. Please try again."); pending = { email, sent: r.data.sent }; mode = "code"; signedOut(); }; }
    const c = $("#code");
    if (c) {
      enhance(c); $("#a-c").addEventListener("input", (e) => { e.target.value = code6(e.target.value); }); $("#a-c").focus();
      $("#a-back").onclick = () => { mode = "form"; signedOut(); };
      c.onsubmit = async (e) => {
        e.preventDefault(); if (!validate(c)) return; const b = $("button", c), name = $("#a-n").value.trim(); busy(b, true, "Checking…");
        const r = await api("POST", "/guest/verify/confirm", { email: pending.email, code: $("#a-c").value, ...(name ? { displayName: name } : {}) }); busy(b, false);
        if (!r.ok) return signedOut(r.data.error || "That code did not work. Check it or ask for a new one.");
        tokenStore.set(r.data.token); const m = await A("GET", "/me"); if (m.ok) store.set("user", { name: m.data.profile.display_name, email: m.data.profile.email, phone: m.data.profile.phone || "" });
        draft.clear("auth"); mode = "form"; pending = null; refreshAcct(); flash = `Welcome${m.ok ? ", " + String(m.data.profile.display_name).split(" ")[0] : ""}.`; location.hash = ""; render();
      };
    }
  }

  /* ---------- Signed in ---------- */
  const rows = (list, f) => list.length ? `<div class="lines">${list.map(f).join("")}</div>` : "";
  const panels = {
    overview: (d) => `<div class="grid-4 acct-stats">${[[d.summary.reservations, "bookings"], [d.summary.orders, "orders"], [d.summary.tickets, "ticket orders"], [d.points.toLocaleString(BRAND.locale), "points"]].map(([n, l]) => `<div class="box flat"><b class="num" style="font:400 2.4rem/1 var(--display)">${n}</b><div class="small muted">${l}</div></div>`).join("")}</div>
      <section class="box flat"><span class="label">Quick links</span><div class="acts" style="margin-top:18px"><a class="btn quiet sm" href="book.html">Book a table</a>${(H.SITE?.modules || []).includes("ordering") ? `<a class="btn quiet sm" href="order.html">Order online</a>` : ""}<a class="btn quiet sm" href="queue.html">Join the queue</a><a class="btn quiet sm" href="events.html">Events</a><a class="btn quiet sm" href="gift-cards.html">Gift card balance</a></div></section>`,
    bookings: (d) => { const r = d.records || {};
      return `<section class="box flat"><div class="head-row" style="margin-bottom:6px"><div><span class="label">Bookings</span></div><a class="btn sm" href="book.html">New booking</a></div>${rows(r.reservations || [], (x) => `<div><span><span class="nm">${esc(dt(x.starts_at))}</span><br><span class="small muted">${x.party_size} ${x.party_size === 1 ? "guest" : "guests"} · ${esc(String(x.id).slice(0, 8).toUpperCase())}</span></span><span class="tag ${x.status === "cancelled" ? "" : "gold"}">${esc(nice(x.status))}</span></div>`) || `<p class="muted" style="margin-top:14px">No bookings yet.</p>`}</section>
        <section class="box flat"><span class="label">Pickup and delivery orders</span>${rows(r.takeaway || [], (x) => `<div><span><span class="nm">${esc(nice(x.kind))} · ${esc(dt(x.created_at))}</span><br><span class="small muted">${gbp(x.total_minor)}</span></span><span class="tag">${esc(nice(x.fulfilment))}</span></div>`) || `<p class="muted" style="margin-top:14px">No orders yet.</p>`}</section>
        <section class="box flat"><span class="label">Tickets</span>${rows(r.tickets || [], (x) => `<div><span><span class="nm">${x.quantity} ${x.quantity === 1 ? "ticket" : "tickets"} · ${esc(dt(x.created_at))}</span><br><span class="small muted">${gbp(x.total_minor)}</span></span><span class="tag">${esc(nice(x.status))}</span></div>`) || `<p class="muted" style="margin-top:14px">No ticket orders yet.</p>`}</section>
        ${(r.enquiries || []).length ? `<section class="box flat"><span class="label">Private dining enquiries</span>${rows(r.enquiries, (x) => `<div><span class="nm">${x.party_size} guests · ${esc(day(x.desired_date))}</span><span class="tag">${esc(nice(x.status))}</span></div>`)}</section>` : ""}`; },
    rewards: (d) => { const L = d.loyalty;
      if (!L.enabled) return `<section class="box flat"><span class="label">Rewards</span><p class="muted" style="margin-top:14px">This restaurant has not switched on a rewards programme.</p></section>`;
      return `<section class="box flat"><span class="label">Your points</span><div class="split center" style="margin-top:20px"><div><div class="big-num" style="font-size:5rem">${L.points.toLocaleString(BRAND.locale)}</div><p class="muted">points${L.tier ? ` · <span class="gold">${esc(L.tier)} member</span>` : ""}${L.valueMinor ? ` · worth ${gbp(L.valueMinor)}` : ""}${L.expiryDays ? ` · points expire after ${L.expiryDays} days` : ""}</p></div>
        <div class="stack-md">${L.nextTier ? `<p>Spend ${gbp(L.nextTier.needMinor)} more to reach <b>${esc(L.nextTier.name || "")}</b>.</p>` : ""}</div></div>
        ${L.referral ? `<div class="split" style="margin-top:30px"><div class="stack-sm"><span class="tag gold">Your code to share</span><div class="copy-row"><b style="font:400 1.8rem var(--display);letter-spacing:.1em">${esc(L.referral.code)}</b><button type="button" data-copy="${esc(L.referral.code)}">Copy</button></div><p class="small muted">You each get ${L.referral.rewardPoints} points after your friend's first visit.</p></div>
        <form class="stack-sm" id="ref" novalidate><div class="field"><label for="r-c">Have a friend's code?</label><input class="input" id="r-c" style="text-transform:uppercase" data-nodraft="1" autocomplete="off"></div><div id="ref-msg"></div><button class="btn sm quiet" style="justify-self:start">Use code</button></form></div>` : ""}</section>
        ${(L.history || []).length ? `<section class="box flat"><span class="label">Points activity</span>${rows(L.history, (h) => `<div><span class="nm">${esc(h.reason || nice(h.kind || "Points"))}</span><span class="num">${h.points > 0 ? "+" : ""}${h.points}</span></div>`)}</section>` : ""}`; },
    preferences: (d) => { const c = Object.fromEntries((d.consents || []).map((x) => [x.purpose, x.granted])), p = d.preferences || {}, o = d.occasions || [];
      return `<section class="box flat"><span class="label">How we may contact you</span><div class="stack-md" style="margin-top:20px">${[["transactional", "Messages about my bookings and orders", "Confirmations, reminders and changes."], ["marketing", "Offers and news", "Off unless you switch it on."], ["occasion_offers", "Birthday and occasion offers", "Only if you have saved a date below."]].map(([k, t, s]) => `<label class="check"><input type="checkbox" data-consent="${k}" ${c[k] ? "checked" : ""}><span><b>${t}</b><br><span class="small muted">${s}</span></span></label>`).join("")}</div></section>
      <section class="box flat"><span class="label">Food preferences</span><form class="form" id="food" novalidate style="margin-top:20px"><div class="form-grid"><div class="field"><label for="f-d">Dietary needs</label><input class="input" id="f-d" value="${esc((p.dietary || []).join(", "))}" placeholder="Vegetarian, halal"><span class="hint">Separate with commas.</span></div><div class="field"><label for="f-a">Allergies</label><input class="input" id="f-a" value="${esc((p.allergies || []).join(", "))}" placeholder="Peanuts, shellfish"></div><div class="field"><label for="f-s">Seating</label><input class="input" id="f-s" value="${esc(p.seating || "")}" maxlength="200" placeholder="Quiet corner"></div><div class="field full"><label for="f-n">Anything else</label><textarea class="textarea" id="f-n" maxlength="1000">${esc(p.notes || "")}</textarea></div></div><div class="acts"><button class="btn sm">Save preferences</button></div></form></section>
      <section class="box flat"><span class="label">Birthday and occasions (optional)</span>${rows(o, (x, i) => `<div><span class="nm">${esc(nice(x.kind))}${x.label ? " · " + esc(x.label) : ""} · ${x.day}/${x.month}</span><button class="link" data-rm="${o.indexOf(x)}">Remove</button></div>`)}
        <form class="acts" id="occ" style="margin-top:18px" novalidate><select class="select" id="o-k" aria-label="Occasion" style="width:auto"><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="other">Other</option></select><select class="select" id="o-m" aria-label="Month" style="width:auto">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${new Date(2000, i, 1).toLocaleString("en", { month: "long" })}</option>`).join("")}</select><input class="input" id="o-d" type="number" min="1" max="31" placeholder="Day" aria-label="Day" required style="width:90px" data-nodraft="1"><button class="btn sm quiet">Add</button></form></section>`; },
    details: (d) => `<section class="box flat"><span class="label">My details</span><form class="form" id="me" novalidate style="margin-top:20px"><div class="form-grid">
        <div class="field"><label for="d-n">Full name</label><input class="input" id="d-n" data-v="name" autocomplete="name" value="${esc(d.profile.display_name)}" required></div>
        <div class="field"><label for="d-e">Email</label><input class="input" id="d-e" type="email" value="${esc(d.profile.email || "")}" readonly aria-readonly="true"><span class="hint">To change your email, ask us under Privacy and data.</span></div>
        <div class="field"><label for="d-p">Mobile</label><input class="input" id="d-p" data-v="phone" type="tel" autocomplete="tel" value="${esc(d.profile.phone || "")}" placeholder="+44 7700 900123"></div></div>
        <div class="acts"><button class="btn sm">Save changes</button></div></form></section>
      <section class="box flat"><span class="label">Session</span><p class="muted" style="margin-top:14px">For your safety you are signed out after 30 minutes.</p><div class="acts" style="margin-top:16px"><button class="btn quiet sm" id="out">Sign out</button></div></section>`,
    privacy: (d) => `<section class="box flat"><span class="label">Your rights</span><p class="muted" style="margin-top:14px">See, correct, download or erase what we hold about you.</p><div class="acts" style="margin-top:20px"><button class="btn quiet sm" id="dl">Download my data</button><button class="btn quiet sm" id="fix">Ask for a correction</button><button class="btn quiet sm" id="erase">Delete my data</button></div><div id="rights"></div></section>
      ${(d.requests || []).length ? `<section class="box flat"><span class="label">Your requests</span>${rows(d.requests, (r) => `<div><span class="nm">${r.kind === "erase" ? "Erase my data" : "Correction"} · ${esc(day(r.created_at))}</span><span class="tag">${esc(nice(r.status))}${r.status === "open" && r.due_at ? ` · due ${esc(day(r.due_at))}` : ""}</span></div>`)}</section>` : ""}`,
  };

  async function render() {
    if (!signedIn()) { tokenStore.del(); store.del("user"); refreshAcct(); return signedOut(); }
    const keyRaw = location.hash.slice(1); let key = alias[keyRaw] ?? keyRaw; if (!panels[key]) key = "overview";
    root.innerHTML = `<div class="box"><span class="label">Loading your account…</span></div>`;
    const [m, ex, lo] = await Promise.all([A("GET", "/me"), key === "bookings" ? A("GET", "/me/export") : Promise.resolve(null), key === "rewards" ? A("GET", "/me/loyalty") : Promise.resolve(null)]);
    if (!m.ok) { if (m.status === 401) { flash = ""; return signedOut("Your session ended. Please sign in again."); } return (root.innerHTML = notice("err", m.data.error || "We could not load your account. Please try again.")); }
    me = { ...m.data, records: ex?.ok ? ex.data.records : undefined, loyalty: lo?.ok ? lo.data : undefined };
    const u = me.profile, first = String(u.display_name).split(" ")[0];
    root.innerHTML = `${flash ? notice("ok", flash) : ""}<div class="stack-lg" style="margin-top:${flash ? 22 : 0}px"><section class="box acct-head"><div class="avatar" aria-hidden="true">${esc(first[0].toUpperCase())}</div><div><span class="label">${me.points.toLocaleString(BRAND.locale)} points</span><h2 class="h2">${esc(first)} <em>welcome back.</em></h2><p class="muted">${esc(u.email || "")}${u.created_at ? ` · member since ${esc(day(u.created_at))}` : ""}</p></div></section>
      <nav class="subnav acct-nav" aria-label="Account sections">${tabs.map(([k, l]) => `<a href="#${k}" ${k === key ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
      <div class="stack-lg" id="panel">${panels[key](me)}</div></div>`;
    flash = ""; wire();
  }
  const ok = (r, again) => { if (r.ok) { flash = again || "Saved."; return render(); } if (r.status === 401) return render(); const m = notice("err", r.data.error || "We could not save that. Please try again."); $("#panel").insertAdjacentHTML("afterbegin", m); };
  function wire() {
    $$("[data-consent]").forEach((c) => c.onchange = async () => ok(await A("PUT", "/me/consents", { purpose: c.dataset.consent, granted: c.checked, source: "guest-site account" })));
    if ($("#ref")) $("#ref").onsubmit = async (e) => { e.preventDefault(); const v = $("#r-c").value.trim().toUpperCase(); if (!v) return; const r = await A("POST", "/me/referral", { code: v }); $("#ref-msg").innerHTML = r.ok ? notice("ok", "Code added. You both get points after the first visit.") : notice("err", r.data.error || "We could not use that code."); };
    if ($("#food")) { enhance($("#food")); $("#food").onsubmit = async (e) => { e.preventDefault(); ok(await A("PUT", "/me/preferences", { dietary: csv($("#f-d").value), allergies: csv($("#f-a").value), seating: $("#f-s").value.trim() || null, notes: $("#f-n").value.trim() || null }), "Preferences saved."); }; }
    const occs = () => (me.occasions || []).map((o) => ({ kind: o.kind, ...(o.label ? { label: o.label } : {}), month: o.month, day: o.day }));
    $$("[data-rm]").forEach((b) => b.onclick = async () => { const l = occs(); l.splice(Number(b.dataset.rm), 1); ok(await A("PUT", "/me/occasions", { occasions: l })); });
    if ($("#occ")) { enhance($("#occ")); $("#occ").onsubmit = async (e) => { e.preventDefault(); if (!validate($("#occ"))) return; ok(await A("PUT", "/me/occasions", { occasions: [...occs(), { kind: $("#o-k").value, month: Number($("#o-m").value), day: Number($("#o-d").value) }] })); }; }
    if ($("#me")) { draft.bind($("#me"), "me"); $("#me").onsubmit = async (e) => { e.preventDefault(); if (!validate($("#me"))) return; const p = $("#d-p").value.trim(); const r = await A("PATCH", "/me", { displayName: $("#d-n").value.trim().replace(/\s+/g, " "), phone: p || null }); if (r.ok) { draft.clear("me"); store.set("user", { name: $("#d-n").value.trim(), email: me.profile.email, phone: p }); refreshAcct(); } ok(r, "Details saved."); }; }
    if ($("#out")) $("#out").onclick = async () => { await A("DELETE", "/me/session"); tokenStore.del(); store.del("user"); refreshAcct(); flash = ""; location.hash = ""; render(); };
    if ($("#dl")) $("#dl").onclick = async () => { const r = await A("GET", "/me/export"); if (!r.ok) return ($("#rights").innerHTML = notice("err", "We could not prepare your data. Please try again.")); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" })); a.download = "my-data.json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
    const ask = (kind, html, lead) => { $("#rights").innerHTML = html; const f = $("#rf"); if (f) enhance(f); $("#rf-no").onclick = () => { $("#rights").innerHTML = ""; }; f.onsubmit = async (e) => { e.preventDefault(); if (!validate(f)) return; const t = $("#rt")?.value.trim(); const r = await A("POST", "/me/requests", { kind, ...(t ? { details: t } : {}) }); if (r.ok) { flash = lead; return render(); } $("#rights").insertAdjacentHTML("afterbegin", notice("err", r.data.error || "We could not send that request.")); }; };
    if ($("#fix")) $("#fix").onclick = () => ask("correct", `<form class="form" id="rf" style="margin-top:18px" novalidate><div class="field"><label for="rt">What should we correct?</label><textarea class="textarea" id="rt" required maxlength="2000"></textarea></div><div class="acts"><button class="btn sm">Send request</button><button type="button" class="link" id="rf-no">Cancel</button></div></form>`, "Request sent. We will reply within 30 days.");
    if ($("#erase")) $("#erase").onclick = () => ask("erase", `<form id="rf" class="notice err" style="margin-top:18px" novalidate>${ICON.err}<div class="stack-sm"><span>Ask the restaurant to erase your personal data? Records they must keep stay, without your name and contact details. This cannot be undone once done.</span><div class="acts"><button class="btn sm">Yes, delete my data</button><button type="button" class="link" id="rf-no">Keep my account</button></div></div></form>`, "Request sent. We will confirm once it is done.");
  }
  addEventListener("hashchange", () => { if (signedIn()) render(); });
  H.ready.then(() => render());
})();
