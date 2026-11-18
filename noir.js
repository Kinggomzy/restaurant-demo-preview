/* Noir guest website: shared header and footer, sample data and every interactive flow. Every flow talks to the restaurant's own system (see live.js, cms.js, account.js). */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k, d) { try { const v = localStorage.getItem("hv." + k); return v ? JSON.parse(v) : d; } catch { return d; } }, set(k, v) { try { localStorage.setItem("hv." + k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem("hv." + k); } catch {} } };
  const BRAND = { name: "Restaurant", tagline: "", phone: "", email: "", currency: "GBP", locale: "en-GB", tz: "UTC", live: false };
  const gbp = (p) => p === 0 ? "Free" : new Intl.NumberFormat(BRAND.locale, { style: "currency", currency: BRAND.currency, minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(p / 100);

  /* ================= The restaurant's system (tenant runtime public API) ================= */
  const tokenStore = { get: () => store.get("token", null), set: (t) => store.set("token", { t, at: Date.now() }), del: () => store.del("token") };
  const signedIn = () => { const k = tokenStore.get(); return !!(k && Date.now() - k.at < 30 * 60e3); };
  /** One call to the restaurant's system. Always answers { ok, status, data }; a network failure becomes a friendly message. */
  async function api(method, path, body, o = {}) {
    const headers = { Accept: "application/json" }; if (body !== undefined) headers["Content-Type"] = "application/json";
    const k = tokenStore.get(); if (o.auth && k) headers["x-guest-token"] = k.t;
    if (o.bearer) headers.Authorization = "Bearer " + o.bearer;
    try {
      const r = await fetch("/api/public" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(o.timeout || 12000) });
      let data = null; try { data = await r.json(); } catch {}
      if (r.status === 401 && o.auth) { tokenStore.del(); store.del("user"); }
      if (!r.ok && !(data && data.error)) data = { ...(data || {}), error: r.status === 429 ? "Too many tries. Please wait a little and try again." : r.status >= 500 ? "The restaurant's system is busy. Please try again in a moment." : "Something went wrong. Please check the details and try again." };
      if (!r.ok && data && Array.isArray(data.issues)) data.error = data.issues.map((i) => i.message || i).join(" ");
      return { ok: r.ok, status: r.status, data: data || {} };
    } catch { return { ok: false, status: 0, data: { error: "We could not reach the restaurant just now. Please check your connection and try again." } }; }
  }
  const ICON = {
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12l4 4 10-10"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.6 5.6 21.2l1.6-7.1L1.8 9.3 9 8.6z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };
  const notice = (kind, text) => `<div class="notice ${kind}" role="${kind === "err" ? "alert" : "status"}">${ICON[kind] || ICON.info}<div>${text}</div></div>`;
  /* Signed-in guest (demo: kept on this device) and form drafts: what people type survives errors, reloads and navigation. */
  const user = () => (signedIn() ? store.get("user", null) : null);
  const draft = {
    get: (k) => store.get("draft." + k, {}),
    put(k, f, v) { const d = this.get(k); d[f] = v; store.set("draft." + k, d); },
    clear: (k) => store.del("draft." + k),
    bind(form, k, bad = []) {
      enhance(form);
      const d = this.get(k), u = user(), pre = { name: u?.name, email: u?.email, phone: u?.phone, contact: u?.email };
      $$("input[id],select[id],textarea[id]", form).forEach((el) => {
        if (el.type === "checkbox") { if (el.id in d) el.checked = d[el.id]; return; }
        if (el.id in d) { if (!(el.type === "date" && el.min && d[el.id] < el.min)) el.value = d[el.id]; }
        else if (el.dataset.fill && pre[el.dataset.fill]) el.value = pre[el.dataset.fill];
      });
      const save = (e) => { const el = e.target; if (!el.id || el.dataset.nodraft) return; el.removeAttribute("aria-invalid"); this.put(k, el.id, el.type === "checkbox" ? el.checked : el.value); };
      form.addEventListener("input", save); form.addEventListener("change", save);
      bad.forEach((id) => $("#" + id, form)?.setAttribute("aria-invalid", "true"));
      if (bad.length) $("#" + bad[0], form)?.focus({ preventScroll: true });
    },
  };
  /* Validation: browser-native rules plus name / email / phone checks, inline messages, red asterisks and a legend. */
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, digits = (v) => v.replace(/\D/g, "");
  const okPhone = (v) => /^\+?[\d\s().-]{7,20}$/.test(v) && digits(v).length >= 7 && digits(v).length <= 15;
  const RULES = {
    name: (v) => /^[\p{L}][\p{L}\p{M}'’.\- ]*$/u.test(v) && v.length >= 2 || "Enter your name using letters only, at least 2 characters.",
    email: (v) => EMAIL.test(v) || "Enter a valid email address, like name@example.com.",
    phone: (v) => okPhone(v) || "Enter a valid phone number, like 07700 900123 or +44 7700 900123.",
    contact: (v) => EMAIL.test(v) || okPhone(v) || "Enter a valid email address or phone number.",
    code: (v) => /^\d{6}$/.test(v) || "The code is exactly six digits.",
  };
  const kindOf = (el) => el.dataset.v || (el.type === "email" ? "email" : el.type === "tel" ? "phone" : /^(name|given-name)$/.test(el.autocomplete) ? "name" : "");
  const AC = { name: "name", email: "email", phone: "tel" };
  function enhance(form) {
    if (form.dataset.enh) return; form.dataset.enh = 1; form.noValidate = true;
    $$("input,select,textarea", form).forEach((el) => {
      if (el.type === "radio" || el.type === "submit") return;
      const k = kindOf(el);
      if (!el.name) el.name = k === "name" ? "name" : k === "contact" ? "contact" : (el.id || "").replace(/^[a-z]{1,3}-/, "") || el.id;
      if (!el.autocomplete && AC[k]) el.autocomplete = AC[k];
      if (k === "phone") { el.type = "tel"; el.inputMode = "tel"; el.maxLength = 20; }
      if (k === "email" && el.type === "text") el.type = "email";
      if (k === "name") { el.maxLength = 80; el.autocapitalize = "words"; }
      if (el.required) {
        const lab = el.type === "checkbox" ? el.closest("label") : $(`label[for="${el.id}"]`, form);
        if (lab && !$(".req", lab)) (el.type === "checkbox" ? lab : lab).insertAdjacentHTML("beforeend", ' <span class="req" aria-hidden="true">*</span>');
      }
    });
    if ($("[required]", form) && !$(".req-note", form)) { const n = document.createElement("p"); n.className = "req-note small"; n.innerHTML = '<span class="req" aria-hidden="true">*</span> Required field'; const a = $(".acts:last-of-type", form) || $(".acts", form); a ? a.before(n) : form.append(n); }
    form.addEventListener("input", (e) => clearErr(e.target)); form.addEventListener("change", (e) => clearErr(e.target));
    form.addEventListener("focusout", (e) => { const el = e.target; if (el.matches?.("input:not([type=checkbox]),textarea") && el.value.trim()) fieldCheck(el); });
  }
  function clearErr(el) { if (!el?.id) return; el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); document.getElementById("e-" + el.id)?.remove(); }
  function fieldCheck(el) {
    clearErr(el);
    const v = (el.value || "").trim(); let msg = "";
    if (el.type === "checkbox") { if (el.required && !el.checked) msg = "Please tick this box to continue."; }
    else if (el.required && !v) msg = el.tagName === "SELECT" ? "Please choose an option." : "This field is required.";
    else if (v) {
      const k = kindOf(el), r = RULES[k]; if (r) { const o = r(v); if (o !== true) msg = o; }
      if (!msg && !el.checkValidity()) { const s = el.validity; msg = s.rangeUnderflow ? (el.type === "date" ? "Choose today or a later date." : `Enter ${el.min} or more.`) : s.rangeOverflow ? (el.type === "date" ? "That date is too far ahead." : `Enter ${el.max} or fewer.`) : s.tooShort ? `Use at least ${el.minLength} characters.` : s.badInput ? "Enter a valid value." : el.validationMessage; }
    }
    if (!msg) return true;
    el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", "e-" + el.id);
    const host = el.type === "checkbox" ? el.closest("label") : el;
    host.insertAdjacentHTML("afterend", `<span class="ferr" id="e-${el.id}" role="alert">${msg}</span>`);
    return false;
  }
  function validate(form) {
    const bad = $$("input,select,textarea", form).filter((el) => el.type !== "radio" && el.type !== "hidden" && !el.disabled && !fieldCheck(el));
    if (bad.length) { bad[0].focus({ preventScroll: true }); bad[0].scrollIntoView({ block: "center", behavior: "smooth" }); }
    return !bad.length;
  }
  const success = (title, text, extra = "") => `<div class="success" role="status"><span class="tick">${ICON.ok}</span><h3 class="h3">${title}</h3><p class="muted">${text}</p>${extra}</div>`;

  /* ================= Sample data (as the restaurant enters it in the portal) ================= */
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const LOCS = [
    { id: "harbour", name: "Harbour Street", addr: "1 Quay Road, Bristol BS1 4AB", x: 30, y: 46, hours: [[["12:00","15:00"],["17:30","22:30"]],[["12:00","15:00"],["17:30","22:30"]],[["12:00","15:00"],["17:30","22:30"]],[["12:00","15:00"],["17:30","23:00"]],[["12:00","23:00"]],[["11:00","23:00"]],[["11:00","21:00"]]] },
    { id: "mill", name: "Old Mill", addr: "2 Quay Road, Bristol BS2 4AB", x: 58, y: 38, hours: [[],[["17:30","22:00"]],[["17:30","22:00"]],[["17:30","22:00"]],[["12:00","23:00"]],[["12:00","23:00"]],[["12:00","18:00"]]] },
    { id: "rooftop", name: "Rooftop Bar", addr: "3 Quay Road, Bristol BS3 4AB", x: 76, y: 80, hours: [[],[],[["16:00","23:30"]],[["16:00","23:30"]],[["15:00","01:00"]],[["13:00","01:00"]],[["13:00","22:00"]]] },
  ];
  const CLOSURES = [{ date: "2026-12-24", where: "All rooms", reason: "Christmas Eve: closed from 16:00" }, { date: "2026-12-25", where: "All rooms", reason: "Christmas Day" }, { date: "2026-12-26", where: "Old Mill", reason: "Boxing Day" }, { date: "2027-01-01", where: "All rooms", reason: "New Year's Day" }];
  const POLICY = { maxAdvanceDays: 90, minNoticeMinutes: 15, maxPartySize: 50, onlineMax: 12, holdMinutes: 10, freeCancelHours: 24, noShowGraceMinutes: 15 };
  const ALLERGEN = { gluten: "Gluten", milk: "Milk", egg: "Eggs", fish: "Fish", crustaceans: "Crustaceans", molluscs: "Molluscs", nuts: "Tree nuts", peanuts: "Peanuts", sesame: "Sesame", soya: "Soya", celery: "Celery", mustard: "Mustard", sulphites: "Sulphites", lupin: "Lupin" };
  const DIET = { vegetarian: "Vegetarian", vegan: "Vegan", gf: "Gluten free", df: "Dairy free", halal: "Halal", spicy: "Spicy", nutfree: "Nut free" };
  const D = (slug, name, cat, desc, price, o = {}) => ({ slug, name, cat, desc, price, img: null, tags: [], allergens: [], reviewed: true, ...o });
  const DISHES = [
    D("burrata", "Burrata, heritage tomatoes", "Starters", "Basil oil, smoked sea salt, grilled sourdough.", 1100, { tags: ["vegetarian"], allergens: ["milk", "gluten"] }),
    D("oysters", "Porthilly oysters", "Starters", "Shallot vinegar, lemon, Tabasco. Each.", 350, { tags: ["gf", "df"], allergens: ["molluscs", "sulphites"], variants: [["Single", 350], ["Half dozen", 1900], ["Dozen", 3600]] }),
    D("salmon-bowl", "Cured salmon bowl", "Starters", "Citrus-cured salmon, sweetcorn, soft egg, pickled cabbage.", 1550, { img: "salad", tags: ["gf"], allergens: ["fish", "egg"] }),
    D("ragu", "Nine-hour beef shin ragù", "Pasta", "Hand-cut pappardelle, aged parmesan, gremolata.", 1850, { img: "pasta1", tags: [], allergens: ["gluten", "egg", "milk", "celery"], special: true, badge: "Chef's pick", variants: [["Starter size", 1150], ["Main", 1850]], extras: [["Extra parmesan", 150], ["Truffle oil", 300]] }),
    D("cacio", "Cacio e pepe", "Pasta", "Tonnarelli, pecorino romano, a lot of black pepper.", 1450, { tags: ["vegetarian"], allergens: ["gluten", "egg", "milk"] }),
    D("crab-linguine", "Crab linguine", "Pasta", "Brown and white crab, chilli, lemon, parsley.", 1950, { tags: ["spicy"], allergens: ["gluten", "egg", "crustaceans"], unavail: true }),
    D("bavette", "Bavette and frites", "Grill", "Grass-fed, cooked over coals, chimichurri, dripping fries.", 2600, { img: "steak", tags: ["gf"], allergens: [], special: true, extras: [["Peppercorn sauce", 250], ["Bone marrow butter", 300]] }),
    D("hake", "Day-boat hake", "Grill", "Brown shrimp butter, samphire, new potatoes.", 2400, { tags: ["gf"], allergens: ["fish", "crustaceans", "milk"] }),
    D("laksa", "Coconut and squash laksa", "Mains", "Rice noodles, tofu, Thai basil, lime.", 1550, { tags: ["vegan", "spicy", "df"], allergens: ["soya", "peanuts"] }),
    D("small-plates", "Small plates for the table", "Sharing", "Five dishes, chef's choice, made to share.", 3200, { img: "spread", tags: ["vegetarian"], allergens: [], from: true, badge: "For the table", reviewed: false }),
    D("pizza", "Quay pizza", "Pizza", "48-hour dough, smoked chicken, red onion, basil.", 1400, { img: "pizza", tags: ["spicy"], allergens: ["gluten", "milk"], badge: "New" }),
    D("brunch", "Weekend brunch board", "Brunch", "Saturday and Sunday until 15:00. Waffles, eggs, fruit.", 1200, { img: "dining", tags: ["vegetarian"], allergens: ["gluten", "egg", "milk"], from: true }),
    D("tart", "Burnt honey tart", "Desserts", "Crème fraîche, honeycomb.", 850, { tags: ["vegetarian"], allergens: ["gluten", "egg", "milk"] }),
    D("sorbet", "Blood orange sorbet", "Desserts", "Three scoops, candied peel.", 650, { tags: ["vegan", "gf", "df"], allergens: [] }),
    D("venison", "Venison, celeriac, blackberry", "Autumn", "Seasonal, until the end of November.", 2800, { tags: ["gf"], allergens: ["celery", "milk", "sulphites"], seasonal: true, badge: "Seasonal" }),
    D("squash", "Roast delica squash", "Autumn", "Sage brown butter, hazelnuts, ricotta.", 1300, { tags: ["vegetarian"], allergens: ["milk", "nuts"], seasonal: true }),
    D("old-fashioned", "Harbour old fashioned", "Cocktails", "Bourbon, demerara, orange peel, a slow pour.", 1100, { img: "cocktails", tags: ["vegan"], allergens: [], drink: true }),
    D("spritz", "Blood orange spritz", "Cocktails", "Aperitivo, prosecco, rosemary.", 950, { tags: ["vegan"], allergens: ["sulphites"], drink: true }),
    D("negroni", "Quay negroni", "Cocktails", "Bristol dry gin, vermouth, bitter.", 1000, { tags: ["vegan"], allergens: ["sulphites"], drink: true, special: true }),
    D("loire", "Domaine Huet, Vouvray", "Wine", "Chenin blanc, Loire. By the glass or bottle.", 900, { tags: ["vegan"], allergens: ["sulphites"], drink: true, variants: [["125 ml", 900], ["Bottle", 4800]], from: true }),
    D("cold-brew", "Cold brew tonic", "No alcohol", "Local roast, tonic, orange.", 480, { tags: ["vegan"], allergens: [], drink: true }),
    D("lemonade", "House lemonade", "No alcohol", "Lemon, mint, sparkling water.", 400, { tags: ["vegan"], allergens: [], drink: true }),
  ];
  const EVENTS = [
    { slug: "jazz", day: "22", mon: "Nov", wd: "Sat", title: "Jazz and biryani night", desc: "The Quayside Trio plays two sets while the kitchen serves a Hyderabadi feast.", img: "room1", sessions: [{ id: "jazz-1", when: "Saturday 22 November, 19:00–22:00", price: 4500, left: 6 }, { id: "jazz-2", when: "Saturday 29 November, 19:00–22:00", price: 4500, left: 38 }] },
    { slug: "wine", day: "25", mon: "Nov", wd: "Tue", title: "Wine pairing dinner", desc: "Five courses matched with low-intervention wines from the Loire.", img: "cocktails", sessions: [{ id: "wine-1", when: "Tuesday 25 November, from 19:30", price: 8500, left: 0 }, { id: "wine-2", when: "Tuesday 9 December, from 19:30", price: 8500, left: 14 }] },
    { slug: "lunch", day: "01", mon: "Dec", wd: "Mon", title: "Free community lunch", desc: "A long-table lunch for neighbours. Bring a friend; we cook.", img: "dining", sessions: [{ id: "lunch-1", when: "Monday 1 December, 12:00–15:00", price: 0, left: 52 }] },
    { slug: "quiz", day: "04", mon: "Dec", wd: "Thu", title: "Quiz on the quay", desc: "Teams of up to six. Prizes for the winners, chips for everyone.", img: "bar", sessions: [{ id: "quiz-1", when: "Thursday 4 December, 20:00", price: 500, left: 9 }] },
  ];

  /* ================= Header and footer ================= */
  const MAIN_L = [["./", "Home"], ["menu.html", "Menu"], ["about.html", "About"], ["experiences.html", "Experiences"], ["events.html", "Events"]];
  const MAIN_R = [["gallery.html", "Gallery"], ["blog.html", "Blog"], ["contact.html", "Contact"]];
  const MORE = [["Visit", [["visit.html", "Visit us"], ["queue.html", "Walk-in queue"], ["offers.html", "Offers"], ["private-dining.html", "Private dining"], ["gift-cards.html", "Gift cards"], ["reviews.html", "Reviews"]]], ["About us", [["our-team.html", "Our team"], ["press.html", "Press"], ["careers.html", "Careers"], ["partners.html", "Partners"], ["faq.html", "FAQs"], ["feedback.html", "Feedback"]]]];
  const LEGAL = [["privacy.html", "Privacy"], ["terms.html", "Terms"], ["reservation-policy.html", "Booking policy"], ["refund-policy.html", "Refunds"], ["cookies.html", "Cookies"], ["accessibility.html", "Accessibility"], ["account.html#privacy", "My data"]];
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const cur = (h) => (h === here || ((here === "" || here === "index.html") && h === "./") ? ' aria-current="page"' : "");
  const navA = (l) => l.map(([h, t]) => `<a href="${h}"${cur(h)}>${t}</a>`).join("");
  const KIND = { cafe: "Resto & Cafe", restaurant: "Restaurant", bar: "Bar & Kitchen", bakery: "Bakery", hotel: "Hotel" };
  const logoHtml = () => { const n = esc(BRAND.name), sub = esc(KIND[BRAND.kind] || ""); const mk = BRAND.logoUrl ? `<img class="mark" src="${esc(BRAND.logoUrl)}" alt="" width="68" height="68">` : ""; return `<a class="logo" href="./" aria-label="${n} home">${mk}<span class="wm"><b>${n}</b>${sub ? `<small>${sub}</small>` : ""}</span></a>`; };
  let LOGO = logoHtml();

  function header() {
    const el = document.createElement("div");
    el.innerHTML = `<a class="skip" href="#main">Skip to content</a>
<header class="head" id="head"><div class="in">
  ${LOGO}
  <nav class="nav" aria-label="Main">${navA(MAIN_L)}</nav>
  <div class="right"><nav class="nav" aria-label="Secondary">${navA(MAIN_R)}
    <div class="more" id="more" data-open="false"><button type="button" id="more-btn" aria-expanded="false" aria-controls="more-panel">More <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="panel" id="more-panel" hidden>${MORE.map(([g, l]) => `<span class="grp">${g}</span>${navA(l)}`).join("")}</div></div></nav>
    <a class="acct-link" href="account.html" aria-label="${user() ? "My account" : "Sign in"}"${cur("account.html")}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5"/></svg><span>${user() ? esc(user().name.split(" ")[0]) : "Sign in"}</span></a>
    <a class="btn" href="book.html">Book a table</a></div>
  <button class="burger" type="button" id="burger" aria-label="Open the menu" aria-expanded="false" aria-controls="mnav"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 8h18M3 16h18"/></svg></button>
</div></header>
<div class="mnav" id="mnav" data-open="false" role="dialog" aria-modal="true" aria-label="Site menu">
  <div class="top">${LOGO}<button class="burger" type="button" id="mclose" aria-label="Close the menu" style="display:grid"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>
  <div><nav class="main" aria-label="Main">${navA([...MAIN_L, ...MAIN_R])}</nav><div class="sub">${navA(MORE.flatMap(([, l]) => l))}</div></div>
  <div class="acts"><a class="btn quiet" href="account.html">${user() ? "My account" : "Sign in"}</a><a class="btn solid" href="book.html">Book a table</a></div>
</div>`;
    document.body.prepend(...el.childNodes);
  }

  const WA_NUMBER = "918240037583";
  const socialUrl = (k) => (BRAND.social || {})[k] || (k === "whatsapp" ? "https://wa.me/" + WA_NUMBER : "");
  /* Floating Reserve and WhatsApp buttons, bottom right, on every page except the booking page itself. */
  function dock() {
    if (document.querySelector(".dock")) return;
    const here = location.pathname.split("/").pop() || "index.html", d = document.createElement("div"); d.className = "dock";
    const wa = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent("Hello! I would like to know more about " + (BRAND.name || "your restaurant") + ".");
    d.innerHTML = (here === "book.html" ? "" : '<a class="dock-book" href="book.html" aria-label="Reserve a table" title="Reserve a table"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><span>Reserve a table</span></a>') + '<a class="dock-wa" href="' + wa + '" rel="noopener" target="_blank" aria-label="Chat with us on WhatsApp" title="Chat on WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.8-1.2A11 11 0 1 0 20.5 3.5zm-8.4 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.8.7.8-2.7-.2-.3a9 9 0 1 1 7.1 3.8zm5-6.7c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.800 11.800 0 0 0 4.600 4c1.700.7 2.400.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.3-.2-.6-.3z"/></svg></a>';
    document.body.appendChild(d);
  }
  function footer() {
    const f = document.createElement("footer"); f.className = "foot";
    f.innerHTML = `<div class="wrap">
  <div class="big"><h2>${BRAND.tagline ? esc(BRAND.tagline) : `Visit <em>${esc(BRAND.name)}.</em>`}</h2><a class="btn solid" href="book.html">Book a table ${ICON.arrow}</a></div>
  <div class="foot-grid">
    <div><h3>${esc(BRAND.name)}</h3><p class="tagline">${esc(BRAND.tagline)}</p>
      <div class="social">${["instagram", "facebook", "whatsapp", "tiktok", "youtube", "x"].filter((k) => /^https?:/.test(socialUrl(k))).map((k) => `<a href="${esc(socialUrl(k))}" rel="noopener" aria-label="${k[0].toUpperCase() + k.slice(1)}">${k === "whatsapp" ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.8-1.2A11 11 0 1 0 20.5 3.5zm-8.4 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.8.7.8-2.7-.2-.3a9 9 0 1 1 7.1 3.8zm5-6.7c-.3-.1-1.6-.8-1.9-.9s-.4-.1-.6.1-.7.9-.9 1.1-.3.2-.6.1a7.4 7.4 0 0 1-3.7-3.2c-.3-.5.3-.5.8-1.5.1-.2 0-.3 0-.5l-.9-2c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.800 11.800 0 0 0 4.600 4c1.700.7 2.400.8 3.200.7a2.700 2.700 0 0 0 1.800-1.300 2.200 2.200 0 0 0 .2-1.300c-.1-.1-.3-.2-.6-.3z"/></svg>' : k === "facebook" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg>' : k === "instagram" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' : esc(k)}</a>`).join("")}</div></div>
    <div><h3>Visit</h3><div class="flinks">${LOCS.map((l) => `<address><b>${esc(l.name)}</b><br>${esc(l.addr)}</address>`).join("")}
      ${BRAND.phone ? `<div class="copy-row"><span>${esc(BRAND.phone)}</span><button type="button" data-copy="${esc(BRAND.phone)}">Copy</button></div>` : ""}
      ${BRAND.email ? `<div class="copy-row"><span>${esc(BRAND.email)}</span><button type="button" data-copy="${esc(BRAND.email)}">Copy</button></div>` : ""}</div></div>
    ${LOCS[0] ? `<div><h3>Hours · ${esc(LOCS[0].name)}</h3><dl>${LOCS[0].hours.map((d, i) => `<dt>${DAYS[i].slice(0, 3)}</dt><dd>${txt(d)}</dd>`).join("")}</dl></div>` : ""}
    <div><h3>Explore</h3><div class="flinks">${navA([["menu.html", "Menu"], ["about.html", "About"], ["experiences.html", "Experiences"], ["events.html", "Events"], ["gallery.html", "Gallery"], ["blog.html", "Blog"], ["contact.html", "Contact"], ["book.html", "Book a table"], ...(((SITE && SITE.modules) || []).includes("ordering") ? [["order.html", "Order online"]] : []), ["faq.html", "FAQs"], ["gift-cards.html", "Gift cards"]])}</div></div>
  </div>
  <div class="legal">${navA(LEGAL)}<span class="r"><span>© ${new Date().getFullYear()} ${esc(BRAND.name)}</span><a href="sitemap.html"${cur("sitemap.html")}>All pages</a></span></div>
</div>`;
    document.body.append(f);
  }

  /* ================= Hours ================= */
  const now = new Date();
  let dow = (now.getDay() + 6) % 7, mins = now.getHours() * 60 + now.getMinutes();
  const setClock = () => { try { const p = new Intl.DateTimeFormat("en-GB", { timeZone: BRAND.tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).reduce((o, x) => (o[x.type] = x.value, o), {}); dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday); mins = Number(p.hour) * 60 + Number(p.minute); } catch {} };
  const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  function txt(d) { return d.length ? d.map(([a, b]) => `${a}–${b}`).join(", ") : "Closed"; }
  function status(l) {
    for (const [a, b] of l.hours[dow]) { const s = toMin(a); let e = toMin(b); if (e <= s) e += 1440; if (mins >= s && mins < e) return { open: true, text: `Open now until ${b}` }; }
    for (const [a] of l.hours[dow]) if (toMin(a) > mins) return { open: false, text: `Closed · opens at ${a}` };
    return { open: false, text: "Closed now" };
  }
  const hoursDl = (l) => `<dl class="hrs">${l.hours.map((d, i) => `<dt class="${i === dow ? "today" : ""}">${DAYS[i]}</dt><dd class="${i === dow ? "today" : ""}">${txt(d)}</dd>`).join("")}</dl>`;
  const mapUrl = (l) => `https://maps.google.com/?q=${encodeURIComponent(l.addr)}`;
  function locCards(full) {
    return LOCS.map((l) => { const s = status(l); return `<article class="loc"><span class="state ${s.open ? "ok live" : "warn"}"><i aria-hidden="true"></i>${s.text}</span><h3>${l.name}</h3><address>${l.addr}</address>${full && BRAND.phone ? `<div class="copy-row small muted"><span>${esc(BRAND.phone)}</span><button type="button" data-copy="${esc(BRAND.phone)}">Copy</button></div>` : ""}${hoursDl(l)}<div class="acts"><a class="link" href="${mapUrl(l)}">Open in maps</a><a class="link" href="book.html">Book here</a></div></article>`; }).join("");
  }

  /* ================= Small shared widgets ================= */
  const stars = (n) => [1, 2, 3, 4, 5].map((i) => ICON.star.replace("<svg", `<svg class="${i <= Math.round(n) ? "" : "off"}"`)).join("");
  const MENU_IMG = new Set(["soups-and-broths","greens-and-garden-bowls","opening-bites","indian-tandoor-and-kebabs","sandwiches-and-burgers","mexican-delights","live-pizza-station","pasta-and-risotto","sushi","dumplings-and-bao-buns","global-bowls","rice","noodles","north-indian-mains","vegetarian-specialties","dal-and-kofta","breads-and-sides","sweet-moments","signature-mocktails","artisan-coffee","iced-coffee-and-plant-lattes","virgin-mojitos","wellness-elixirs","hot-teas","iced-teas","lemonades","smoothies","shakes","lassi","tapas"]);
  const CATPIC = {};
  const catImg = (cat, small) => { if (CATPIC[cat]) return CATPIC[cat]; const k = String(cat || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); return MENU_IMG.has(k) ? `img/menu/${k}${small ? "-s" : ""}.webp` : ""; };
  const photo = (d, cls = "r45") => d.pic ? `<div class="photo ${cls}"><img src="${esc(d.pic)}" alt="${esc(d.name)}" loading="lazy" decoding="async"></div>` : !d.img && catImg(d.cat) ? `<div class="photo ${cls}"><img src="${catImg(d.cat, cls === "")}" alt="" loading="lazy" decoding="async"></div>` : d.img ? `<div class="photo ${cls}"><img src="img/${d.img}.webp" alt="${esc(d.name)}" loading="lazy"></div>` : `<div class="photo ${cls}" style="display:grid;place-items:center;background:radial-gradient(circle at 50% 40%, var(--bg-4), var(--bg-3))"><span style="font:400 2.2rem/1 var(--display);color:var(--gold);font-style:italic">${esc(d.name[0])}</span></div>`;
  const dietLine = (d) => [d.cat, ...d.tags.map((t) => `<span class="${t === "spicy" ? "warn" : "ok"}">${DIET[t]}</span>`), d.allergens.length ? `Contains ${d.allergens.map((a) => ALLERGEN[a].toLowerCase()).join(", ")}` : d.reviewed ? "No listed allergens" : "Allergens not confirmed"].map((x) => `<span>${x}</span>`).join("");
  const priceHtml = (d) => `${d.from || (d.variants && d.variants.length) ? "<small>from</small>" : ""}${gbp(d.variants ? Math.min(...d.variants.map((v) => v[1])) : d.price)}`;
  const dishUrl = (d) => `dish.html#${d.slug}`;
  const dishCard = (d) => `<a class="dish" href="${dishUrl(d)}">${photo(d).replace("</div>", `${d.badge ? `<span class="tag-on">${d.badge}</span>` : ""}<span class="view">View</span></div>`)}<div class="row"><h3>${esc(d.name)}</h3><span class="pr">${priceHtml(d)}</span></div><p>${esc(d.desc)}</p><div class="diet">${dietLine(d)}</div></a>`;

  /* ================= Menu browser ================= */
  function menuBrowser(root) {
    const f = root.dataset.filter || "all";
    let items = DISHES.filter((d) => f === "all" ? true : f === "food" ? !d.drink : f === "drink" ? d.drink : f === "seasonal" ? d.seasonal : f === "special" ? d.special : f.startsWith("cat:") ? d.cat.toLowerCase() === (location.hash.slice(1) || f.slice(4)).toLowerCase().replace(/-/g, " ") : true);
    if (f.startsWith("cat:")) { const c = items[0]?.cat; const h = $("#cat-title"); if (h && c) h.textContent = c; }
    const cats = [...new Set(items.map((d) => d.cat))];
    const tags = [...new Set(items.flatMap((d) => d.tags))], alls = [...new Set(items.flatMap((d) => d.allergens))].sort();
    const st = { q: "", tags: new Set(), avoid: new Set() };
    root.innerHTML = `<div class="mtools"><div class="wrap">
      <div class="row1"><label class="search">${ICON.search}<span class="sr">Search the menu</span><input type="search" id="mq" placeholder="Search the menu" autocomplete="off"></label>
      <details class="fbox"><summary>Filters <span id="fcount"></span></summary><div class="filters">
        <div class="grp"><span class="tag gold">Diet</span><div class="chips">${tags.map((t) => `<button type="button" class="chip" data-tag="${t}" aria-pressed="false">${DIET[t]}</button>`).join("")}</div></div>
        <div class="grp"><span class="tag gold">Without</span><div class="chips">${alls.map((a) => `<button type="button" class="chip" data-avoid="${a}" aria-pressed="false">${ALLERGEN[a]}</button>`).join("")}</div></div>
        <button type="button" class="link" id="fclear">Clear filters</button></div></details></div>
      ${root.dataset.cats !== "false" && cats.length > 1 ? `<nav class="cats" aria-label="Menu sections">${cats.map((c) => `<a href="#cat-${c.toLowerCase().replace(/\s+/g, "-")}">${c}</a>`).join("")}</nav>` : ""}
      </div></div><div class="wrap" id="mbody"></div>`;
    const body = $("#mbody", root);
    function draw() {
      const q = st.q.trim().toLowerCase();
      const shown = items.filter((d) => (!q || `${d.name} ${d.desc} ${d.cat}`.toLowerCase().includes(q)) && [...st.tags].every((t) => d.tags.includes(t)) && ![...st.avoid].some((a) => d.allergens.includes(a)));
      $("#fcount", root).textContent = st.tags.size + st.avoid.size ? `(${st.tags.size + st.avoid.size})` : "";
      if (!shown.length) { body.innerHTML = `<div class="empty"><h3>Nothing matches those filters</h3><p>Try fewer filters, or ask your server: the kitchen can often adapt a dish.</p><button type="button" class="btn quiet" id="fclear2">Clear filters</button></div>`; $("#fclear2").onclick = clear; return; }
      body.innerHTML = [...new Set(shown.map((d) => d.cat))].map((c) => `<section class="mcat" id="cat-${c.toLowerCase().replace(/\s+/g, "-")}"><header><h2>${c}</h2><a class="link" href="menu-category.html#${c.toLowerCase().replace(/\s+/g, "-")}">Only ${c.toLowerCase()}</a></header><div class="mlist">${shown.filter((d) => d.cat === c).map((d) => `<a class="mi${d.unavail ? " unavail" : ""}" href="${dishUrl(d)}">${photo(d, "")}<div><div class="ln"><span class="nm">${esc(d.name)}</span><span class="dots"></span><span class="pr">${priceHtml(d)}</span></div><p>${esc(d.desc)}</p><div class="diet">${dietLine({ ...d, cat: "" }).replace("<span></span>", "")}</div></div></a>`).join("")}</div></section>`).join("");
    }
    function clear() { st.tags.clear(); st.avoid.clear(); st.q = ""; $("#mq", root).value = ""; $$(".chip", root).forEach((c) => c.setAttribute("aria-pressed", "false")); draw(); }
    $("#mq", root).addEventListener("input", (e) => { st.q = e.target.value; draw(); });
    $$("[data-tag]", root).forEach((b) => b.onclick = () => { const on = !st.tags.has(b.dataset.tag); on ? st.tags.add(b.dataset.tag) : st.tags.delete(b.dataset.tag); b.setAttribute("aria-pressed", on); draw(); });
    $$("[data-avoid]", root).forEach((b) => b.onclick = () => { const on = !st.avoid.has(b.dataset.avoid); on ? st.avoid.add(b.dataset.avoid) : st.avoid.delete(b.dataset.avoid); b.setAttribute("aria-pressed", on); draw(); });
    $("#fclear", root).onclick = clear;
    draw();
  }

  /* ================= Dish detail ================= */
  function dishPage(root) {
    const d = DISHES.find((x) => x.slug === location.hash.slice(1)) || DISHES[0]; if (!d) { location.replace("menu.html"); return; }
    document.title = `${d.name} · ${BRAND.tabTitle || BRAND.name}`;
    const back = d.drink ? ["menu-beverages.html", "Beverages"] : ["menu.html", "Menu"];
    const rel = DISHES.filter((x) => x.cat === d.cat && x.slug !== d.slug).concat(DISHES.filter((x) => x.drink === d.drink && x.cat !== d.cat)).slice(0, 4);
    const al = d.allergens.length ? `<div class="allergen"><h3>Allergens</h3><p>Contains <b>${d.allergens.map((a) => ALLERGEN[a]).join(", ")}</b>.</p></div>` : d.reviewed ? `<div class="allergen clear"><h3>Allergens</h3><p>No listed allergens.</p></div>` : `<div class="allergen unknown"><h3>Allergens</h3><p>Allergen information has not been confirmed for this item. Please ask your server.</p></div>`;
    root.innerHTML = `<div class="wrap" style="padding-top:calc(84px + 60px + env(safe-area-inset-top,0px))">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span aria-hidden="true">/</span><a href="${back[0]}">${back[1]}</a><span aria-hidden="true">/</span><span>${esc(d.cat)}</span></nav>
      <div class="dd" style="margin-top:34px">${photo(d)}<div class="info">
        <span class="label">${esc(d.cat)}${d.badge ? " · " + d.badge : ""}</span><h1>${esc(d.name)}</h1><p class="muted" style="font-size:1.15rem">${esc(d.desc)}</p>
        ${d.unavail ? notice("err", "Sold out today. It is usually back tomorrow.") : ""}
        <div class="price-big">${priceHtml(d)}</div>
        ${d.tags.length ? `<div class="chips">${d.tags.map((t) => `<span class="chip">${DIET[t]}</span>`).join("")}</div>` : ""}
        ${d.variants ? `<div class="stack-sm"><span class="tag gold">Sizes and options</span><div class="opts">${d.variants.map(([n, p]) => `<div><b>${n}</b><span>${gbp(p)}</span></div>`).join("")}</div></div>` : ""}
        ${d.extras ? `<div class="stack-sm"><span class="tag gold">Extras</span><div class="opts">${d.extras.map(([n, p]) => `<div><b>${n}</b><span>+${gbp(p)}</span></div>`).join("")}</div></div>` : ""}
        ${al}
        ${notice("info", "Please tell your server about any allergy or dietary need before you order.")}
        <div class="acts"><a class="btn solid" href="book.html">Reserve a table ${ICON.arrow}</a><a class="btn quiet" href="${back[0]}">Back to the ${back[1].toLowerCase()}</a></div>
      </div></div></div>
      <section class="sec"><div class="wrap"><div class="head-row"><div><span class="label">You may also like</span><h2>More from <em>${d.drink ? "the bar" : "the kitchen"}.</em></h2></div></div><div class="reel">${rel.map(dishCard).join("")}</div></div></section>`;
  }

  /* ================= Events and tickets ================= */
  function eventsPage(root) {
    root.innerHTML = EVENTS.map((e) => `<article class="event" id="ev-${e.slug}"><div class="date"><b>${e.day}</b><span>${e.wd} · ${e.mon}</span></div><div><h3>${e.title}</h3><p>${e.desc}</p></div>
      <div class="meta"><span>${e.sessions.length} ${e.sessions.length === 1 ? "date" : "dates"}</span><span>${e.sessions[0].price ? "From " + gbp(Math.min(...e.sessions.map((s) => s.price))) : '<span class="free">Free</span>'}</span></div><span></span>
      <div class="sessions">${e.sessions.map((s) => `<div class="session" data-s="${s.id}"><div><div class="when">${s.when}</div><span class="small ${s.left === 0 ? "soldout" : s.left <= 10 ? "left-few" : "muted"}">${s.left === 0 ? "Sold out" : s.left <= 10 ? `Only ${s.left} left` : "Tickets available"}</span></div><span class="pr">${gbp(s.price)}</span>${s.left ? `<button class="btn sm" type="button" data-buy="${s.id}" aria-expanded="false">Get tickets</button>` : `<span class="tag">Sold out</span>`}</div>`).join("")}</div></article>`).join("");
    $$("[data-buy]").forEach((b) => b.onclick = () => {
      const open = $(".buy"); if (open) { open.previousElementSibling?.querySelector("[data-buy]")?.setAttribute("aria-expanded", "false"); open.remove(); if (open.dataset.for === b.dataset.buy) return; }
      const ev = EVENTS.find((e) => e.sessions.some((s) => s.id === b.dataset.buy)), s = ev.sessions.find((x) => x.id === b.dataset.buy);
      b.setAttribute("aria-expanded", "true");
      b.closest(".session").insertAdjacentHTML("afterend", `<form class="buy form" data-for="${s.id}" novalidate><div class="form-grid">
        <div class="field"><label for="t-q">Tickets</label><select class="select" id="t-q">${Array.from({ length: Math.min(10, s.left) }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></div>
        <div class="field"><label for="t-n">Your name</label><input class="input" id="t-n" autocomplete="name" data-fill="name" data-v="name" required></div>
        <div class="field full"><label for="t-c">Phone or email</label><input class="input" id="t-c" autocomplete="email" data-fill="contact" data-v="contact" required></div>
        <label class="check full"><input type="checkbox" id="t-ok" required> I agree to be contacted about this order.</label></div>
        <p class="small muted">Seats are held for 15 minutes. You pay the venue; your tickets appear once payment is recorded.</p><div id="t-err"></div>
        <div class="acts"><button class="btn solid">Reserve tickets ${ICON.arrow}</button></div></form>`);
      draft.bind($(".buy"), "tickets-" + s.id);
      $(".buy").onsubmit = async (e) => { e.preventDefault(); const f = $(".buy"); if (!validate(f)) return; const btn = $("button:not([type=button])", f); btn.disabled = true; const label = btn.innerHTML; btn.textContent = "Reserving…";
        const r = await api("POST", "/ticket-orders", { sessionId: s.id, quantity: Number($("#t-q").value), clientRequestId: crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2), buyerName: $("#t-n").value.trim(), buyerContact: $("#t-c").value.trim(), consentToContact: true });
        if (!r.ok) { btn.disabled = false; btn.innerHTML = label; $("#t-err").innerHTML = notice("err", r.data.error || "We could not reserve those tickets. Please try again."); return; }
        const orders = store.get("orders", []); orders.unshift({ id: r.data.order.id, token: r.data.token, title: ev.title, when: s.when, made: Date.now() }); store.set("orders", orders.slice(0, 20)); draft.clear("tickets-" + s.id); location.href = "tickets.html"; };
    });
  }
  function drawQr() {
    $$("[data-qr]").forEach((el) => {
      if (el.dataset.done) return; el.dataset.done = 1;
      if (window.QRCode) { try { new window.QRCode(el, { text: el.dataset.qr, width: 140, height: 140, colorDark: "#0c0b0a", colorLight: "#f2ebe0" }); return; } catch {} }
      el.innerHTML = `<code class="small" style="word-break:break-all">${esc(el.dataset.qr)}</code>`; return;
      const c = document.createElement("canvas"), n = 25, s = 140 / n; c.width = c.height = 140; const g = c.getContext("2d"); g.fillStyle = "#f2ebe0"; g.fillRect(0, 0, 140, 140); g.fillStyle = "#0c0b0a";
      let h = 0; for (const ch of el.dataset.qr) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { h = (h * 1103515245 + 12345) >>> 0; if (h % 2) g.fillRect(x * s, y * s, s, s); }
      [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => { g.fillStyle = "#0c0b0a"; g.fillRect(x * s, y * s, 7 * s, 7 * s); g.fillStyle = "#f2ebe0"; g.fillRect((x + 1) * s, (y + 1) * s, 5 * s, 5 * s); g.fillStyle = "#0c0b0a"; g.fillRect((x + 2) * s, (y + 2) * s, 3 * s, 3 * s); });
      el.append(c);
    });
  }

  function tablePage(root) { root.innerHTML = notice("info", "Table ordering starts when you scan the QR code on your table at the restaurant. For pickup or delivery, use <a class='textlink' href='order.html'>Order online</a>."); }

  /* ================= Generic forms, gift cards, unsubscribe, stars ================= */
  function forms() {
    $$("form[data-success]").forEach((f) => { draft.bind(f, "f-" + (f.id || location.pathname)); f.addEventListener("submit", (e) => {
      e.preventDefault();
      const r = $(".rate", f), rated = !r || $("input:checked", r);
      const err = $(".form-err", f), ok = validate(f);
      if (!ok || !rated) { err.innerHTML = notice("err", !ok ? "Please fix the highlighted fields." : "Please choose a star rating."); return; }
      err.innerHTML = ""; const pre = f.id.slice(0, 2), kind = { ct: "contact", pr: "press", pt: "partner", fb: "feedback", cr: "career" }[f.id];
      const v = (k) => ($("#" + f.id + "-" + k, f)?.value || "").trim(), btn = $("button[type=submit]", f), label = btn.innerHTML;
      if (!kind) return;
      if (!v("e") && !v("p")) { err.innerHTML = notice("err", "Please give an email or a phone number so we can reply."); return; }
      const rating = Number($("input[name=" + f.id + "-r]:checked", f)?.value) || null;
      const body = { kind, category: v("c") || null, name: v("n"), email: v("e") || null, phone: v("p") || null, subject: v("s") || null, message: v("m") || (kind === "feedback" ? "(rating only)" : ""), allowContact: !!$("#" + f.id + "-ac", f)?.checked || kind !== "feedback" };
      if (rating) body.rating = rating;
      btn.disabled = true; btn.textContent = "Sending…";
      api("POST", "/messages", body).then((r) => {
        if (!r.ok) { btn.disabled = false; btn.innerHTML = label; err.innerHTML = notice("err", r.data.error || "We could not send your message. Please try again."); return; }
        draft.clear("f-" + (f.id || location.pathname));
        f.outerHTML = success(f.dataset.title || "Thank you", f.dataset.success, f.dataset.next ? `<a class="link" href="${f.dataset.next}">${f.dataset.nextLabel || "Continue"}</a>` : "");
      });
    }); });
    $$(".rate").forEach((r) => { const ls = $$("label", r); const paint = (n) => ls.forEach((l, i) => l.classList.toggle("on", i < n)); ls.forEach((l, i) => { l.addEventListener("mouseenter", () => paint(i + 1)); $("input", l).addEventListener("change", () => { paint(i + 1); r.dataset.v = i + 1; }); }); r.addEventListener("mouseleave", () => paint(Number(r.dataset.v || 0))); });
    const g = $("#giftf");
    if (g) g.onsubmit = async (e) => { e.preventDefault(); const c = $("#g-code").value.trim(), out = $("#g-out"); if (c.length < 8) { out.innerHTML = notice("err", "That code looks too short. Please check it."); return; } const b = $("button:not([type=button])", g); b.disabled = true; const r = await api("POST", "/gift-cards/balance", { code: c }); b.disabled = false; if (!r.ok) { out.innerHTML = notice("err", r.status === 404 ? "We could not find a gift card with that code. Check it and try again." : r.data.error || "We could not check that card. Please try again."); return; } const d = r.data; out.innerHTML = `<div class="box raise stack-sm" style="margin-top:6px"><span class="tag gold">${d.status === "active" ? "Balance" : d.status === "cancelled" ? "Cancelled" : "Expired"}</span><div class="big-num" style="font-size:4.4rem">${gbp(d.balanceMinor)}</div>${d.expiresAt ? `<p class="small muted">${d.status === "expired" ? "Expired" : "Valid until"} ${new Date(d.expiresAt).toLocaleDateString(BRAND.locale, { day: "numeric", month: "long", year: "numeric", timeZone: BRAND.tz })}</p>` : ""}</div>`; };
    const u = $("#unsub");
    if (u) u.onclick = () => { $("#unsub-box").innerHTML = success("You are unsubscribed", "You will still get messages about your bookings and orders.", `<a class="link" href="./">Back to the home page</a>`); };
    $$("[data-stars]").forEach((s) => { s.innerHTML = stars(Number(s.dataset.stars)); });
  }

  /* ================= Lightbox, reels, copy, misc ================= */
  function lightbox() {
    const shots = $$("[data-lightbox] button"); if (!shots.length) return;
    document.body.insertAdjacentHTML("beforeend", `<div class="lightbox" id="lightbox" data-open="false" role="dialog" aria-modal="true" aria-label="Photo viewer"><button class="x" type="button" id="lb-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6 6 18"/></svg></button><button class="nv p" type="button" id="lb-p" aria-label="Previous photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 5l-7 7 7 7"/></svg></button><figure><img id="lb-img" alt=""><figcaption id="lb-cap"></figcaption></figure><button class="nv n" type="button" id="lb-n" aria-label="Next photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5l7 7-7 7"/></svg></button></div>`);
    const lb = $("#lightbox"); let li = 0, last;
    const show = (i) => { li = (i + shots.length) % shots.length; const im = $("img", shots[li]); $("#lb-img").src = im.src; $("#lb-img").alt = im.alt; $("#lb-cap").textContent = shots[li].dataset.cap || im.alt; };
    const set = (o) => { lb.dataset.open = o; document.body.style.overflow = o ? "hidden" : ""; o ? $("#lb-x").focus() : last?.focus(); };
    shots.forEach((b, i) => b.addEventListener("click", () => { last = b; show(i); set(true); }));
    $("#lb-x").onclick = () => set(false); $("#lb-p").onclick = () => show(li - 1); $("#lb-n").onclick = () => show(li + 1);
    lb.addEventListener("click", (e) => { if (e.target === lb) set(false); });
    document.addEventListener("keydown", (e) => { if (lb.dataset.open !== "true") return; if (e.key === "Escape") set(false); if (e.key === "ArrowLeft") show(li - 1); if (e.key === "ArrowRight") show(li + 1); });
  }

  function chrome() {
    const head = $("#head"), flat = document.body.classList.contains("flat");
    const solid = () => head.classList.toggle("solid", flat || scrollY > 60);
    addEventListener("scroll", solid, { passive: true }); solid();
    const more = $("#more"), mb = $("#more-btn"), mp = $("#more-panel");
    const setMore = (o) => { more.dataset.open = o; mb.setAttribute("aria-expanded", o); mp.hidden = !o; };
    mb.onclick = (e) => { e.stopPropagation(); setMore(mp.hidden); };
    document.addEventListener("click", (e) => { if (!more.contains(e.target)) setMore(false); });
    const mnav = $("#mnav"), burger = $("#burger");
    const setNav = (o) => { mnav.dataset.open = o; burger.setAttribute("aria-expanded", o); document.body.style.overflow = o ? "hidden" : ""; if (o) $("#mclose").focus(); };
    burger.onclick = () => setNav(true); $("#mclose").onclick = () => { setNav(false); burger.focus(); };
    $$("a", mnav).forEach((a) => a.addEventListener("click", () => setNav(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setMore(false); if (mnav.dataset.open === "true") { setNav(false); burger.focus(); } } });
  }

  function misc() {
    document.addEventListener("click", async (e) => { const b = e.target.closest("[data-copy]"); if (!b) return; try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "Selected"; } setTimeout(() => { b.textContent = "Copy"; }, 1800); });
    /* Sliders: arrows sit on the left and right edges of the cards, and the row slides on its own (paused on hover, focus, touch, hidden tabs and reduced motion). */
    $$(".reel").forEach((r) => {
      if (r.parentElement.classList.contains("reel-wrap")) return;
      const w = document.createElement("div"); w.className = "reel-wrap"; r.parentNode.insertBefore(w, r); w.appendChild(r);
      const sec = r.closest("section"); $$(".arrows", sec).forEach((a) => (a.hidden = true));
      const arrow = (d) => { const b = document.createElement("button"); b.type = "button"; b.className = "reel-btn " + (d < 0 ? "prev" : "next"); b.setAttribute("aria-label", d < 0 ? "Previous" : "Next"); b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="' + (d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7") + '"/></svg>'; w.appendChild(b); b.onclick = () => { step(d); rest(); }; };
      const card = () => { const c = r.firstElementChild; return c ? c.getBoundingClientRect().width + (parseFloat(getComputedStyle(r).columnGap) || 0) : r.clientWidth * .75; };
      const atEnd = () => r.scrollLeft + r.clientWidth >= r.scrollWidth - 4;
      const step = (d) => { if (d > 0 && atEnd()) r.scrollTo({ left: 0, behavior: "smooth" }); else if (d < 0 && r.scrollLeft <= 4) r.scrollTo({ left: r.scrollWidth, behavior: "smooth" }); else r.scrollBy({ left: d * card(), behavior: "smooth" }); };
      arrow(-1); arrow(1);
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches; let held = false, pause = 0;
      const rest = () => { pause = Date.now() + 6000; };
      ["mouseenter", "focusin", "touchstart", "pointerdown"].forEach((e) => w.addEventListener(e, () => { held = true; }));
      ["mouseleave", "focusout", "touchend"].forEach((e) => w.addEventListener(e, () => { held = false; rest(); }));
      if (!still) setInterval(() => { if (held || document.hidden || Date.now() < pause || r.scrollWidth <= r.clientWidth + 8) return; const b = r.getBoundingClientRect(); if (b.bottom < 0 || b.top > innerHeight) return; step(1); }, 4000);
    });
    // Home page hooks
    if ($("#locs")) $("#locs").innerHTML = locCards(false);
    if ($("#locs-full")) $("#locs-full").innerHTML = locCards(true);
    if (LOCS.length === 1 && SITE?.locations?.[0]) { const l0 = SITE.locations[0], q = [BRAND.name, l0.address?.line1, l0.address?.line2, l0.address?.city, l0.address?.postcode].filter(Boolean).join(", "); $$("#locs, #locs-full").forEach((fl) => { if (q && !$(".find-ph", fl)) fl.insertAdjacentHTML("beforeend", `<div class="find-ph"><iframe title="Map to ${esc(BRAND.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed" loading="eager" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`); }); }
    const ho = $("#hero-open"); if (ho) { const s = status(LOCS[0]); ho.className = "open" + (s.open ? "" : " closed"); const sp = $("span", ho); if (sp) sp.textContent = `${s.text} · ${LOCS[0].name}`; }
    $$(".quote .stars[data-n]").forEach((s) => { s.innerHTML = stars(Number(s.dataset.n)); });
    if ($("#stars-main")) $("#stars-main").innerHTML = stars(5);
    const sn = $("#slide-name"); if (sn) { const caps = ["The dining room", "Harbour Street, evening", "Chef Marco at the pass"]; let i = 0; setInterval(() => { i = (i + 1) % 3; sn.textContent = caps[i]; }, 8000); }
    const rf = $("#resform"); if (rf) { const rd = $("#r-date"), iso = (d) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); rd.min = rd.value = iso(now); rd.max = iso(new Date(+now + 90 * 864e5)); rf.onsubmit = (e) => { e.preventDefault(); location.href = `book.html?size=${$("#r-size").value}`; }; }
    const pimg = $("#private-img"); if (pimg && matchMedia("(prefers-reduced-motion: no-preference)").matches) { const pv = pimg.parentElement; addEventListener("scroll", () => { const r = pv.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) pimg.style.transform = `translateY(${(r.top - innerHeight / 2) * -0.08}px)`; }, { passive: true }); }
    // Visit: map pins and closures
    const map = $("#map"); if (map) map.innerHTML = `<div class="water"></div>${LOCS.map((l) => `<a class="pin" href="${mapUrl(l)}" style="left:${l.x}%;top:${l.y}%"><span>${l.name}</span><i></i></a>`).join("")}`;
    const cl = $("#closures"); if (cl) cl.innerHTML = CLOSURES.map((c) => `<div><span><span class="nm">${new Date(c.date + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" })}</span> <span class="small faint">· ${c.where}</span></span><span class="muted">${c.reason}</span></div>`).join("");
    const pol = $("#policy-rules"); if (pol) pol.innerHTML = `<li>Book up to ${POLICY.maxAdvanceDays} days ahead, with at least ${POLICY.minNoticeMinutes} minutes' notice.</li><li>Online bookings are for up to ${POLICY.onlineMax} guests. For larger groups, send a private dining enquiry.</li><li>We hold an unconfirmed booking for ${POLICY.holdMinutes} minutes.</li><li>Cancel free up to ${POLICY.freeCancelHours} hours before your booking. Later cancellations and no-shows may be recorded.</li><li>We keep your table for ${POLICY.noShowGraceMinutes} minutes after your booking time.</li>`;
    // Lists built from data
    const sig = $("#sig-reel"); if (sig) sig.innerHTML = DISHES.filter((d) => !d.drink && d.img).map(dishCard).join("");
    const sp = $("#specials-reel"); if (sp) sp.innerHTML = DISHES.filter((d) => d.special).map(dishCard).join("");
  }

  /* ================= Live data: brand, hours, menu, events, booking rules ================= */
  const DIET_ALIAS = { "gluten-free": "gf", gluten_free: "gf", "dairy-free": "df", dairy_free: "df", "nut-free": "nutfree", nut_free: "nutfree" };
  const ALLERGEN_ALIAS = { eggs: "egg", tree_nuts: "nuts", peanut: "peanuts", sulfites: "sulphites", sulphite: "sulphites" };
  const nice = (k) => String(k).replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
  const DAYKEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const PINS = [[30, 46], [58, 38], [76, 80], [20, 72], [48, 62], [68, 24]];
  const DRINK = /cocktail|wine|beer|drink|beverage|juice|coffee|tea\b|mocktail|soft|spirit|smoothie|shake|lemonade|water|bar\b/i;
  function mapEvent(e) {
    const ss = (e.sessions || []).map((s) => { const a = new Date(s.startsAt), b = s.endsAt ? new Date(s.endsAt) : null, o = { timeZone: BRAND.tz }, f = (d, x) => d.toLocaleString("en-GB", { ...o, ...x }), t = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
      return { id: s.id, start: a, when: `${f(a, { weekday: "long", day: "numeric", month: "long" })}, ${f(a, t)}${b ? "–" + f(b, t) : ""}`, price: s.priceMinor, left: s.remaining }; });
    const a = ss[0]?.start || new Date(), f = (x) => a.toLocaleString("en-GB", { timeZone: BRAND.tz, ...x });
    return { slug: e.id, day: f({ day: "2-digit" }), mon: f({ month: "short" }), wd: f({ weekday: "short" }), title: e.title, desc: e.description || "", img: null, sessions: ss };
  }
  let SITE = null;
  async function loadLive() {
    /* the 115 KB menu is only downloaded on pages that show dishes; every other page takes its branches from the site feed */
    const needMenu = /^(index|menu[a-z-]*|dish|order)$/.test((location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index");
    let [brand, menu, hours, policy, events, sections, site] = await Promise.all([api("GET", "/brand"), needMenu ? api("GET", "/menu") : null, api("GET", "/hours"), api("GET", "/booking-policy"), api("GET", "/events"), api("GET", "/sections"), api("GET", "/site")]);
    if (!menu) menu = site.ok && (site.data.locations || []).length ? { ok: true, data: { items: [], locations: site.data.locations.map((l) => ({ id: l.id, name: l.name, address: l.address, opening_hours: l.hours })) } } : await api("GET", "/menu");
    if (!brand.ok || !menu.ok) return false;
    Object.assign(BRAND, { live: true, name: brand.data.name || BRAND.name, currency: brand.data.currency || "GBP", locale: brand.data.locale || "en-GB", tagline: brand.data.tagline || "", phone: "", email: "", tabTitle: brand.data.tabTitle || "", logoUrl: brand.data.logoUrl ? brand.data.logoUrl : null });
    { const p = brand.data.palette, hx = /^#[0-9a-f]{6}$/i, st = document.documentElement.style, rgb = (x) => [1, 3, 5].map((n) => parseInt(x.slice(n, n + 2), 16)), mx = (a, b, t) => "#" + rgb(a).map((v, n) => Math.round(v + (rgb(b)[n] - v) * t).toString(16).padStart(2, "0")).join("");
      if (p && p.theme === "custom" && hx.test(p.primary || "") && hx.test(p.accent || "")) { st.setProperty("--gold", p.accent); st.setProperty("--gold-2", mx(p.accent, "#ffffff", .28)); st.setProperty("--brand", p.primary); [["--bg", "#0c0b0a"], ["--bg-2", "#141210"], ["--bg-3", "#1b1815"], ["--bg-4", "#241f1b"]].forEach(([v, b]) => st.setProperty(v, mx(b, p.primary, .08))); const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = mx("#0c0b0a", p.primary, .07); } }
    if (hours.ok && hours.data.timezone) BRAND.tz = hours.data.timezone;
    for (const x of sections.data.sections || []) { if (x.kind === "cta" && /^tel:/.test(x.href || "")) BRAND.phone = x.href.slice(4).replace(/%20/g, " "); if (x.kind === "cta" && /^mailto:/.test(x.href || "")) BRAND.email = x.href.slice(7); }
    if (site.ok) { SITE = site.data; BRAND.kind = SITE.business?.kind || ""; const c = SITE.business?.contact || {}; if (c.phone) BRAND.phone = c.phone; if (c.email) BRAND.email = c.email; BRAND.social = SITE.business?.social || {}; const mods = SITE.modules || []; if (mods.includes("ordering")) MORE[0][1].splice(1, 0, ["order.html", "Order online"]); const drop = (arr, f) => { for (let i = arr.length - 1; i >= 0; i--) if (f(arr[i])) arr.splice(i, 1); }; if (!mods.includes("events")) drop(MAIN_L, (x) => x[0] === "events.html"); if (!mods.includes("reservations")) drop(MORE[0][1], (x) => x[0] === "queue.html"); BRAND.tagline = SITE.business?.tagline || BRAND.tagline; }
    BRAND.sections = sections.data.sections || [];
    LOCS.splice(0, LOCS.length, ...(menu.data.locations || []).map((l, i) => { const a = l.address || {}, oh = l.opening_hours || {}; return { id: l.id, name: l.name, addr: [a.line1, a.line2, [a.city, a.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", "), x: PINS[i % PINS.length][0], y: PINS[i % PINS.length][1], hours: DAYKEYS.map((k) => (oh[k] || []).map((r) => [r.open, r.close])) }; }));
    DISHES.splice(0, DISHES.length, ...(menu.data.items || []).map((i) => {
      const tags = (i.dietary_tags || []).map((t) => DIET_ALIAS[t] || t), alls = (i.allergens || []).map((a) => ALLERGEN_ALIAS[a] || a);
      tags.forEach((t) => { if (!DIET[t]) DIET[t] = nice(t); }); alls.forEach((a) => { if (!ALLERGEN[a]) ALLERGEN[a] = nice(a); });
      const vs = (i.variants || []).map((v) => [v.name, v.priceMinor ?? v.price_minor]).filter((v) => v[0] && v[1] != null);
      const ex = (i.modifier_groups || []).flatMap((g) => (g.modifiers || []).map((m) => [m.name, m.priceDeltaMinor || 0]));
      if (i.image && !CATPIC[i.category || "Menu"]) CATPIC[i.category || "Menu"] = i.image;
      return D(i.id, i.name, i.category || "Menu", i.description || "", i.price_minor, { pic: i.image || null, tags, allergens: alls, reviewed: !!i.allergens_reviewed, loc: i.location_id || null, signature: i.signature === true, drink: DRINK.test(i.category || ""), ...(vs.length ? { variants: vs } : {}), ...(ex.length ? { extras: ex } : {}) });
    }));
    if (policy.ok && policy.data.policy) { const p = policy.data.policy; Object.assign(POLICY, { maxAdvanceDays: p.maxAdvanceDays, minNoticeMinutes: p.minNoticeMinutes, maxPartySize: p.maxPartySize, onlineMax: p.maxPartySize, holdMinutes: p.holdMinutes, freeCancelHours: p.freeCancelHours, noShowGraceMinutes: p.noShowGraceMinutes, durationMinutes: p.defaultDurationMinutes, text: p.text }); }
    EVENTS.splice(0, EVENTS.length, ...((events.data.events || []).map(mapEvent)));
    CLOSURES.length = 0; setClock(); LOGO = logoHtml();
    document.title = document.title.replace(/Harbour (&|&amp;) Vine/g, BRAND.name); if (BRAND.tabTitle && BRAND.tabTitle !== BRAND.name) document.title = document.title.split(BRAND.name).join(BRAND.tabTitle);
    return true;
  }

  /* ================= Boot ================= */
  const refreshAcct = () => { const u = user(); $$(".acct-link").forEach((a) => { a.setAttribute("aria-label", u ? "My account" : "Sign in"); const sp = $("span", a); if (sp) sp.textContent = u ? u.name.split(" ")[0] : "Sign in"; }); const m = $("#mnav .acts a"); if (m) m.textContent = u ? "My account" : "Sign in"; };
  const ready = Promise.race([loadLive().catch(() => false), new Promise((r) => setTimeout(() => r(false), 7000))]);
  window.HV = { catImg, refreshAcct, $, $$, esc, store, notice, success, draft, validate, enhance, user, gbp, ICON, api, tokenStore, signedIn, BRAND, LOCS, POLICY, DISHES, EVENTS, ready, stars, get SITE() { return SITE; } };
  ready.then((live) => {
    if (!live || !SITE) document.documentElement.classList.add("hv-live");
    header(); footer(); dock(); chrome(); misc(); forms(); lightbox();
    if (!live) $("#main")?.insertAdjacentHTML("afterbegin", `<div class="wrap" style="padding-top:96px">${notice("err", "The restaurant's online system is not reachable at the moment, so booking and sign-in are unavailable. Please try again shortly or call us.")}</div>`);
    const pages = { menu: menuBrowser, dish: dishPage, events: eventsPage, table: tablePage, ...(window.HV.pages || {}) };
    $$("[data-app]").forEach((el) => pages[el.dataset.app]?.(el));
    if ($("[data-app=dish]")) addEventListener("hashchange", () => { dishPage($("[data-app=dish]")); scrollTo(0, 0); });
    if ($("[data-app=menu][data-filter^=cat]")) addEventListener("hashchange", () => menuBrowser($("[data-app=menu]")));
    /* premium cards: cursor glow and a gentle 3-D tilt (fine pointers only, never with reduced motion) */
    if (matchMedia("(hover: hover) and (pointer: fine)").matches && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const SEL = ".card, .post, .dish.lux, .tiles > *";
      document.addEventListener("pointermove", (e) => { const c = e.target.closest?.(SEL); if (!c) return; const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; c.style.setProperty("--mx", (x * 100).toFixed(1) + "%"); c.style.setProperty("--my", (y * 100).toFixed(1) + "%"); if (!c.matches(".tiles > *")) { c.style.setProperty("--rx", ((0.5 - y) * 7).toFixed(2) + "deg"); c.style.setProperty("--ry", ((x - 0.5) * 9).toFixed(2) + "deg"); } }, { passive: true });
      document.addEventListener("pointerout", (e) => { const c = e.target.closest?.(SEL); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); } }, { passive: true });
    }
    /* cms.js is a deferred script on every page; it waits for HV.ready itself */
    document.dispatchEvent(new CustomEvent("hv:ready", { detail: { live } }));
  });
})();
