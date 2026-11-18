/* Styled dropdown and date/time pickers.
   Every <select> and every date, time or datetime-local input is replaced by a button that opens a themed popover
   (a bottom sheet on phones). The original control stays in the page, hidden, and is kept in sync, so forms,
   validation and drafts keep working unchanged. Opt out with data-native on the control. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lbl = (el) => { const l = (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) || el.closest("label"); if (!l) return ""; const c = l.cloneNode(true); c.querySelectorAll("select,input,textarea,button,.pk-btn,.pk-layer,option").forEach((x) => x.remove()); return c.textContent.trim(); };
  const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const CHEV = '<svg class="pk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CAL = '<svg class="pk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
  const CLOCK = '<svg class="pk-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
  const pad = (n) => String(n).padStart(2, "0");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  let current = null;

  /* ---------- popover shell ---------- */
  function openLayer(anchor, label, build) {
    if (current) current.close();
    const sheet = matchMedia("(max-width: 700px)").matches;
    const layer = document.createElement("div");
    layer.className = "pk-layer" + (sheet ? " sheet" : "");
    layer.innerHTML = `<div class="pk-scrim"></div><div class="pk-pop" role="dialog" aria-label="${esc(label)}" tabindex="-1"></div>`;
    document.body.appendChild(layer);
    const box = $(".pk-pop", layer);
    const place = () => {
      if (sheet) return;
      const a = anchor.getBoundingClientRect(), h = box.offsetHeight, w = box.offsetWidth, vh = innerHeight, vw = innerWidth;
      let top = a.bottom + 8; if (top + h > vh - 10 && a.top - h - 8 > 10) top = a.top - h - 8;
      top = Math.max(10, Math.min(top, vh - h - 10));
      let left = Math.max(10, Math.min(a.left, vw - w - 10));
      box.style.top = top + "px"; box.style.left = left + "px"; box.style.minWidth = Math.min(a.width, 360) + "px";
    };
    const close = () => { layer.remove(); removeEventListener("resize", place); removeEventListener("scroll", place, true); document.removeEventListener("keydown", key, true); document.body.classList.remove("pk-lock"); if (current && current.layer === layer) current = null; try { anchor.focus({ preventScroll: true }); } catch { /* gone */ } };
    const key = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    $(".pk-scrim", layer).addEventListener("click", close);
    document.addEventListener("keydown", key, true); addEventListener("resize", place); addEventListener("scroll", place, true);
    if (sheet) document.body.classList.add("pk-lock");
    build(box, close, place);
    current = { layer, close };
    requestAnimationFrame(() => { place(); layer.classList.add("on"); });
    return { box, close, place };
  }
  const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const hook = (el, proto, sync) => { const d = Object.getOwnPropertyDescriptor(proto, "value"); Object.defineProperty(el, "value", { get() { return d.get.call(this); }, set(v) { d.set.call(this, v); sync(); }, configurable: true }); };

  /* ---------- dropdown ---------- */
  function enhanceSelect(sel) {
    if (sel.dataset.pk || sel.multiple || sel.size > 1 || sel.hasAttribute("data-native") || sel.closest(".pk-pop")) return;
    sel.dataset.pk = "1";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = (sel.className + " pk-btn").trim(); btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (sel.id) btn.id = sel.id + "-pk"; if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    sel.classList.add("pk-native"); sel.tabIndex = -1; sel.after(btn);
    const sync = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `<span class="pk-val">${esc(o ? o.text : "")}</span>${CHEV}`; btn.disabled = sel.disabled; };
    sync(); hook(sel, HTMLSelectElement.prototype, sync);
    sel.addEventListener("change", sync); sel.addEventListener("focus", () => btn.focus());
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled"] });
    sel.form?.addEventListener("reset", () => setTimeout(sync));
    const choose = (i, close) => { sel.selectedIndex = i; sync(); fire(sel); close(); };
    const open = () => {
      const label = lbl(sel) || sel.getAttribute("aria-label") || "Choose";
      btn.setAttribute("aria-expanded", "true");
      openLayer(btn, label, (box, close) => {
        const opts = [...sel.options];
        box.classList.add("pk-list");
        box.innerHTML = `<div class="pk-head"><b>${esc(label)}</b><button type="button" class="pk-x" aria-label="Close">&times;</button></div><div role="listbox" class="pk-opts" aria-label="${esc(label)}">${opts.map((o, i) => `<button type="button" role="option" class="pk-opt" data-i="${i}" aria-selected="${i === sel.selectedIndex}"${o.disabled ? " disabled" : ""}><span>${esc(o.text)}</span>${i === sel.selectedIndex ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>' : ""}</button>`).join("")}</div>`;
        $(".pk-x", box).onclick = close;
        const items = $$(".pk-opt", box); items.forEach((b) => (b.onclick = () => choose(+b.dataset.i, close)));
        box.addEventListener("keydown", (e) => { const k = items.indexOf(document.activeElement); if (e.key === "ArrowDown") { e.preventDefault(); items[Math.min(items.length - 1, k + 1)].focus(); } else if (e.key === "ArrowUp") { e.preventDefault(); items[Math.max(0, k - 1)].focus(); } else if (e.key === "Home") { e.preventDefault(); items[0].focus(); } else if (e.key === "End") { e.preventDefault(); items[items.length - 1].focus(); } });
        const cur = items[sel.selectedIndex] || items[0]; setTimeout(() => { cur?.focus({ preventScroll: true }); cur?.scrollIntoView({ block: "center" }); }, 30);
      });
      const mo = new MutationObserver(() => { if (!document.body.contains($(".pk-layer"))) { btn.setAttribute("aria-expanded", "false"); mo.disconnect(); } }); mo.observe(document.body, { childList: true });
    };
    btn.addEventListener("click", open);
    btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
  }

  /* ---------- date and time ---------- */
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (v, kind) => { if (!v) return null; const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(kind === "time" ? "" : v), t = kind === "time" ? /^(\d{2}):(\d{2})/.exec(v) : null; if (kind === "time") return t ? { h: +t[1], mi: +t[2] } : null; return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3], h: m[4] != null ? +m[4] : null, mi: m[5] != null ? +m[5] : null } : null; };
  const fmtTime = (h, mi) => `${((h + 11) % 12) + 1}:${pad(mi)} ${h < 12 ? "AM" : "PM"}`;
  function enhanceDate(inp) {
    if (inp.dataset.pk || inp.hasAttribute("data-native") || inp.closest(".pk-pop")) return;
    const kind = inp.type; if (!["date", "datetime-local", "time"].includes(kind)) return;
    inp.dataset.pk = "1";
    const btn = document.createElement("button"); btn.type = "button"; btn.className = (inp.className + " pk-btn pk-date").trim(); btn.setAttribute("aria-haspopup", "dialog");
    if (inp.id) btn.id = inp.id + "-pk"; if (inp.getAttribute("aria-label")) btn.setAttribute("aria-label", inp.getAttribute("aria-label"));
    inp.classList.add("pk-native"); inp.tabIndex = -1; inp.after(btn);
    const ph = inp.getAttribute("placeholder") || (kind === "time" ? "Select a time" : kind === "date" ? "Select a date" : "Select date and time");
    const show = () => { const p = parse(inp.value, kind); if (!p) return `<span class="pk-val pk-ph">${esc(ph)}</span>${kind === "time" ? CLOCK : CAL}`; const parts = []; if (kind !== "time") parts.push(new Date(p.y, p.mo, p.d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })); if (p.h != null) parts.push(fmtTime(p.h, p.mi)); return `<span class="pk-val">${esc(parts.join(" · "))}</span>${kind === "time" ? CLOCK : CAL}`; };
    const sync = () => { btn.innerHTML = show(); btn.disabled = inp.disabled; };
    sync(); hook(inp, HTMLInputElement.prototype, sync);
    inp.addEventListener("change", sync); inp.addEventListener("focus", () => btn.focus());
    new MutationObserver(sync).observe(inp, { attributes: true, attributeFilter: ["disabled", "min", "max"] });
    inp.form?.addEventListener("reset", () => setTimeout(sync));
    const label = lbl(inp) || (kind === "time" ? "Choose a time" : "Choose a date");

    btn.addEventListener("click", () => openLayer(btn, label, (box, close, place) => {
      box.classList.add("pk-cal");
      const min = (inp.min || "").slice(0, 10), max = (inp.max || "").slice(0, 10);
      const cur = parse(inp.value, kind); const now = new Date();
      let vy = cur ? cur.y : now.getFullYear(), vm = cur ? cur.mo : now.getMonth();
      if (!cur && min && /^\d{4}-\d{2}-\d{2}$/.test(min) && isoDate(now) < min) { vy = +min.slice(0, 4); vm = +min.slice(5, 7) - 1; }
      let sd = cur && kind !== "time" ? { y: cur.y, mo: cur.mo, d: cur.d } : null;
      let step = cur ? "time" : "date"; let th = cur && cur.h != null ? cur.h : 19, tm = cur && cur.mi != null ? cur.mi : 0, hadTime = !!(cur && cur.h != null);
      const commit = () => { let v = ""; if (kind === "time") v = `${pad(th)}:${pad(tm)}`; else if (sd) { v = `${sd.y}-${pad(sd.mo + 1)}-${pad(sd.d)}`; if (kind === "datetime-local") v += `T${pad(th)}:${pad(tm)}`; } inp.value = v; fire(inp); };
      const setStep = (n) => { step = n; $$(".pk-sec", box).forEach((x) => { const o = x.dataset.sec === n; x.dataset.open = o; $(".pk-sechead", x).setAttribute("aria-expanded", o); }); const sel = $(".pk-col .sel", box); $$(".pk-col", box).forEach((c) => { const q = $(".sel", c); if (q && n === "time") c.scrollTop = q.offsetTop - c.clientHeight / 2 + q.clientHeight / 2; }); setTimeout(place, 320); };
      const render = () => {
        let html = `<div class="pk-head"><b>${esc(label)}</b><button type="button" class="pk-x" aria-label="Close">&times;</button></div>`;
        const both = kind === "datetime-local";
        if (kind !== "time") {
          if (both) html += `<section class="pk-sec" data-sec="date" data-open="${step === "date"}"><button type="button" class="pk-sechead" data-go="date" aria-expanded="${step === "date"}"><span>Date</span><em>${sd ? esc(new Date(sd.y, sd.mo, sd.d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })) : "Choose a date"}</em></button><div class="pk-secbody"><div class="pk-secin">`;
          const first = new Date(vy, vm, 1), lead = (first.getDay() + 6) % 7, days = new Date(vy, vm + 1, 0).getDate(), todayIso = isoDate(now), selIso = sd ? `${sd.y}-${pad(sd.mo + 1)}-${pad(sd.d)}` : "";
          const prevOk = !min || isoDate(new Date(vy, vm, 0)) >= min, nextOk = !max || isoDate(new Date(vy, vm + 1, 1)) <= max;
          html += `<div class="pk-nav"><button type="button" class="pk-step" data-m="-1" aria-label="Previous month"${prevOk ? "" : " disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 5-7 7 7 7"/></svg></button><strong aria-live="polite">${MONTHS[vm]} ${vy}</strong><button type="button" class="pk-step" data-m="1" aria-label="Next month"${nextOk ? "" : " disabled"}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 5 7 7-7 7"/></svg></button></div><div class="pk-grid" role="grid">${DOW.map((d) => `<span class="pk-dow">${d}</span>`).join("")}${"<span></span>".repeat(lead)}`;
          for (let d = 1; d <= days; d++) { const iso = `${vy}-${pad(vm + 1)}-${pad(d)}`, off = (min && iso < min) || (max && iso > max); html += `<button type="button" class="pk-day${iso === todayIso ? " today" : ""}${iso === selIso ? " sel" : ""}" data-d="${d}"${off ? " disabled" : ""} aria-pressed="${iso === selIso}" aria-label="${d} ${MONTHS[vm]} ${vy}">${d}</button>`; }
          html += "</div>";
          if (both) html += "</div></div></section>";
        }
        if (kind !== "date") {
          const h12 = ((th + 11) % 12) + 1, pm = th >= 12;
          html += `${both ? `<section class="pk-sec" data-sec="time" data-open="${step === "time"}"><button type="button" class="pk-sechead" data-go="time" aria-expanded="${step === "time"}"><span>Time</span><em>${hadTime ? fmtTime(th, tm) : "Choose a time"}</em></button><div class="pk-secbody"><div class="pk-secin">` : ""}<div class="pk-time">${both ? "" : `<span class="pk-tl">Time</span>`}<div class="pk-cols"><div class="pk-col" data-c="h" aria-label="Hour">${Array.from({ length: 12 }, (_, i) => i + 1).map((h) => `<button type="button" class="${h === h12 ? "sel" : ""}" data-h="${h}">${h}</button>`).join("")}</div><div class="pk-col" data-c="m" aria-label="Minutes">${Array.from({ length: 12 }, (_, i) => i * 5).map((m) => `<button type="button" class="${m === tm ? "sel" : ""}" data-mi="${m}">${pad(m)}</button>`).join("")}</div><div class="pk-col pk-ap" aria-label="AM or PM"><button type="button" class="${!pm ? "sel" : ""}" data-ap="AM">AM</button><button type="button" class="${pm ? "sel" : ""}" data-ap="PM">PM</button></div></div></div>${both ? "</div></div></section>" : ""}`;
        }
        html += `<div class="pk-foot">${inp.required ? "<span></span>" : '<button type="button" class="pk-link" data-clear>Clear</button>'}${kind === "time" ? "" : '<button type="button" class="pk-link" data-today>Today</button>'}${kind === "date" ? "" : '<button type="button" class="pk-done" data-done>Done</button>'}</div>`;
        box.innerHTML = html;
        $(".pk-x", box).onclick = close;
        $$(".pk-sechead", box).forEach((b) => (b.onclick = () => setStep(b.dataset.go)));
        $$(".pk-step", box).forEach((b) => (b.onclick = () => { vm += +b.dataset.m; if (vm < 0) { vm = 11; vy--; } if (vm > 11) { vm = 0; vy++; } render(); }));
        $$(".pk-day", box).forEach((b) => (b.onclick = () => { sd = { y: vy, mo: vm, d: +b.dataset.d }; if (kind === "date") { commit(); close(); } else { commit(); if (kind === "datetime-local") { step = "date"; render(); requestAnimationFrame(() => requestAnimationFrame(() => setStep("time"))); } else render(); } }));
        $$(".pk-col [data-h]", box).forEach((b) => (b.onclick = () => { th = (+b.dataset.h % 12) + (th >= 12 ? 12 : 0); hadTime = true; if (kind === "datetime-local" && !sd) sd = { y: now.getFullYear(), mo: now.getMonth(), d: now.getDate() }; commit(); render(); }));
        $$(".pk-col [data-mi]", box).forEach((b) => (b.onclick = () => { tm = +b.dataset.mi; hadTime = true; if (kind === "datetime-local" && !sd) sd = { y: now.getFullYear(), mo: now.getMonth(), d: now.getDate() }; commit(); render(); }));
        $$(".pk-col [data-ap]", box).forEach((b) => (b.onclick = () => { const pm = b.dataset.ap === "PM"; th = (th % 12) + (pm ? 12 : 0); hadTime = true; if (kind === "datetime-local" && !sd) sd = { y: now.getFullYear(), mo: now.getMonth(), d: now.getDate() }; commit(); render(); }));
        $("[data-clear]", box) && ($("[data-clear]", box).onclick = () => { sd = null; inp.value = ""; fire(inp); close(); });
        $("[data-today]", box) && ($("[data-today]", box).onclick = () => { const t = new Date(); if (min && isoDate(t) < min) return; sd = { y: t.getFullYear(), mo: t.getMonth(), d: t.getDate() }; vy = sd.y; vm = sd.mo; commit(); if (kind === "date") close(); else render(); });
        $("[data-done]", box) && ($("[data-done]", box).onclick = () => { if (kind === "datetime-local" && sd && !hadTime) { commit(); } close(); });
        $$(".pk-col", box).forEach((c) => { const s = $(".sel", c); if (s) c.scrollTop = s.offsetTop - c.clientHeight / 2 + s.clientHeight / 2; });
        const grid = $(".pk-grid", box); if (grid) grid.onkeydown = (e) => { const ds = $$(".pk-day:not([disabled])", grid), k = ds.indexOf(document.activeElement); if (k < 0) return; const mv = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key]; if (mv) { e.preventDefault(); (ds[k + mv] || ds[k]).focus(); } };
        place();
        const f = $(".pk-day.sel", box) || $(".pk-day.today:not([disabled])", box) || $(".pk-day:not([disabled])", box); if (!box.dataset.focused && f) { f.focus({ preventScroll: true }); box.dataset.focused = "1"; }
      };
      render();
    }));
  }

  const scan = (root) => { (root.matches?.("select") ? [root] : []).concat($$("select", root)).forEach(enhanceSelect); (root.matches?.("input") ? [root] : []).concat($$("input[type=date], input[type=datetime-local], input[type=time]", root)).forEach(enhanceDate); };
  const run = () => { scan(document); new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !n.closest?.(".pk-layer")) scan(n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
