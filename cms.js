/* Template 001 content binding. Every heading, paragraph, list and photo on the fixed pages comes from the restaurant's admin portal
   (Page Content, Team, Offers, FAQs, Press, Jobs, Gallery, Business details) via GET /api/public/site. Nothing is typed twice.
   Where the business has added nothing yet, the page shows an honest empty state, never sample text. */
(async () => {
  const H = window.HV; if (!H) return; await H.ready; const S = H.SITE; if (!S) return;
  /* Photos are served as right-sized AVIF/WebP through the runtime image optimiser instead of the 500 KB originals. */
  const opt = (u, w) => (/^\/api\/public\/media\//.test(u || "") ? `/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75` : u);
  S.photos.forEach((p) => { p.hero = opt(p.url, 1920); p.url = opt(p.url, 1080); });
  for (const k of ["team", "experiences", "offers", "press", "awards", "jobs"]) (S[k] || []).forEach((e) => { e.imageUrl = opt(e.imageUrl, 640); });
  Object.values(S.pages || {}).forEach((p) => { p.imageUrl = opt(p.imageUrl, 1920); });
  const { $, $$, esc, stars, BRAND } = H;
  const file = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  // Ratings as shown on each platform's public listing (last checked 18 Nov 2026), plus excerpts from Google reviews. Guest reviews left on this site are added after them.
  const PLATFORMS = [{ n: "Google", r: 4.7, c: "746 reviews" }, { n: "Swiggy", r: 4.7, c: "729 reviews" }, { n: "Zomato", r: 4.4, c: "282 votes" }, { n: "Facebook", r: 5, c: "1 vote", u: "https://www.facebook.com/chefandmixologist/" }];
  const GQUOTES = [{ rating: 5, message: "Food, service, behaviour of staff and ambience are equally good.", name: "Google review" }, { rating: 5, message: "The menu offers something for everyone - food, drinks and coffee.", name: "Google review" }, { rating: 5, message: "Special mention - Thai green curry and Cream cheese & water chestnut dumpling.", name: "Google review" }];
  const revData = () => { const own = (S.reviews.items || []).filter((q) => q.name !== "Sample"); return { average: PLATFORMS[0].r, count: 746, items: [...GQUOTES, ...own], own }; };
  const platBand = () => `<ul class="plat" aria-label="Ratings on other sites">${PLATFORMS.map((p) => `<li><b>${p.r.toFixed(1)}<small>/5</small></b><span>${p.u ? `<a href="${p.u}" rel="noopener" target="_blank">${p.n}</a>` : p.n}</span><em>${p.c}</em></li>`).join("")}</ul>`;
  const SLOT = { "menu": "menu", "menu-beverages": "beverages", "menu-specials": "todays-specials", "menu-seasonal": "seasonal", "our-team": "our-team", "experiences": "experiences", "private-dining": "private-dining", "offers": "offers", "gallery": "gallery", "reviews": "reviews", "visit": "visit", "contact": "contact", "gift-cards": "gift-cards", "press": "press", "careers": "careers", "partners": "partners", "faq": "faq", "feedback": "feedback", "privacy": "privacy", "terms": "terms", "reservation-policy": "reservation-policy", "refund-policy": "refund-policy", "cookies": "cookies", "accessibility": "accessibility", "order": "order" };
  const page = S.pages[SLOT[file]];
  const img = (u, alt = "") => (u ? `<div class="photo r45"><img decoding="async" src="${esc(u)}" alt="${esc(alt)}" loading="lazy"></div>` : "");
  const holder = (label, cls = "r45") => `<div class="photo ${cls} ph-fill" aria-hidden="true"><span>${esc((label || "?").trim().charAt(0).toUpperCase())}</span></div>`;
  const empty = (t) => `<p class="muted">${esc(t)}</p>`;
  const safeUrl = (u) => (/^(https?:|mailto:|tel:|\/)/i.test(u || "") ? u : "");
  const em = (t) => { const w = String(t).trim().split(/\s+/); if (w.length < 2) return esc(t); const k = Math.max(1, Math.ceil(w.length / 2)); return `${esc(w.slice(0, w.length - k).join(" "))} <em>${esc(w.slice(-k).join(" "))}</em>`.trim(); };
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\[(.+?)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a class="textlink" href="$2">$1</a>');
  /** "## Heading", "- item", "1. item" and paragraphs: the same light markup the admin's Page Content help describes. */
  const md = (src) => { const out = []; let list = null; const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const raw of String(src || "").split("\n")) { const l = raw.trim(); let m;
      if (!l) { close(); continue; }
      if ((m = l.match(/^#{1,3}\s+(.*)/))) { close(); out.push(`<h2 class="h3" style="margin-top:30px">${inline(m[1])}</h2>`); }
      else if ((m = l.match(/^[-*]\s+(.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^\d+\.\s+(.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
      else { close(); out.push(`<p class="muted">${inline(l)}</p>`); } }
    close(); return out.join(""); };
  const dateOf = (d) => { try { return new Date(d).toLocaleDateString(BRAND.locale, { day: "numeric", month: "long", year: "numeric", timeZone: BRAND.tz }); } catch { return ""; } };
  const section = (cls, inner) => `<section class="${cls}"><div class="wrap">${inner}</div></section>`;
  const swap = (sel, html, root = document) => { const el = $(sel, root); if (el) el.outerHTML = html; return !!el; };
  const hero = $(".opener .wrap, .ph-hero .wrap");

  /* ---- page heading, intro and optional image come from Page Content ---- */
  if (page && hero) {
    const h1 = $("h1", hero), sub = $(".sub", hero), lab = $(".label", hero), crumb = $(".crumbs span:last-child", hero);
    if (h1 && page.title) h1.innerHTML = em(page.title);
    if (sub) { sub.textContent = page.sub || ""; sub.hidden = !page.sub; }
    if (lab) lab.textContent = page.label; if (crumb) crumb.textContent = page.label;
    const pic = $(".ph-hero > img"); if (pic && page.imageUrl) pic.src = page.imageUrl;
    document.title = `${page.title} · ${BRAND.tabTitle || BRAND.name}`;
  }
  const after = (html) => { const first = $(".opener, .ph-hero"); if (first && html) first.insertAdjacentHTML("afterend", html); };
  const LEGAL = ["privacy", "terms", "reservation-policy", "refund-policy", "cookies", "accessibility"];
  const POLICY_ROWS = () => { const p = H.POLICY || {}; return `<div class="lines" style="margin-top:26px"><div><span>Book up to</span><span>${p.maxAdvanceDays} days ahead</span></div><div><span>Online party size</span><span>up to ${p.maxPartySize}</span></div><div><span>Minimum notice</span><span>${p.minNoticeMinutes} minutes</span></div><div><span>Free cancellation</span><span>${p.freeCancelHours} hours before</span></div><div><span>Table held after your time</span><span>${p.noShowGraceMinutes} minutes</span></div></div>`; };
  if (LEGAL.includes(file) && page) {
    $$("main > .sec, main > section:not(.opener):not(.ph-hero)").forEach((s) => s.remove());
    after(section("sec", `<div class="read">${md(page.body)}${file === "reservation-policy" ? POLICY_ROWS() : ""}</div>`));
  }

  /* ---- collections ---- */
  const entryCard = (e, tag) => `<article class="card">${img(e.imageUrl, e.title)}${tag ? `<span class="tag gold">${esc(tag)}</span>` : ""}<h3>${esc(e.title)}</h3>${e.body ? `<p>${esc(e.body)}</p>` : ""}${safeUrl(e.linkUrl) ? `<a class="link" href="${esc(e.linkUrl)}">Learn more</a>` : ""}</article>`;
  const COLL = {
    "our-team": () => swap("main .grid-3", S.team.length ? `<div class="grid-3">${S.team.map((e) => entryCard(e, e.subtitle).replace('<article class="card">', '<article class="card">' + (e.imageUrl ? "" : holder(e.title)))).join("")}</div>` : empty("Our team will be introduced here soon.")),
    "experiences": () => swap("main .sec .grid-2", S.experiences.length ? `<div class="grid-2">${S.experiences.map((e) => entryCard(e, e.subtitle)).join("")}</div>` : empty("Dining experiences will be listed here soon.")),
    "offers": () => swap("main .tiles", S.offers.length ? `<div class="tiles">${S.offers.map((e) => `<article>${e.subtitle ? `<span class="tag gold">${esc(e.subtitle)}</span>` : ""}<h3>${esc(e.title)}</h3>${e.body ? `<p>${esc(e.body)}</p>` : ""}${e.validTo ? `<p class="small faint">Until ${esc(dateOf(e.validTo))}</p>` : ""}</article>`).join("")}</div>` : empty("There are no offers right now. Please check back soon.")),
    "faq": () => swap("main .acc", S.faqs.length ? `<div class="acc">${S.faqs.map((e, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(e.title)}</summary><div class="body">${esc(e.body || "")}</div></details>`).join("")}</div>` : empty("Questions and answers will appear here soon.")),
    "gallery": () => swap("main .masonry", S.photos.length ? `<div class="masonry" data-lightbox>${S.photos.map((p) => `<button type="button" data-cap="${esc(p.alt || "")}"><img decoding="async" src="${esc(p.url)}" alt="${esc(p.alt || "")}" loading="lazy">${p.alt ? `<span>${esc(p.alt)}</span>` : ""}</button>`).join("")}</div>` : empty("Photos will be added here soon.")),
    "press": () => { swap("main .grid-3", S.press.length ? `<div class="grid-3">${S.press.map((e) => `<article class="box stack-md">${e.subtitle ? `<span class="tag gold">${esc(e.subtitle)}</span>` : ""}<p style="font:400 1.4rem/1.35 var(--display);font-style:italic">${esc(e.title)}</p>${e.body ? `<span class="small faint">${esc(e.body)}</span>` : ""}${safeUrl(e.linkUrl) ? `<a class="link" href="${esc(e.linkUrl)}" rel="noopener">Read</a>` : ""}</article>`).join("")}</div>` : empty("No press yet."));
      swap("main .lines", S.awards.length ? `<div class="lines">${S.awards.map((a) => `<div><span class="nm">${esc(a.title)}</span><span class="muted">${esc(a.subtitle || "")}</span></div>`).join("")}</div>` : empty("No awards listed yet.")); },
    "careers": () => { const acc = $("main .acc"); if (!acc) return; if (S.jobs.length) acc.outerHTML = `<div class="acc">${S.jobs.map((j) => `<details><summary>${esc(j.title)}${j.subtitle ? `<span class="meta">${esc(j.subtitle)}</span>` : ""}</summary><div class="body">${esc(j.body || "")}</div></details>`).join("")}</div>`; else acc.outerHTML = `<p class="muted">${esc(page?.body || "There are no open roles right now.")}</p>`; },
    "partners": () => { swap("main .tiles", `<div class="tiles">${S.ways.map((w) => `<article><h3>${esc(w.title)}</h3><p>${esc(w.body || "")}</p></article>`).join("")}</div>`); const sel = $("#pt-c"); if (sel) sel.innerHTML = S.ways.map((w) => `<option>${esc(w.title)}</option>`).join("") + "<option>Something else</option>"; },
    "private-dining": () => { swap("main .tiles", `<div class="tiles">${S.occasions.map((w) => `<article><h3>${esc(w.title)}</h3><p>${esc(w.body || "")}</p></article>`).join("")}</div>`); if (page?.body) after(section("sec sm", `<div class="read">${md(page.body)}</div>`)); },
    "visit": () => { if (page?.body) after(section("sec sm", `<div class="read">${md(page.body)}</div>`)); $$("main .stack-md").forEach((b) => { if (/getting here/i.test($(".label", b)?.textContent || "") && !b.closest(".read")) b.hidden = true; });
      const sec = $("#cl-events"); if (sec) {
        const tz = BRAND.tz || "Asia/Kolkata", day = (d) => new Date(d).toLocaleDateString(BRAND.locale, { weekday: "short", day: "numeric", month: "short", timeZone: tz }), tm = (d) => new Date(d).toLocaleTimeString(BRAND.locale, { hour: "numeric", minute: "2-digit", timeZone: tz }), key = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: tz });
        const when = (c) => key(c.from) === key(c.to) ? `${day(c.from)}, ${tm(c.from)} \u2013 ${tm(c.to)}` : `${day(c.from)}, ${tm(c.from)} \u2192 ${day(c.to)}, ${tm(c.to)}`;
        const row = (w, t, sub) => `<div><span>${esc(w)}</span><span class="muted"><b>${esc(t)}</b>${sub ? ` \u00b7 ${esc(sub)}` : ""}</span></div>`;
        const empty = (t) => `<div><span class="muted">${t}</span></div>`, where = (c) => (c.areas && c.areas.length ? c.areas.join(", ") + " closed" : "All areas closed");
        const today = new Date().toISOString().slice(0, 10), nm = Object.fromEntries(S.locations.map((l) => [l.id, l.name]));
        const dates = S.closures.filter((c) => c.on_date >= today).map((c) => ({ from: c.on_date + "T00:00:00", whenText: dateOf(c.on_date + "T12:00:00Z"), t: c.closed ? "Closed" : (c.open_time || "") + "\u2013" + (c.close_time || ""), sub: [c.reason, c.location_id && S.locations.length > 1 ? nm[c.location_id] : ""].filter(Boolean).join(" \u00b7 ") }));
        fetch("/api/public/area-closures").then((r) => (r.ok ? r.json() : { closures: [] })).catch(() => ({ closures: [] })).then((d) => {
          const all = d.closures || [], by = (k) => all.filter((c) => c.kind === k);
          $("#cl-events").innerHTML = by("event").length ? by("event").map((c) => row(when(c), c.title || "Event", where(c))).join("") : empty("No events planned that close part of the restaurant.");
          $("#cl-private").innerHTML = by("private_party").length ? by("private_party").map((c) => row(when(c), "Private party", where(c))).join("") : empty("No private parties planned.");
          const other = [...by("other").map((c) => ({ k: c.from, h: row(when(c), c.title || "Closed", where(c)) })), ...dates.map((c) => ({ k: c.from, h: row(c.whenText, c.t, c.sub) }))].sort((x, y) => x.k.localeCompare(y.k));
          $("#cl-other").innerHTML = other.length ? other.map((x) => x.h).join("") : empty("No other closures planned.");
        });
      } },
    "gift-cards": () => { if (page?.body) after(section("sec sm", `<div class="read">${md(page.body)}</div>`)); },
    "feedback": () => { if (page?.body) after(section("sec sm", `<div class="read">${md(page.body)}</div>`)); },
    "reviews": () => { const r = revData(), side = $("main aside"), list = $("main .split > div:last-child");
      if (side) side.innerHTML = r.count ? `<div class="big-num">${r.average.toFixed(1)}</div><span class="stars" role="img" aria-label="${r.average.toFixed(1)} out of 5 stars">${stars(r.average)}</span><p class="muted">Google rating from ${r.count} reviews.</p>${platBand()}` : `<p class="muted">No reviews have been published yet.</p>`;
      if (list) list.innerHTML = r.count ? `<div style="border-top:1px solid var(--line)">${r.items.map((q) => `<blockquote class="quote"><span class="stars" role="img" aria-label="${q.rating} out of 5 stars">${stars(q.rating)}</span><p>${esc(q.message)}</p><footer><b>${esc(q.name)}</b>${q.createdAt ? `<span>${esc(dateOf(q.createdAt))}</span>` : ""}</footer></blockquote>`).join("")}</div>` : ""; },
    "contact": () => { const c = S.business.contact || {}, so = S.business.social || {}, locs = S.locations, col = $("main .stack-lg"); if (!col) return;
      const DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];
      const today = (() => { try { return new Date().toLocaleDateString("en-GB", { weekday: "short", timeZone: BRAND.tz }).slice(0, 3).toLowerCase(); } catch { return ""; } })();
      const t12 = (t) => { const [h, m] = String(t).split(":").map(Number); return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`; };
      const addr = (l) => [l.address?.line1, l.address?.line2, [l.address?.city, l.address?.postcode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const hoursOf = (l) => { const h = l.hours || {}; if (!Object.keys(h).length) return ""; const rows = DAYS.map(([k, n]) => { const sl = h[k] || []; return `<div${k === today ? ' style="color:var(--gold)"' : ""}><span>${n}${k === today ? " (today)" : ""}</span><span>${sl.length ? sl.map((x) => `${t12(x.open)} – ${t12(x.close)}`).join(", ") : "Closed"}</span></div>`; }).join(""); return `<div class="lines" style="margin-top:12px">${rows}</div>`; };
      const place = (l) => `<section class="stack-md" aria-label="${esc(l.name)}"><div><h3 class="h3" style="font-size:1.35rem">${esc(l.name)}</h3><p class="muted">${esc(addr(l))}</p></div>
        <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;aspect-ratio:16/10;background:var(--bg-2)"><iframe title="Map of ${esc(l.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(addr(l) || l.name)}&output=embed" style="width:100%;height:100%;border:0;display:block" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
        <div class="acts" style="gap:10px;flex-wrap:wrap"><a class="btn solid" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr(l) || l.name)}" rel="noopener" target="_blank">Get directions</a><a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr(l) || l.name)}" rel="noopener" target="_blank">Open in Maps</a></div>
        ${hoursOf(l) ? `<div><span class="label">Opening hours</span>${hoursOf(l)}</div>` : ""}</section>`;
      const tel = (c.phone || "").replace(/[^\d+]/g, ""), wa = tel.replace(/^\+/, "");
      const rows = [c.phone && ["Phone", `<span class="copy-row"><a class="textlink" href="tel:${esc(tel)}">${esc(c.phone)}</a><button type="button" data-copy="${esc(c.phone)}">Copy</button></span>`], tel && ["WhatsApp", `<a class="textlink" href="https://wa.me/${esc(wa)}" rel="noopener" target="_blank">Message us</a>`], c.email && ["Email", `<span class="copy-row"><a class="textlink" href="mailto:${esc(c.email)}">${esc(c.email)}</a><button type="button" data-copy="${esc(c.email)}">Copy</button></span>`], Object.keys(so).length && ["Follow us", Object.entries(so).filter(([, v]) => safeUrl(v)).map(([k, v]) => `<a class="textlink" href="${esc(v)}" rel="noopener" target="_blank">${esc(k[0].toUpperCase() + k.slice(1))}</a>`).join(" · ")]].filter(Boolean);
      col.innerHTML = `${locs.map(place).join("")}<div><span class="label">Get in touch</span><div class="lines" style="margin-top:12px">${rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join("")}</div></div>
        <div class="box raise stack-sm"><span class="tag gold">Urgent booking?</span><p class="muted">For a table today, <a class="textlink" href="book.html">book online</a> or join the <a class="textlink" href="queue.html">walk-in queue</a>.</p></div>`; },
  };
  COLL[file]?.();
  if (file === "blog") { const box = $("#posts"); if (box) box.innerHTML = S.posts.length ? `<div class="grid-3">${S.posts.map((p) => `<a class="card" href="blog-post.html#${esc(p.slug)}" style="display:block;text-decoration:none;color:inherit"><span class="tag gold">${esc(dateOf(p.publishedAt))}</span><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ""}<span class="textlink">Read the story</span></a>`).join("")}</div>` : empty("No stories have been published yet."); }

  /* ---- about: the story is the About section from the admin; team, awards and photos appear only when the business has added them ---- */
  if (file === "blog-post") {
    const main = $("#main"), show = () => { const slug = decodeURIComponent(location.hash.slice(1)), p = S.posts.find((x) => x.slug === slug);
      if (!main) return;
      if (!p) { main.innerHTML = section("sec", `<nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span aria-hidden="true">/</span><a href="blog.html">Journal</a></nav>${empty("That story could not be found.")}<p><a class="textlink" href="blog.html">Back to the journal</a></p>`); return; }
      document.title = `${p.title} · ${BRAND.name || document.title}`;
      main.innerHTML = section("sec", `<nav class="crumbs" aria-label="Breadcrumb"><a href="./">Home</a><span aria-hidden="true">/</span><a href="blog.html">Journal</a><span aria-hidden="true">/</span><span>${esc(p.title)}</span></nav><span class="tag gold">${esc(dateOf(p.publishedAt))}</span><h1 style="margin:12px 0 18px">${esc(p.title)}</h1><div class="read">${p.body ? md(p.body) : (p.excerpt ? `<p class="muted">${esc(p.excerpt)}</p>` : "")}</div><p style="margin-top:34px"><a class="textlink" href="blog.html">&larr; Back to the journal</a></p>`); };
    show(); addEventListener("hashchange", show);
  }
  if (file === "about") {
    const ab = S.sections.find((x) => x.page === "about" && x.kind === "text"), main = $("main"), first = $(".ph-hero");
    if (main && first) {
      const mine = S.photos.filter((p) => !/\.webp/.test(p.url)), pc = (e) => `<article class="card">${img(e.imageUrl, e.title) || holder(e.title)}${e.subtitle ? `<span class="tag gold">${esc(e.subtitle)}</span>` : ""}<h3>${esc(e.title)}</h3>${e.body ? `<p>${esc(e.body)}</p>` : ""}</article>`;
      const h1 = $("h1", first); if (h1) h1.innerHTML = em(ab?.heading || "About us"); const sub = $(".sub", first); if (sub) { sub.textContent = ""; sub.hidden = true; }
      document.title = `${ab?.heading || "About us"} · ${BRAND.tabTitle || BRAND.name}`;
      const chips = [...S.sections.filter((x) => x.page === "home" && x.kind === "highlights")].flatMap((x) => x.items || []).map((i) => (typeof i === "string" ? i : i.title)).filter(Boolean);
      let html = "";
      if (ab?.body || S.business.description) html += section("sec", `<div class="split wide-r center">${mine[0] ? `<div class="photo r45"><img decoding="async" src="${esc(mine[0].url)}" alt="${esc(mine[0].alt || "")}" loading="lazy"></div>` : ""}<div class="stack-lg"><span class="label">Our story</span><div class="prose">${String(ab?.body || S.business.description).split(/\n\n+/).map((p, i) => `<p${i === 0 ? ' class="dropcap"' : ""}>${esc(p)}</p>`).join("")}</div>${chips.length ? `<div class="chips">${chips.map((t) => `<span class="chip">${esc(t)}</span>`).join("")}</div>` : ""}</div></div>`);
      if (S.team.length) html += section("sec alt", `<div class="head-row"><div><span class="label">Meet the team</span></div></div><div class="grid-3">${S.team.map(pc).join("")}</div>`);
      if (S.awards.length || S.press.length) html += section("sec", `<div class="head-row"><div><span class="label">Recognition</span></div></div><div class="lines">${[...S.awards, ...S.press].map((a) => `<div><span class="nm">${a.linkUrl && safeUrl(a.linkUrl) ? `<a class="textlink" href="${esc(a.linkUrl)}" rel="noopener">${esc(a.title)}</a>` : esc(a.title)}</span><span class="muted">${esc([a.subtitle, a.body].filter(Boolean).join(", "))}</span></div>`).join("")}</div>`);
      if (mine.length > 1) html += section("sec alt", `<div class="head-row"><div><span class="label">Our space</span></div><a class="link" href="gallery.html">Gallery</a></div><div class="grid-4" data-lightbox>${mine.slice(0, 4).map((p) => `<button type="button" class="photo r45" data-cap="${esc(p.alt || "")}" style="border:0;padding:0;cursor:zoom-in"><img decoding="async" src="${esc(p.url)}" alt="${esc(p.alt || "")}" loading="lazy"></button>`).join("")}</div><div class="acts" style="margin-top:44px"><a class="btn solid" href="book.html">Reserve a table</a><a class="btn quiet" href="visit.html">Visit us</a></div>`);
      [...main.children].filter((n) => n !== first).forEach((n) => n.remove()); first.insertAdjacentHTML("afterend", html);
    }
  }

  /* ---- home page ---- */
  if (file === "index") {
    const sec = (page, kind) => S.sections.filter((x) => x.page === page && x.kind === kind), set = (sel, v) => { const el = $(sel); if (el && v) el.textContent = v; };
    const h = sec("home", "hero")[0]; if (h) { if (h.heading) { const t = $("#hero-title"); if (t) { const w = h.heading.trim().split(/\s+/), k = Math.max(1, Math.ceil(w.length / 2)); t.innerHTML = `<span><b>${esc(w.slice(0, w.length - k).join(" ") || h.heading)}</b></span><span><em>${esc(w.slice(-k).join(" "))}</em></span>`; } } set(".hero .lede > p", h.subheading || h.sub); }
    const loc = S.locations[0], city = loc?.address?.city; const lab = [S.business.kind, city].filter(Boolean).join(" · "); set(".hero .label", lab.charAt(0).toUpperCase() + lab.slice(1));
    const about = sec("about", "text")[0], aboutP = $("#about .copy > p"), aboutLab = $("#about .copy .label");
    if (aboutLab) aboutLab.textContent = `Welcome to ${BRAND.name}`;
    const aboutH = $("#about-title"); if (aboutH && S.business.tagline) aboutH.innerHTML = em(S.business.tagline);
    if (aboutP) { const d = S.business.description || about?.body; if (d) aboutP.textContent = d; else aboutP.remove(); }
    const chips = $("#about .chips"); if (chips) { const items = [...sec("home", "highlights"), ...sec("about", "highlights")].flatMap((x) => x.items || []).map((i) => (typeof i === "string" ? i : i.title)).filter(Boolean); chips.innerHTML = items.slice(0, 6).map((t) => `<span class="chip">${esc(t)}</span>`).join(""); }
    $$("#about .est").forEach((e) => e.remove());
    const offers = $(".offers"); if (offers) { if (S.offers.length) offers.innerHTML = S.offers.slice(0, 3).map((e) => `<article class="offer">${e.subtitle ? `<span class="when">${esc(e.subtitle)}</span>` : ""}<h3>${esc(e.title)}</h3>${e.body ? `<p>${esc(e.body)}</p>` : ""}${e.validTo ? `<p class="terms">Until ${esc(dateOf(e.validTo))}</p>` : ""}<a class="link" href="book.html">Book now</a></article>`).join(""); else $("#offers")?.remove(); }
    const occ = $(".occasions"); if (occ) occ.innerHTML = S.occasions.map((o) => `<li>${esc(o.title)}</li>`).join("");
    const pv = $("#private .box > p"); if (pv && S.pages["private-dining"]?.sub) pv.textContent = S.pages["private-dining"].sub;
    $$("#private .facts").forEach((f) => f.remove());
    const gal = $("#gallery-grid"); if (gal) { if (S.photos.length) gal.innerHTML = S.photos.slice(0, 6).map((p, i) => `<button class="g${i + 1}" type="button" data-cap="${esc(p.alt || "")}"><img decoding="async" src="${esc(p.url)}" alt="${esc(p.alt || "")}" loading="lazy"></button>`).join(""); else $("#gallery")?.remove(); }
    const gh = $("#gallery-title"); if (gh) gh.innerHTML = `Inside <em>${esc(BRAND.name)}.</em>`;
    const rv = $("#reviews"); if (rv) { { const R = revData(); const sc = $(".score", rv); if (sc) { $("b", sc).textContent = R.average.toFixed(1); $(".stars", sc).innerHTML = stars(R.average); $("p", sc).textContent = `Google rating from ${R.count} reviews.`; if (!$(".plat", sc)) $("p", sc).insertAdjacentHTML("afterend", platBand()); } $(".quotes", rv).innerHTML = R.items.slice(0, 3).map((q) => `<blockquote class="quote"><span class="stars" role="img" aria-label="${q.rating} out of 5 stars">${stars(q.rating)}</span><p>${esc(q.message)}</p><footer><b>${esc(q.name)}</b>${q.createdAt ? `<span>${esc(dateOf(q.createdAt))}</span>` : ""}</footer></blockquote>`).join(""); } }
    const posts = $("#stories .posts"); if (posts) { if (S.posts.length) posts.innerHTML = S.posts.slice(0, 3).map((p) => `<a class="post" href="blog-post.html#${esc(p.slug)}"><time datetime="${esc(p.publishedAt)}">${esc(dateOf(p.publishedAt))}</time><h3>${esc(p.title)}</h3>${p.excerpt ? `<p>${esc(p.excerpt)}</p>` : ""}</a>`).join(""); else $("#stories")?.remove(); }
    /* photos: the restaurant's own media library replaces the template's stock images where it has any */
    const ph = S.photos.map((p) => p.url); $$(".slides figure img").forEach((im, i) => { if (ph[i]) { im.src = i === 0 ? S.photos[0].hero : ph[i]; im.alt = ""; if (i === 0) { im.loading = "eager"; im.setAttribute("fetchpriority", "high"); } } });
    $$("#about .pics img").forEach((im, i) => { if (ph[i + 3]) { im.src = ph[i + 3]; im.alt = S.photos[i + 3].alt || ""; } });
    /* menu band: the dishes and drinks the restaurant ticked as "signature"; with none ticked, the menu's own categories */
    { const all = H.DISHES || [], card = (d) => { const im = d.pic || H.catImg(d.cat); return `<a class="dish lux" href="dish.html#${encodeURIComponent(d.slug)}"><div class="ph ${im ? "" : "ph-fill"}">${im ? `<img decoding="async" src="${im}" alt="" loading="lazy">` : `<span>${esc(d.name.charAt(0))}</span>`}<span class="view">View</span></div><div class="row"><h3>${esc(d.name)}</h3><span class="pr">${d.price ? H.gbp(d.price) : ""}</span></div>${d.desc ? `<p>${esc(d.desc)}</p>` : ""}</a>`; };
      const food = all.filter((d) => d.signature && !d.drink), bev = all.filter((d) => d.signature && d.drink), reel = $("#reel"), grid = $("#menu .bar-grid"); if (grid) grid.remove();
      const bevSec = $("#bev");
      if (food.length || bev.length) {
        if (food.length) reel.innerHTML = food.slice(0, 6).map(card).join(""); else $("#menu")?.remove();
        if (bev.length && bevSec) { $("#reel-bev").innerHTML = bev.slice(0, 6).map(card).join(""); bevSec.hidden = false; } else bevSec?.remove();
      } else {
        bevSec?.remove();
        const cats = new Map(); all.forEach((d) => { if (!cats.has(d.cat)) cats.set(d.cat, []); cats.get(d.cat).push(d); });
        const lab = $("#menu .head-row .label"), mt = $("#menu-title");
        if (reel) { if (cats.size) reel.innerHTML = [...cats].slice(0, 12).map(([name, list]) => `<a class="dish lux" href="menu.html"><div class="ph ${H.catImg(name) ? "" : "ph-fill"}">${H.catImg(name) ? `<img decoding="async" src="${H.catImg(name)}" alt="" loading="lazy">` : `<span>${esc(name.charAt(0))}</span>`}<span class="tag">${list.length} dish${list.length === 1 ? "" : "es"}</span><span class="view">View</span></div><div class="row"><h3>${esc(name)}</h3></div><p>${esc(list.slice(0, 3).map((d) => d.name).join(", "))}</p></a>`).join(""); else $("#menu")?.remove(); }
        if (lab) lab.textContent = "Our menu"; if (mt) mt.innerHTML = `${cats.size} sections, <em>${all.length} dishes.</em>`;
      } }
    $$("#r-room").forEach((s) => { s.innerHTML = S.locations.map((l) => `<option>${esc(l.name)}</option>`).join(""); if (S.locations.length < 2) s.closest("label")?.setAttribute("hidden", ""); });
    { const l0 = S.locations[0], q = l0 ? [BRAND.name, l0.address?.line1, l0.address?.line2, l0.address?.city, l0.address?.postcode].filter(Boolean).join(", ") : ""; $$("#locs, #locs-full").forEach((fl) => { if (S.locations.length === 1 && q && !$(".find-ph", fl)) fl.insertAdjacentHTML("beforeend", `<div class="find-ph"><iframe title="Map to ${esc(BRAND.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`); }); }
    $$(".slide-meta").forEach((m) => m.remove());
    const vh = $("#visit-title"); if (vh) vh.innerHTML = `Find <em>${esc(S.locations.length > 1 ? "our rooms." : "us.")}</em>`;
  }

  /* ---- stock photography: the template ships pictures of someone else's restaurant; every one is swapped for the restaurant's own photos (food pictures for food, rooms for everything else) ---- */
  {
    const FOOD = /\/(pasta\d*|pizza|salad|steak|plating|spread|cocktails)\.webp/, mine = S.photos.filter((p) => !/\.webp/.test(p.url));
    const food = mine.filter((p) => /pizza|curry|food|dish|plate/i.test(p.alt || "")), rooms = mine.filter((p) => !food.includes(p));
    let r = 0, f = 0;
    const pick = (isFood) => { const list = isFood && food.length ? food : rooms.length ? rooms : mine; if (!list.length) return null; return list[(isFood && food.length ? f++ : r++) % list.length]; };
    $$("img[data-stock]").forEach((im) => { const p = pick(FOOD.test(`/${im.dataset.stock}.webp`)); if (p) { im.src = p.url; im.alt = p.alt || ""; } });
    $$("meta[property='og:image'],meta[name='twitter:image']").forEach((m) => { if (/example/.test(m.content)) m.remove(); });
  }

  /* ---- footer details (address, phone, email, social) ---- */
  const c = S.business.contact || {}, so = S.business.social || {};
  $$("footer [data-brand=phone]").forEach((a) => { if (c.phone) { a.textContent = c.phone; a.href = "tel:" + c.phone.replace(/\s/g, ""); } });
  $$("footer [data-brand=email]").forEach((a) => { if (c.email) { a.textContent = c.email; a.href = "mailto:" + c.email; } });
  $$("footer a[href*='instagram'],footer a[href*='facebook']").forEach((a) => { const k = /instagram/.test(a.href) ? "instagram" : "facebook"; if (safeUrl(so[k])) a.href = so[k]; else a.remove(); });
  { const u = H.BRAND.logoUrl, l = $("link[rel=icon]"); if (u && l) { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#FFF8F0"; x.beginPath(); x.roundRect(0, 0, 64, 64, 14); x.fill(); const k = Math.min(48 / im.width, 48 / im.height); x.drawImage(im, (64 - im.width * k) / 2, (64 - im.height * k) / 2, im.width * k, im.height * k); l.href = c.toDataURL("image/png"); l.type = "image/png"; } catch { l.href = u; l.type = "image/png"; } }; im.onerror = () => { l.href = u; l.type = "image/png"; }; im.src = u; } }
  document.documentElement.classList.add("hv-live");
  /* responsive images: every optimiser URL also offers smaller widths, so phones download the 640 px version */
  { const W = [640, 1080, 1920], RX = /^(\/_next\/image\?url=[^&]+)&w=(\d+)&q=75$/;
    const rs = (im) => { if (im.hasAttribute("srcset")) return; const m = RX.exec(im.getAttribute("src") || ""); if (!m) return; const max = +m[2], list = W.filter((w) => w <= max); if (list.length < 2) return; im.srcset = list.map((w) => `${m[1]}&w=${w}&q=75 ${w}w`).join(", "); im.sizes = im.closest(".hero, .ph-hero, .slides, .fullstate") ? "100vw" : "(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 600px"; };
    $$("img").forEach(rs); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) { if (n.tagName === "IMG") rs(n); else n.querySelectorAll?.("img").forEach(rs); } }))).observe(document.body, { childList: true, subtree: true }); }
  document.dispatchEvent(new CustomEvent("hv:cms"));
})();
