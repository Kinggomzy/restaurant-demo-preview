/* Template 001 live flows: book a table, walk-in queue, private enquiry, event tickets, contact forms and gift card balance.
   Everything here talks to the restaurant's own system through window.HV.api (the tenant runtime's /api/public). Nothing is simulated. */
(() => {
  const H = window.HV; if (!H) return;
  const { $, $$, esc, store, notice, success, draft, validate, api, gbp, ICON, BRAND, LOCS, POLICY } = H;
  const pages = (H.pages = H.pages || {});
  const pad = (n) => String(n).padStart(2, "0");
  const short = (id) => String(id).slice(0, 8).toUpperCase();
  const empty = (t) => `<p class="muted">${esc(t)}</p>`;
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* ---- time in the restaurant's own time zone ---- */
  const offsetMin = (tz, d) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {}); return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - d.getTime()) / 6e4); };
  /** "2026-11-20" + "19:30" in the restaurant's zone -> { date: Date, iso: "2026-11-20T19:30:00+05:30" } */
  function zoned(day, time) {
    const guess = new Date(`${day}T${time}:00Z`), off = offsetMin(BRAND.tz, new Date(guess - offsetMin(BRAND.tz, guess) * 6e4)), ms = guess - off * 6e4, a = Math.abs(off);
    return { date: new Date(ms), iso: `${day}T${time}:00${off < 0 ? "-" : "+"}${pad(Math.floor(a / 60))}:${pad(a % 60)}` };
  }
  const todayIn = () => new Intl.DateTimeFormat("en-CA", { timeZone: BRAND.tz }).format(new Date());
  const addDays = (day, n) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dayIndex = (day) => (new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7;
  const longWhen = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: BRAND.tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(/,?( at)? (\d\d:\d\d)$/, " at $2");
  const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const hhmm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const slotsFor = (loc, day, stay) => {
    const out = []; for (const [a, b] of loc.hours[dayIndex(day)] || []) { const s = mins(a); let e = mins(b); if (e <= s) e += 1440; for (let t = s; t + Math.min(stay, 60) <= e; t += 30) out.push(t); }
    return [...new Set(out)].sort((x, y) => x - y).map(hhmm);
  };
  const flash = (form, kind, text) => { $(".notice", form)?.remove(); form.insertAdjacentHTML("afterbegin", notice(kind, text)); $(".notice", form).scrollIntoView({ block: "nearest", behavior: "smooth" }); };
  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.textContent = label || "Please wait…"; } else { btn.disabled = false; if (btn.dataset.l) btn.innerHTML = btn.dataset.l; } };
  const hist = { all: () => store.get("bookings", []), put(b) { const l = this.all().filter((x) => x.id !== b.id); l.unshift(b); store.set("bookings", l.slice(0, 20)); } };

  /* ================= Book a table ================= */
  pages.book = (root) => {
    let res = store.get("booking", null), timer;
    const steps = (n) => `<ol class="steps">${["Your table", "Hold", "Confirmed"].map((s, i) => `<li class="${i < n ? "done" : i === n ? "on" : ""}"><b>${i + 1}</b><span>${s}</span></li>`).join("")}</ol>`;
    const draw = (h) => { root.innerHTML = h; root.scrollIntoView({ block: "start" }); };
    const p = new URLSearchParams(location.search);

    function form(msg) {
      clearInterval(timer);
      if (!LOCS.length) return draw(notice("err", "Online booking is not available right now. Please call the restaurant."));
      const dr = draft.get("book"), max = POLICY.maxPartySize || 12, today = todayIn();
      draw(`${steps(0)}<form class="form box" id="bf" novalidate style="margin-top:26px">${msg ? notice("err", msg) : ""}
        <div class="form-grid">
        <div class="field"><label for="b-loc">Restaurant</label><select class="select" id="b-loc">${LOCS.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></div>
        <div class="field"><span class="lbl" id="b-party-l">Guests</span><div class="stepper" role="group" aria-labelledby="b-party-l"><button type="button" data-step="-1" aria-label="Fewer guests">−</button><output id="b-party">2</output><button type="button" data-step="1" aria-label="More guests">+</button></div><span class="hint" id="b-party-hint">Online bookings for up to ${max}. Larger groups: <a class="textlink" href="enquiry.html">private dining enquiry</a>.</span></div>
        <div class="field"><label for="b-date">Date</label><input class="input" type="date" id="b-date" min="${today}" max="${addDays(today, POLICY.maxAdvanceDays || 90)}" value="${today}" required></div>
        <div class="field"><label for="b-stay">Stay</label><select class="select" id="b-stay"><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option></select></div>
        <div class="field full"><span class="lbl">Time</span><div class="slots" id="b-slots" role="group" aria-label="Choose a time"></div><span class="hint" id="b-slot-hint"></span></div>
        <div class="field"><label for="b-name">Your name</label><input class="input" id="b-name" autocomplete="name" data-fill="name" data-v="name" minlength="2" required placeholder="Alex Morgan"></div>
        <div class="field"><label for="b-contact">Phone or email</label><input class="input" id="b-contact" autocomplete="email" data-fill="contact" data-v="contact" placeholder="you@example.com or 07700 900123" required><span class="hint">Only used for this booking.</span></div>
        <label class="check full"><input type="checkbox" id="b-consent" required> I agree to be contacted about this booking.</label>
        </div><div class="acts"><button class="btn solid" type="submit">Find a table ${ICON.arrow}</button><a class="link" href="queue.html">Or join the walk-in queue</a></div></form>`);
      const f = $("#bf"); draft.bind(f, "book");
      if (!dr["b-date"]) { const l0 = LOCS.find((l) => l.id === $("#b-loc").value); for (let i = 0; i < 14; i++) { const d = addDays(today, i); if (slotsFor(l0, d, 60).some((t) => zoned(d, t).date.getTime() > Date.now() + (POLICY.minNoticeMinutes || 15) * 6e4)) { $("#b-date").value = d; break; } } }
      let party = Math.min(max, Math.max(1, Number(dr._party ?? p.get("size")) || 2)), slot = dr._slot || null;
      $("#b-party").textContent = party; if (!$("#b-stay").value || !dr["b-stay"]) $("#b-stay").value = String(POLICY.durationMinutes || 90);
      const hint = () => $("#b-party-hint").classList.toggle("gold", party >= max);
      const paint = () => {
        const loc = LOCS.find((l) => l.id === $("#b-loc").value), day = $("#b-date").value, stay = Number($("#b-stay").value);
        const list = day ? slotsFor(loc, day, stay) : [], soonest = Date.now() + (POLICY.minNoticeMinutes || 15) * 6e4;
        const ok = list.filter((t) => zoned(day, t).date.getTime() >= soonest);
        if (!ok.includes(slot)) slot = null;
        $("#b-slots").innerHTML = list.map((t) => `<button type="button" data-t="${t}" aria-pressed="${t === slot}" ${ok.includes(t) ? "" : 'disabled title="Not available"'}>${t}</button>`).join("");
        $("#b-slot-hint").textContent = !list.length ? `${loc.name} is closed that day. Try another date.` : !ok.length ? "No more times today. Try another date." : "";
        $$("#b-slots button").forEach((b) => b.onclick = () => { slot = b.dataset.t; draft.put("book", "_slot", slot); $$("#b-slots button").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#b-slot-hint").textContent = ""; });
      };
      hint(); paint(); ["b-loc", "b-date", "b-stay"].forEach((id) => $("#" + id).addEventListener("change", paint));
      $$("[data-step]", f).forEach((b) => b.onclick = () => { party = Math.min(max, Math.max(1, party + Number(b.dataset.step))); $("#b-party").textContent = party; draft.put("book", "_party", party); hint(); });
      f.onsubmit = async (e) => {
        e.preventDefault(); if (!validate(f)) return;
        if (!slot) return flash(f, "err", "Please choose a time.");
        const loc = LOCS.find((l) => l.id === $("#b-loc").value), z = zoned($("#b-date").value, slot), btn = $("button[type=submit]", f);
        busy(btn, true, "Finding a table…");
        const r = await api("POST", "/reservations", { locationId: loc.id, partySize: (party = Number($("#b-party").textContent) || party), startsAt: z.iso, durationMinutes: Number($("#b-stay").value), guestName: $("#b-name").value.trim(), guestContact: $("#b-contact").value.trim(), consentToContact: true });
        busy(btn, false);
        if (!r.ok) return flash(f, "err", r.data.error || "We could not hold a table. Please try another time.");
        const x = r.data.reservation;
        res = { id: x.id, token: r.data.token, status: "held", party, loc: loc.name, when: longWhen(z.date), startsAt: z.date.toISOString(), name: $("#b-name").value.trim(), until: Date.parse(x.hold_expires_at) || Date.now() + (POLICY.holdMinutes || 10) * 6e4, policy: r.data.policy || POLICY.text || "" };
        store.set("booking", res); draft.clear("book"); hist.put({ id: res.id, ref: short(res.id), party, loc: res.loc, when: res.when, startsAt: res.startsAt, status: "held" }); show();
      };
    }

    function held() {
      draw(`${steps(1)}<div class="box" style="margin-top:26px"><div class="split center"><div class="stack-md"><span class="label">Table held</span><h2 class="h2">${res.party} ${res.party === 1 ? "guest" : "guests"}, <em>${esc(res.when)}</em></h2><p class="muted">${esc(res.loc)}. We are holding a table while you confirm.</p>${res.policy ? `<p class="small faint">${esc(res.policy)}</p>` : ""}</div>
        <div class="stack-md" style="justify-items:start"><span class="tag">Time left to confirm</span><div class="timer" id="timer" aria-live="off">10:00</div><div id="b-msg" style="width:100%"></div><div class="acts"><button class="btn solid" id="b-confirm">Confirm booking</button><button class="btn quiet" id="b-release">Release</button></div></div></div></div>`);
      const tick = () => { const s = Math.max(0, Math.round((res.until - Date.now()) / 1000)); $("#timer").textContent = `${Math.floor(s / 60)}:${pad(s % 60)}`; $("#timer").classList.toggle("low", s < 60); if (!s) { clearInterval(timer); setStatus("expired"); res = null; store.del("booking"); form("Your hold expired. Please choose a time again."); } };
      clearInterval(timer); timer = setInterval(tick, 1000); tick();
      $("#b-confirm").onclick = async (e) => { busy(e.currentTarget, true, "Confirming…"); const r = await api("POST", `/reservations/${res.id}/confirm`, { token: res.token }); if (!r.ok) { busy(e.currentTarget, false); $("#b-msg").innerHTML = notice("err", r.data.error || "We could not confirm. Please try again."); if (r.status === 404) { clearInterval(timer); store.del("booking"); res = null; form("That hold has expired. Please choose a time again."); } return; } clearInterval(timer); res.status = "confirmed"; store.set("booking", res); setStatus("confirmed"); show(); };
      $("#b-release").onclick = async () => { clearInterval(timer); await api("POST", `/reservations/${res.id}/cancel`, { token: res.token }); setStatus("cancelled"); store.del("booking"); res = null; form(); };
    }
    const setStatus = (s) => { if (res) hist.put({ id: res.id, ref: short(res.id), party: res.party, loc: res.loc, when: res.when, startsAt: res.startsAt, status: s }); };

    function confirmed(msg) {
      draw(`${steps(3)}${msg ? notice("ok", msg) : ""}<div class="box" style="margin-top:26px"><div class="split center"><div class="stack-md"><span class="label">Confirmed</span><h2 class="h2">See you <em>${esc(res.when)}.</em></h2><p class="muted">${res.party} ${res.party === 1 ? "guest" : "guests"} at ${esc(res.loc)}, under ${esc(res.name)}. We hold the table for ${POLICY.noShowGraceMinutes || 15} minutes after your time.</p></div>
        <div class="stack-md" style="justify-items:start"><div class="lines" style="width:100%"><div><span>Free cancellation</span><span class="gold">until ${POLICY.freeCancelHours} ${POLICY.freeCancelHours === 1 ? "hour" : "hours"} before</span></div><div><span>Reference</span><span class="num">${short(res.id)}</span></div></div><div class="acts"><button class="btn quiet" id="b-cancel">Cancel reservation</button><a class="link" href="account.html#bookings">My bookings</a></div><div id="b-cancel-ask" style="width:100%"></div></div></div></div>`);
      $("#b-cancel").onclick = () => { $("#b-cancel-ask").innerHTML = `<div class="notice err">${ICON.err}<div class="stack-sm"><span>Cancel this reservation? This cannot be undone.</span><div class="acts"><button class="btn sm" id="b-yes">Yes, cancel it</button><button class="link" id="b-no">Keep it</button></div></div></div>`;
        $("#b-yes").onclick = async (e) => { busy(e.currentTarget, true, "Cancelling…"); const r = await api("POST", `/reservations/${res.id}/cancel`, { token: res.token }); if (!r.ok) { busy(e.currentTarget, false); $("#b-cancel-ask").insertAdjacentHTML("beforeend", notice("err", r.data.error || "We could not cancel. Please call the restaurant.")); return; } setStatus("cancelled"); store.del("booking"); res = null; form(); $("#bf").insertAdjacentHTML("afterbegin", notice("ok", r.data.late ? "Reservation cancelled. As it was inside the free cancellation window, the restaurant may record it as late." : "Reservation cancelled.")); };
        $("#b-no").onclick = () => { $("#b-cancel-ask").innerHTML = ""; }; };
    }
    function show() { if (!res) return form(); if (res.status === "held") return Date.now() > res.until ? (store.del("booking"), res = null, form("Your hold expired. Please choose a time again.")) : held(); confirmed(); }
    show();
  };

  /* ================= Walk-in queue ================= */
  pages.queue = (root) => {
    let q = store.get("queue", null), t;
    const mine = () => api("GET", `/queue/${q.id}?token=${encodeURIComponent(q.token)}`);
    function form(msg) {
      clearInterval(t);
      if (!LOCS.length) return (root.innerHTML = notice("err", "The walk-in queue is not available right now."));
      root.innerHTML = `<form class="form box" id="qf" novalidate>${msg ? notice("err", msg) : ""}<div class="form-grid">
        <div class="field"><label for="q-loc">Restaurant</label><select class="select" id="q-loc">${LOCS.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join("")}</select></div>
        <div class="field"><label for="q-size">Guests</label><select class="select" id="q-size">${Array.from({ length: Math.min(10, POLICY.maxPartySize || 10) }, (_, i) => `<option ${i === 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>
        <div class="field"><label for="q-name">Your name</label><input class="input" id="q-name" placeholder="Sam" autocomplete="given-name" data-fill="name" data-v="name" required></div>
        <div class="field"><label for="q-phone">Phone (optional)</label><input class="input" id="q-phone" type="tel" autocomplete="tel" data-fill="phone" placeholder="07700 900456"><span class="hint">Only if you want us to call you.</span></div>
        <label class="check full"><input type="checkbox" id="q-consent"> You may use this phone number to call me about my table.</label></div>
        <div class="acts"><button class="btn solid">Join the queue ${ICON.arrow}</button></div></form>`;
      const f = $("#qf"); draft.bind(f, "queue");
      f.onsubmit = async (e) => {
        e.preventDefault(); if (!validate(f)) return;
        const phone = $("#q-phone").value.trim(); if (phone && !$("#q-consent").checked) return flash(f, "err", "To keep your phone number, tick the box that lets us call you. Or leave the number out.");
        const btn = $("button:not([type=button])", f); busy(btn, true, "Joining…");
        const loc = LOCS.find((l) => l.id === $("#q-loc").value), body = { locationId: loc.id, partySize: Number($("#q-size").value), guestName: $("#q-name").value.trim(), consentToContact: !!phone };
        if (phone) body.guestContact = phone;
        const r = await api("POST", "/queue", body); busy(btn, false);
        if (!r.ok) return flash(f, "err", r.data.error || "We could not add you to the queue.");
        q = { id: r.data.entry.id, token: r.data.token, name: body.guestName, size: body.partySize, loc: loc.name, at: Date.parse(r.data.entry.joined_at) || Date.now() }; store.set("queue", q); draft.clear("queue"); live();
      };
    }
    async function live() {
      const v = await mine(); if (v.status === 404) { store.del("queue"); q = null; return form("Your queue place is no longer active. You can join again."); }
      const view = v.ok ? v.data : { status: "waiting", position: null, eta: null }, st = view.status;
      const done = st === "ready", over = !["waiting", "ready"].includes(st);
      const eta = view.eta ? `Typical wait ${view.eta.lowMinutes}–${view.eta.highMinutes} minutes (from ${view.eta.basedOn} recent parties).` : "We will update this page as soon as your table is ready.";
      root.innerHTML = `<div class="box" aria-live="polite"><div class="split center"><div class="stack-md">${over ? `<span class="label">Queue ${esc(st.replace(/_/g, " "))}</span><div class="big-num"><em>${st === "seated" ? "Enjoy." : "Closed."}</em></div><p class="muted">${st === "seated" ? "You have been seated. Thank you for waiting." : "This queue place is no longer active."}</p>` : done ? `<span class="label">Your table is ready</span><div class="big-num"><em>Now.</em></div><p class="muted">Please check in with the host at ${esc(q.loc)}.</p>` : `<span class="label">${esc(q.name)}, party of ${q.size} · ${esc(q.loc)}</span><div class="big-num">${view.position === 1 ? "<em>Next.</em>" : view.position ? `${view.position - 1}<em> ahead</em>` : "<em>Waiting</em>"}</div><p class="muted">${view.position === 1 ? "You're next. Head back to the restaurant." : eta}</p><span class="state gold live"><i aria-hidden="true"></i>Keep this page open. It updates by itself.</span>`}</div>
        <div class="stack-md"><div class="lines"><div><span>Joined</span><span class="num">${new Date(q.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: BRAND.tz })}</span></div><div><span>Party</span><span>${q.size}</span></div><div><span>Status</span><span class="state ${done || over ? "ok" : "gold"}"><i></i>${over ? esc(st.replace(/_/g, " ")) : done ? "Ready" : "Waiting"}</span></div></div>
        <div class="acts"><button class="btn quiet" id="q-stop">${over || done ? "Done" : "Stop tracking on this device"}</button></div></div></div></div>`;
      $("#q-stop").onclick = () => { store.del("queue"); q = null; clearInterval(t); form(); };
      clearInterval(t); if (!over) t = setInterval(live, 15000);
    }
    q ? live() : form();
  };

  /* ================= Private party enquiry ================= */
  pages.enquiry = (root) => {
    let e = store.get("enquiry", null);
    const today = todayIn();
    function form(msg) {
      root.innerHTML = `<form class="form box" id="ef" novalidate>${msg ? notice("err", msg) : ""}<div class="form-grid">
        <div class="field"><label for="e-n">Your name</label><input class="input" id="e-n" autocomplete="name" data-fill="name" data-v="name" required></div>
        <div class="field"><label for="e-g">Guests</label><input class="input" id="e-g" type="number" min="1" max="2000" value="24" inputmode="numeric" required></div>
        <div class="field"><label for="e-d">Preferred date</label><input class="input" id="e-d" type="date" min="${today}" required></div>
        <div class="field"><label for="e-c">Phone or email</label><input class="input" id="e-c" autocomplete="email" data-fill="contact" data-v="contact" required></div>
        <div class="field full"><label for="e-x">Tell us about it</label><textarea class="textarea" id="e-x" maxlength="4000" placeholder="Occasion, dietary needs, budget…"></textarea></div>
        <label class="check full"><input type="checkbox" id="e-ok" required> I agree to be contacted about this enquiry.</label></div>
        <div class="acts"><button class="btn solid">Send enquiry ${ICON.arrow}</button></div></form>`;
      const f = $("#ef"); draft.bind(f, "enquiry");
      f.onsubmit = async (ev) => {
        ev.preventDefault(); if (!validate(f)) return;
        const btn = $("button:not([type=button])", f); busy(btn, true, "Sending…");
        const body = { guestName: $("#e-n").value.trim(), guestContact: $("#e-c").value.trim(), consentToContact: true, partySize: Number($("#e-g").value), desiredDate: $("#e-d").value }; const notes = $("#e-x").value.trim(); if (notes) body.notes = notes;
        const r = await api("POST", "/enquiries", body); busy(btn, false);
        if (!r.ok) return flash(f, "err", r.data.error || "We could not send your enquiry.");
        e = { id: r.data.enquiry.id, token: r.data.token, guests: body.partySize, date: body.desiredDate, name: body.guestName }; store.set("enquiry", e); draft.clear("enquiry"); view();
      };
    }
    async function view(msg) {
      root.innerHTML = `<div class="box"><span class="label">Checking your enquiry…</span></div>`;
      const r = await api("GET", `/enquiries/${e.id}`, undefined, { bearer: e.token });
      if (r.status === 404) { store.del("enquiry"); e = null; return form("We could not find that enquiry any more. You can send a new one."); }
      const en = r.ok ? r.data.enquiry : { status: "new" }, qt = r.ok ? r.data.quotation : null, d = new Date(e.date + "T12:00:00Z");
      const status = qt ? (qt.status === "accepted" ? "accepted" : "quoted") : "new";
      const head = { new: "We have your enquiry", quoted: "Your quotation", accepted: "Quotation accepted" }[status];
      const lines = qt?.lines || [];
      root.innerHTML = `${msg ? notice("ok", msg) : ""}<div class="box" aria-live="polite" style="margin-top:${msg ? 22 : 0}px"><span class="label">${head}</span><h2 class="h2" style="margin-top:14px">${e.guests} guests · <em>${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</em></h2>
        ${!qt ? `<p class="muted" style="margin-top:16px">The team will send a quotation here, usually within one working day. Come back to this page to see it.</p><div class="acts" style="margin-top:20px"><button class="btn quiet sm" id="e-ref">Check for a quotation</button></div>` : `
        <div class="lines" style="margin-top:26px">${lines.map((l) => `<div><span class="nm">${esc(l.quantity ?? l.qty ?? 1)} × ${esc(l.description ?? l.name ?? "")}</span><span class="num">${gbp((l.totalMinor ?? (l.unitMinor ?? 0) * (l.quantity ?? 1)))}</span></div>`).join("")}<div><span>Total</span><span class="total">${gbp(qt.total_minor)}</span></div></div>
        ${qt.note ? `<p class="muted" style="margin-top:16px">${esc(qt.note)}</p>` : ""}
        ${status === "quoted" ? `<p class="small faint" style="margin-top:8px">${qt.expired ? "This quotation has expired. Please contact us." : `Valid until ${new Date(qt.valid_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: BRAND.tz })}.`}</p>${qt.expired ? "" : `<div class="acts" style="margin-top:20px"><button class="btn solid" id="e-acc">Accept quotation</button><span id="e-ask"></span></div>`}` : ""}`}
        <div class="acts" style="margin-top:26px"><button class="link" id="e-new">Start a new enquiry</button></div></div>`;
      if ($("#e-ref")) $("#e-ref").onclick = () => view();
      if ($("#e-acc")) $("#e-acc").onclick = () => { $("#e-ask").innerHTML = `<span class="small">Accept this quotation? <button class="link" id="e-yes">Yes, accept</button></span>`; $("#e-yes").onclick = async () => { const a = await api("POST", `/enquiries/${e.id}/accept`, { version: qt.version }, { bearer: e.token }); if (!a.ok) return ($("#e-ask").innerHTML = `<span class="small gold">${esc(a.data.error || "We could not accept this. Please contact us.")}</span>`); view("Accepted. The team will be in touch to finalise the details."); }; };
      $("#e-new").onclick = () => { store.del("enquiry"); e = null; form(); };
    }
    e ? view() : form();
  };

  /* ================= Takeaway and delivery ================= */
  pages.order = async (root) => {
    const cfgR = await api("GET", "/fulfilment");
    if (!cfgR.ok) return (root.innerHTML = notice("err", cfgR.status === 404 || cfgR.status === 403 ? "Online ordering is not switched on for this restaurant." : "Online ordering is unavailable right now. Please try again shortly."));
    const cfg = cfgR.data.fulfilment, kinds = [cfg.pickupEnabled && "pickup", cfg.deliveryEnabled && "delivery"].filter(Boolean);
    if (!kinds.length) return (root.innerHTML = notice("err", "Pickup and delivery are both switched off at the moment. Please call the restaurant."));
    let ord = store.get("takeaway", null), cart = store.get("cart", []), kind = kinds[0], poll;
    const total = () => cart.reduce((n, l) => n + l.unit * l.qty, 0), count = () => cart.reduce((n, l) => n + l.qty, 0);
    const save = () => store.set("cart", cart);
    let locId = (H.LOCS.find((l) => H.DISHES.some((d) => !d.unavail && d.loc === l.id)) || H.LOCS[0])?.id;
    const sold = (d) => !d.unavail && (!d.loc || d.loc === locId), cats = () => [...new Set(H.DISHES.filter(sold).map((d) => d.cat))];
    const lparts = (d) => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timezone || "Asia/Kolkata", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value])); return { date: p.year + "-" + p.month + "-" + p.day, day: String(p.weekday).toLowerCase().slice(0, 3), time: p.hour + ":" + p.minute }; };
    const openAt = (k, d) => { const { date, day, time } = lparts(d), loc = date + "T" + time, hit = (cfg.closures || []).find((c) => (c.channel === "both" || c.channel === k) && loc >= c.from && loc < c.to); if (hit) return { ok: false, why: hit.reason ? "Closed: " + hit.reason : "Closed for this time" }; const wk = cfg.hours && cfg.hours[k]; if (!wk) return { ok: true }; const w = wk[day]; if (!w) return { ok: false, why: "Not open on that day" }; return time >= w.from && time < w.to ? { ok: true } : { ok: false, why: "We take orders " + w.from + " to " + w.to + " that day" }; };
    const OS = { q: "", cat: "", sort: "menu", group: "cat" };
    const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
    const oview = () => { let l = H.DISHES.filter(sold); if (OS.cat) l = l.filter((d) => d.cat === OS.cat); if (OS.q) { const q = OS.q.toLowerCase(); l = l.filter((d) => (d.name + " " + (d.desc || "") + " " + d.cat).toLowerCase().includes(q)); } if (OS.sort === "low") l = [...l].sort((x, y) => x.price - y.price); else if (OS.sort === "high") l = [...l].sort((x, y) => y.price - x.price); else if (OS.sort === "az") l = [...l].sort((x, y) => x.name.localeCompare(y.name)); return l; };
    const TAGN = { vegetarian: "Vegetarian", vegan: "Vegan", jain: "Jain", spicy: "Spicy", gf: "Gluten free" };
    const oimg = (d, big) => { const im = d.pic || (H.catImg ? H.catImg(d.cat, !big && false) : ""); return im ? `<img src="${im}" alt="" loading="lazy" decoding="async">` : `<b>${esc(d.name.charAt(0))}</b>`; };
    const qtyOf = (slug) => cart.filter((l) => l.id === slug).reduce((n, l) => n + l.qty, 0);
    const octl = (d) => { const q = qtyOf(d.slug); return q ? `<span class="ostep" role="group" aria-label="Quantity of ${esc(d.name)}"><button type="button" data-dec="${d.slug}" aria-label="One fewer ${esc(d.name)}">−</button><output aria-live="polite">${q}</output><button type="button" data-inc="${d.slug}" aria-label="One more ${esc(d.name)}">+</button></span>` : `<button type="button" class="oadd" data-add="${d.slug}" aria-label="Add ${esc(d.name)} to your order" title="Add to order">${PLUS}</button>`; };
    const syncCards = () => $$(".ocard[data-open]").forEach((c) => { const d = H.DISHES.find((x) => x.slug === c.dataset.open), box = $(".octl", c); if (d && box) { const q = qtyOf(d.slug), has = !!$(".ostep", box); if (!!q !== has) box.innerHTML = octl(d); else if (q) $("output", box).textContent = q; c.classList.toggle("in-cart", q > 0); } });
    const orow = (d) => `<article class="ocard" tabindex="0" data-open="${d.slug}" aria-label="${esc(d.name)}, details"><div class="oimg">${oimg(d)}${d.desc ? `<p class="ohov">${esc(d.desc)}</p>` : ""}</div><div class="obody"><div class="nm">${esc(d.name)}</div><div class="obar"><span class="pr">${gbp(d.price)}</span><span class="octl">${octl(d)}</span></div></div></article>`;
    function openDrawer(d) {
      let dr = $("#o-drawer"); if (!dr) { dr = document.createElement("div"); dr.id = "o-drawer"; dr.className = "odrawer"; dr.hidden = true; document.body.appendChild(dr); }
      const tags = (d.tags || []).map((t) => TAGN[t] || t).concat(d.allergens && d.allergens.length ? [`Contains ${d.allergens.join(", ")}`] : d.reviewed ? [] : ["Allergens not confirmed"]);
      dr.innerHTML = `<div class="oscrim" data-close></div><aside role="dialog" aria-modal="true" aria-label="${esc(d.name)}"><button type="button" class="oclose" data-close aria-label="Close details">&times;</button><div class="oimg big">${oimg(d, true)}</div><div class="obody"><span class="label">${esc(d.cat)}</span><h2 class="h2">${esc(d.name)}</h2>${d.desc ? `<p class="muted">${esc(d.desc)}</p>` : ""}${tags.length ? `<p class="otags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</p>` : ""}<div class="obar"><span class="pr">${gbp(d.price)}</span><button type="button" class="btn solid" data-dadd>Add to order</button></div></div></aside>`;
      dr.hidden = false; document.body.classList.add("o-lock"); const x = $(".oclose", dr); x.focus();
      const close = () => { dr.hidden = true; document.body.classList.remove("o-lock"); document.removeEventListener("keydown", esc2); };
      const esc2 = (e) => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", esc2);
      $$("[data-close]", dr).forEach((b) => b.onclick = close);
      $("[data-dadd]", dr).onclick = () => { close(); addLine(d); };
    }
    function renderDishes() {
      const all = cats(); if (OS.cat && !all.includes(OS.cat)) OS.cat = "";
      const chips = $("#o-chips"); if (chips) chips.innerHTML = [["", "All"], ...all.map((c) => [c, c])].map(([v, t]) => `<button type="button" class="ochip" data-cat="${esc(v)}" aria-pressed="${OS.cat === v}">${esc(t)}</button>`).join("");
      const l = oview(), box = $("#dishes"); if (!box) return;
      const n = $("#o-count"); if (n) n.textContent = l.length ? `${l.length} dish${l.length === 1 ? "" : "es"}` : "";
      if (!l.length) box.innerHTML = empty(OS.q ? "No dishes match your search." : "Nothing is available to order at this restaurant right now.");
      else if (OS.group === "cat") box.innerHTML = [...new Set(l.map((d) => d.cat))].map((c) => { const rows = l.filter((d) => d.cat === c); return `<section class="ogroup"><h2 class="h3">${esc(c)} <small>${rows.length}</small></h2><div class="ogrid">${rows.map(orow).join("")}</div></section>`; }).join("");
      else box.innerHTML = `<section class="ogroup"><div class="ogrid">${l.map(orow).join("")}</div></section>`;
      box.onclick = (e) => {
        const b = e.target.closest("[data-add],[data-inc],[data-dec]"); if (!b) return; e.stopPropagation();
        const slug = b.dataset.add || b.dataset.inc || b.dataset.dec, d = H.DISHES.find((x) => x.slug === slug); if (!d) return;
        const i = cart.map((l) => l.id).lastIndexOf(slug);
        if (b.dataset.dec) { if (i < 0) return; cart[i].qty -= 1; if (cart[i].qty < 1) cart.splice(i, 1); save(); drawCart(); }
        else if (b.dataset.inc && i >= 0 && !cart[i].variant && !(cart[i].mods || []).length) { cart[i].qty += 1; save(); drawCart(); }
        else addLine(d);
      };
      $$("[data-open]", box).forEach((c) => { const go = () => openDrawer(H.DISHES.find((x) => x.slug === c.dataset.open)); c.onclick = (e) => { if (!e.target.closest("button")) go(); }; c.onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); go(); } }; });
      $$(".ochip", chips || document).forEach((b) => b.onclick = () => { OS.cat = b.dataset.cat; renderDishes(); });
    }

    async function addLine(d) {
      const r = await api("GET", `/menu-items/${d.slug}/options`);
      if (!r.ok) return flash($("#od"), "err", r.status === 404 ? `${d.name} is no longer on the menu. Please refresh the page.` : "That item cannot be ordered right now.");
      const o = r.data.options; if (!o.orderableNow) return flash($("#od"), "err", `${d.name} is not available to order at this time.`);
      const need = o.variants.length || o.modifierGroups.some((g) => g.minSelect > 0 || g.modifiers.length);
      if (!need) return push({ d, variant: null, mods: [] });
      const box = $("#opt"); box.hidden = false;
      box.innerHTML = `<div class="box stack-md"><h3 class="h3">${esc(d.name)}</h3>${o.variants.length ? `<div class="field"><span class="lbl">Size</span>${o.variants.map((v, i) => `<label class="check"><input type="radio" name="ov" value="${v.id}" ${i === 0 ? "checked" : ""}> ${esc(v.name)} · ${gbp(v.priceMinor)}</label>`).join("")}</div>` : ""}${o.modifierGroups.filter((g) => g.modifiers.length).map((g) => `<div class="field"><span class="lbl">${esc(g.name)}${g.minSelect ? " (choose " + g.minSelect + (g.maxSelect > g.minSelect ? "–" + g.maxSelect : "") + ")" : " (optional)"}</span>${g.modifiers.map((m) => `<label class="check"><input type="checkbox" data-g="${g.id}" value="${m.id}"> ${esc(m.name)}${m.priceDeltaMinor ? " +" + gbp(m.priceDeltaMinor) : ""}</label>`).join("")}</div>`).join("")}<div id="ov-err"></div><div class="acts"><button class="btn solid" id="ov-ok">Add to order</button><button class="link" id="ov-no">Cancel</button></div></div>`;
      box.scrollIntoView({ block: "nearest", behavior: "smooth" });
      $("#ov-no").onclick = () => { box.hidden = true; };
      $("#ov-ok").onclick = () => {
        const vid = $("input[name=ov]:checked", box)?.value || null, ids = $$("input[data-g]:checked", box).map((x) => x.value);
        for (const g of o.modifierGroups) { const n = ids.filter((id) => g.modifiers.some((m) => m.id === id)).length; if (n < g.minSelect || (g.maxSelect && n > g.maxSelect)) return ($("#ov-err").innerHTML = notice("err", `Please choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`} for ${g.name}.`)); }
        box.hidden = true; push({ d, variant: o.variants.find((v) => v.id === vid) || null, mods: o.modifierGroups.flatMap((g) => g.modifiers).filter((m) => ids.includes(m.id)) });
      };
    }
    function push({ d, variant, mods }) {
      const key = [d.slug, variant?.id || "", mods.map((m) => m.id).sort().join(",")].join("|"), ex = cart.find((l) => l.key === key);
      if (ex) ex.qty = Math.min(50, ex.qty + 1);
      else cart.push({ key, id: d.slug, name: d.name, variantId: variant?.id, variant: variant?.name, modIds: mods.map((m) => m.id), mods: mods.map((m) => m.name), unit: (variant ? variant.priceMinor : d.price) + mods.reduce((n, m) => n + (m.priceDeltaMinor || 0), 0), qty: 1 });
      save(); drawCart();
    }
    function drawCart() {
      const c = $("#cart"); if (!c) return;
      const sub = total(), short = kind && cfg.minOrderMinor > sub;
      c.innerHTML = cart.length ? `<div class="lines">${cart.map((l, i) => `<div><span class="nm">${esc(l.name)}${l.variant ? ` · ${esc(l.variant)}` : ""}${l.mods.length ? `<br><span class="small faint">${esc(l.mods.join(", "))}</span>` : ""}</span><span><button type="button" class="link" data-q="${i}:-1" aria-label="One fewer ${esc(l.name)}">−</button> <b>${l.qty}</b> <button type="button" class="link" data-q="${i}:1" aria-label="One more ${esc(l.name)}">+</button> <span class="num">${gbp(l.unit * l.qty)}</span></span></div>`).join("")}<div><span>Subtotal</span><span class="total">${gbp(sub)}</span></div></div><p class="small faint">Tax${kind === "delivery" && cfg.deliveryFeeMinor ? ` and the ${gbp(cfg.deliveryFeeMinor)} delivery fee` : ""} ${kind === "delivery" && cfg.deliveryFeeMinor ? "are" : "is"} added when you order and shown once the restaurant confirms.</p>${short ? `<p class="small gold">Minimum order ${gbp(cfg.minOrderMinor)}. Add ${gbp(cfg.minOrderMinor - sub)} more.</p>` : ""}` : `<p class="muted">Your order is empty. Add dishes from the menu.</p>`;
      $$("[data-q]", c).forEach((b) => b.onclick = () => { const [i, dlt] = b.dataset.q.split(":").map(Number); cart[i].qty += dlt; if (cart[i].qty < 1) cart.splice(i, 1); save(); drawCart(); });
      const cnt = $("#cart-n"); if (cnt) cnt.textContent = count(); syncCards();
    }
    function build(msg) {
      clearInterval(poll);
      const locs = H.LOCS, today = todayIn();
      root.innerHTML = `<form class="form" id="od" novalidate>${msg ? notice("err", msg) : ""}
        <div class="split wide-l" style="gap:34px"><div class="stack-lg" id="menu-col">
          ${kinds.length > 1 ? `<div class="seg" role="radiogroup" aria-label="How would you like it?">${kinds.map((k) => `<button type="button" role="radio" aria-checked="${k === kind}" data-k="${k}">${k === "pickup" ? "Pickup" : "Delivery"}</button>`).join("")}</div>` : `<span class="tag gold">${kind === "pickup" ? "Pickup only" : "Delivery only"}</span>`}
          ${cfg.deliveryNote && kinds.includes("delivery") ? `<p class="small faint" id="d-note"${kind === "delivery" ? "" : " hidden"}>${esc(cfg.deliveryNote)}</p>` : ""}
          <div class="otools"><label class="osearch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input type="search" id="o-q" placeholder="Search dishes" aria-label="Search dishes" autocomplete="off"></label><select class="select" id="o-sort" aria-label="Sort dishes"><option value="menu">Menu order</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="az">Name A to Z</option></select><select class="select" id="o-group" aria-label="Group dishes"><option value="cat">Grouped by section</option><option value="none">One list</option></select></div><div class="ochips" id="o-chips" role="group" aria-label="Sections"></div><p class="small faint" id="o-count" aria-live="polite"></p><div id="dishes"></div>
          ${false ? cats().map((c) => `<div class="stack-md"><h2 class="h3">${esc(c)}</h2><div class="stack-sm">${H.DISHES.filter((d) => sold(d) && d.cat === c).map((d) => `<div class="pick"><div><div class="nm">${esc(d.name)}</div>${d.desc ? `<span class="small muted">${esc(d.desc)}</span>` : ""} <span class="pr" style="font-size:1rem">${gbp(d.price)}</span></div><button type="button" class="btn sm" data-add="${d.slug}" aria-label="Add ${esc(d.name)}">Add</button></div>`).join("")}</div></div>`).join("") : empty("The menu is not available to order right now.")}
        </div>
        <aside class="stack-md sticky"><div class="box stack-md"><span class="label">Your order <span id="cart-n" class="num">${count()}</span></span><div id="opt" hidden></div><div id="cart" aria-live="polite"></div>
          <div class="field"><label for="o-loc">Restaurant</label><select class="select" id="o-loc">${locs.map((l) => `<option value="${l.id}"${l.id === locId ? " selected" : ""}>${esc(l.name)}</option>`).join("")}</select></div>
          <div class="field"><label for="o-n">Your name</label><input class="input" id="o-n" autocomplete="name" data-fill="name" data-v="name" required></div>
          <div class="field"><label for="o-c">Phone or email</label><input class="input" id="o-c" autocomplete="email" data-fill="contact" data-v="contact" required></div>
          <div class="field" id="o-a-f" ${kind === "delivery" ? "" : "hidden"}><label for="o-a">Delivery address</label><textarea class="textarea" id="o-a" autocomplete="street-address" minlength="5" maxlength="400"></textarea></div>
          <div class="field" id="o-w-f"><span class="lbl" id="o-w-l">${kind === "delivery" ? "Delivery time" : "Pickup time"}</span><div class="seg seg-sm" role="radiogroup" aria-labelledby="o-w-l"><button type="button" role="radio" aria-checked="true" data-w="asap">As soon as possible</button><button type="button" role="radio" aria-checked="false" data-w="later">Schedule for later</button></div><div id="o-t-wrap" hidden><input class="input" id="o-t" type="datetime-local" aria-label="Date and time" min="${today}T00:00" max="${new Date(Date.now() + 7 * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)}T23:59"><span class="hint">Choose a time at least ${cfg.prepMinutes} minutes from now, within the next 7 days.</span></div><p class="notice err slim" id="o-closed" role="status" hidden></p><span class="hint" id="o-asap">Ready in about ${cfg.prepMinutes} minutes.</span></div>
          <label class="check"><input type="checkbox" id="o-ok" required> I agree to be contacted about this order.</label>
          <button class="btn solid" type="submit">Place order ${ICON.arrow}</button><p class="small faint">The restaurant confirms your order before it is prepared. Payment is taken by the restaurant.</p></div></aside></div></form>`;
      const f = $("#od"); draft.bind(f, "order"); locId = $("#o-loc").value; renderDishes(); drawCart();
      const wire = () => {};
      $("#o-loc").onchange = () => { locId = $("#o-loc").value; const keep = cart.filter((l) => { const d = H.DISHES.find((x) => x.slug === l.id); return d && sold(d); }), dropped = cart.length - keep.length; cart = keep; save(); renderDishes(); wire(); drawCart(); if (dropped) flash(f, "err", `${dropped} item${dropped === 1 ? " is" : "s are"} not sold at this restaurant and ${dropped === 1 ? "was" : "were"} removed from your order.`); };
      const nowOk = () => openAt(kind, new Date()), label = () => (kind === "delivery" ? "Delivery" : "Pickup");
      const syncClosed = () => { const o = nowOk(), n = $("#o-closed"), a = $('[data-w="asap"]', f); if (n) { n.hidden = o.ok; n.textContent = o.ok ? "" : label() + " is closed right now. " + o.why + ". You can schedule an order for a time when we are open."; } if (a) { a.disabled = !o.ok; a.title = o.ok ? "" : "Closed right now"; } if (!o.ok) setWhen(true); };
      const setWhen = (later) => { $$("[data-w]", f).forEach((x) => x.setAttribute("aria-checked", String((x.dataset.w === "later") === later))); $("#o-t-wrap").hidden = !later; $("#o-asap").hidden = later; if (!later) { $("#o-t").value = ""; } };
      $$("[data-w]", f).forEach((b) => b.onclick = () => { setWhen(b.dataset.w === "later"); if (b.dataset.w === "later") $("#o-t-pk")?.click(); });
      if ($("#o-t").value) setWhen(true);
      syncClosed();
      $$("[data-k]", f).forEach((b) => b.onclick = () => { kind = b.dataset.k; $("#o-w-l").textContent = kind === "delivery" ? "Delivery time" : "Pickup time"; syncClosed(); $$("[data-k]", f).forEach((x) => x.setAttribute("aria-checked", x === b)); $("#o-a-f").hidden = kind !== "delivery"; if ($("#d-note")) $("#d-note").hidden = kind !== "delivery"; drawCart(); });
      wire();
      $("#o-q").oninput = (e) => { OS.q = e.target.value.trim(); renderDishes(); };
      $("#o-sort").onchange = (e) => { OS.sort = e.target.value; renderDishes(); };
      $("#o-group").onchange = (e) => { OS.group = e.target.value; renderDishes(); };

      f.onsubmit = async (e) => {
        e.preventDefault(); if (!validate(f)) return;
        if (!cart.length) return flash(f, "err", "Please add something to your order first.");
        if (total() < cfg.minOrderMinor) return flash(f, "err", `The minimum order is ${gbp(cfg.minOrderMinor)}.`);
        const addr = $("#o-a").value.trim(); if (kind === "delivery" && addr.length < 5) return flash(f, "err", "Please enter your delivery address.");
        const t = $("#o-t").value; if (!$("#o-t-wrap").hidden && !t) return flash(f, "err", "Please choose a date and time, or pick \u201cAs soon as possible\u201d."); if (t) { const ms = new Date(t).getTime(); if (!(ms >= Date.now() + cfg.prepMinutes * 60000)) return flash(f, "err", `Please choose a time at least ${cfg.prepMinutes} minutes from now.`); if (ms > Date.now() + 7 * 864e5) return flash(f, "err", "Orders can be scheduled up to 7 days ahead."); const o = openAt(kind, new Date(ms)); if (!o.ok) return flash(f, "err", label() + " is not available at that time. " + o.why + "."); } else { const o = nowOk(); if (!o.ok) return flash(f, "err", label() + " is closed right now. " + o.why + "."); } const body = { locationId: $("#o-loc").value, kind, clientRequestId: ord?.pending || (crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2)), items: cart.map((l) => ({ menuItemId: l.id, quantity: l.qty, ...(l.variantId ? { variantId: l.variantId } : {}), ...(l.modIds.length ? { modifierIds: l.modIds } : {}) })), customerName: $("#o-n").value.trim(), customerContact: $("#o-c").value.trim(), consentToContact: true };
        if (kind === "delivery") body.deliveryAddress = addr; if (t) body.requestedFor = new Date(t).toISOString();
        const btn = $("button[type=submit]", f); busy(btn, true, "Placing order…");
        const r = await api("POST", "/takeaway-orders", body); busy(btn, false);
        if (!r.ok) return flash(f, "err", r.data.error || "We could not place your order.");
        ord = { id: r.data.orderId, token: r.data.token, kind, totals: r.data.totals, name: body.customerName }; store.set("takeaway", ord); cart = []; save(); draft.clear("order"); track();
      };
    }
    async function track() {
      clearInterval(poll);
      const r = await api("GET", `/takeaway-orders/${ord.id}?token=${encodeURIComponent(ord.token)}`);
      if (r.status === 404) { store.del("takeaway"); ord = null; return build("We could not find that order any more."); }
      const o = r.ok ? r.data.order : null, st = o?.fulfilment || "received", pick = ord.kind === "pickup";
      const label = { received: "Waiting for the restaurant to accept", accepted: "Accepted", preparing: "Being prepared", ready: pick ? "Ready to collect" : "Ready", out_for_delivery: "On its way", completed: "Completed", cancelled: "Cancelled", rejected: "Declined" }[st] || st;
      const final = ["completed", "cancelled", "rejected"].includes(st), t = o || {}, items = o?.items || [];
      root.innerHTML = `<div class="box stack-md" aria-live="polite"><span class="label">${pick ? "Pickup" : "Delivery"} order · ${short(ord.id)}</span><h2 class="h2"><em>${esc(label)}</em></h2>
        ${o && !final && st !== "ready" ? `<p class="muted">Expected around ${new Date(o.estimatedReadyAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: BRAND.tz })}.</p>` : ""}${o?.reason && final ? `<p class="muted">${esc(o.reason)}</p>` : ""}
        ${items.length ? `<div class="lines">${items.map((i) => `<div><span class="nm">${esc(i.quantity)} × ${esc(i.name)}${i.variant_name ? " · " + esc(i.variant_name) : ""}</span><span class="num">${gbp(i.price_minor * i.quantity)}</span></div>`).join("")}${t.fee_minor ? `<div><span>Delivery and charges</span><span class="num">${gbp(t.fee_minor)}</span></div>` : ""}${t.tax_minor ? `<div><span>Tax</span><span class="num">${gbp(t.tax_minor)}</span></div>` : ""}<div><span>Total</span><span class="total">${gbp(t.total_minor)}</span></div></div>` : ""}
        <div class="acts">${st === "received" ? `<button class="btn quiet" id="o-cancel">Cancel order</button>` : ""}<button class="link" id="o-new">${final ? "Start a new order" : "Hide this and order more"}</button></div><div id="o-msg"></div></div>`;
      $("#o-new").onclick = () => { store.del("takeaway"); ord = null; build(); };
      if ($("#o-cancel")) $("#o-cancel").onclick = async (e) => { busy(e.currentTarget, true, "Cancelling…"); const c = await api("POST", `/takeaway-orders/${ord.id}/cancel`, { token: ord.token }); busy(e.currentTarget, false); if (!c.ok) return ($("#o-msg").innerHTML = notice("err", c.data.error || "The restaurant has already started on it. Please call to change it.")); track(); };
      if (!final) poll = setInterval(track, 15000);
    }
    ord && ord.id ? track() : build();
  };

  /* ================= My tickets ================= */
  pages.tickets = async (root) => {
    const mine = store.get("orders", []).filter((o) => o.token);
    if (!mine.length) return (root.innerHTML = `<div class="box stack-md"><span class="label">No tickets on this device</span><p class="muted">Tickets you reserve on the <a class="textlink" href="events.html">events page</a> appear here. If you have an account, you can also find them under <a class="textlink" href="account.html#bookings">Bookings and orders</a>.</p></div>`);
    root.innerHTML = `<div class="box"><span class="label">Loading your tickets…</span></div>`;
    const label = { pending: ["gold", "Seats held: waiting for payment at the venue"], paid: ["ok", "Paid: your tickets are below"], cancelled: ["dim", "Cancelled"], refund_due: ["info", "Cancelled: refund on its way"], refunded: ["dim", "Refunded"], expired: ["dim", "Hold expired"] };
    const get = async () => { const out = []; for (const o of mine) { const r = await api("GET", `/ticket-orders/${o.id}`, undefined, { bearer: o.token }); out.push({ ...o, ...(r.ok ? { live: r.data } : { gone: r.status === 404, err: r.data.error }) }); } return out; };
    const draw = async (msg) => {
      const list = await get();
      root.innerHTML = (msg ? notice("ok", msg) : "") + list.map((o, i) => {
        if (!o.live) return `<article class="stack-md" style="margin-top:44px"><span class="label">${esc(o.title)}</span><p class="muted">${o.gone ? "We could not find this order any more." : esc(o.err || "We could not load this order right now.")}</p>${o.gone ? `<button class="link" data-drop="${i}" style="justify-self:start">Remove from this device</button>` : ""}</article>`;
        const x = o.live.order, st = label[x.status] || ["dim", x.status.replace(/_/g, " ")], tix = o.live.tickets || [], open = ["pending", "paid"].includes(x.status);
        return `<article class="stack-md" style="margin-top:44px"><div class="head-row" style="margin-bottom:0"><div><span class="label">Order ${short(x.id)}</span><h2 class="h2">${esc(o.title)}</h2><p>${esc(o.when)} · ${x.quantity} × ticket · ${gbp(x.payable_minor ?? x.total_minor)}</p></div><span class="state ${st[0]}"><i></i>${esc(st[1])}</span></div>
          ${x.status === "pending" && x.hold_expires_at ? notice("info", `Hold expires ${new Date(x.hold_expires_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: BRAND.tz })}. Show this order at the venue to pay.`) : ""}
          ${tix.map((t, n) => `<div class="ticket${t.status === "checked_in" ? " used" : ""}"><div class="main"><span class="tag gold">Ticket ${n + 1} of ${tix.length}</span><h3 class="h3">${esc(o.title)}</h3><p class="muted">${esc(o.when)}</p><span class="state ${t.status === "checked_in" ? "dim" : "ok"}"><i></i>${t.status === "checked_in" ? "Used · already scanned at the door" : "Valid"}</span></div><div class="stub"><div data-tqr="${esc(t.code)}"></div></div></div>`).join("")}
          ${open && !tix.some((t) => t.status === "checked_in") ? `<div class="acts"><button class="btn quiet sm" data-cancel="${i}">Cancel order</button><span data-ask="${i}"></span></div>` : ""}</article>`;
      }).join("");
      $$("[data-tqr]").forEach((el) => { if (window.QRCode) { try { new window.QRCode(el, { text: el.dataset.tqr, width: 140, height: 140, colorDark: "#0c0b0a", colorLight: "#f2ebe0" }); return; } catch {} } el.innerHTML = `<code class="small" style="word-break:break-all">${esc(el.dataset.tqr)}</code>`; });
      $$("[data-drop]").forEach((b) => b.onclick = () => { const o = mine[Number(b.dataset.drop)]; store.set("orders", store.get("orders", []).filter((x) => x.id !== o.id)); location.reload(); });
      $$("[data-cancel]").forEach((b) => b.onclick = () => { const i = Number(b.dataset.cancel), box = $(`[data-ask="${i}"]`); box.innerHTML = `<span class="small">Cancel this order? <button class="link" data-yes="${i}">Yes, cancel</button></span>`;
        $(`[data-yes="${i}"]`).onclick = async (e) => { busy(e.currentTarget, true, "Cancelling…"); const r = await api("POST", `/ticket-orders/${mine[i].id}/cancel`, {}, { bearer: mine[i].token }); if (!r.ok) { box.innerHTML = `<span class="small gold">${esc(r.data.error || "We could not cancel this order. Please call the restaurant.")}</span>`; return; } draw("Order cancelled."); }; });
    };
    draw();
  };
})();
