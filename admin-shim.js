/* Read-only admin preview: a service worker answers the pages' /api calls from saved answers. */
(() => {
  const BASE = "/restaurant-demo-preview";
  if (!("serviceWorker" in navigator)) { document.write("<p style='font:16px system-ui;padding:24px'>This preview needs a browser with service worker support.</p>"); return; }
  if (!navigator.serviceWorker.controller) {
    const n = Number(sessionStorage.getItem("preview-sw") || 0); if (n > 2) return; sessionStorage.setItem("preview-sw", String(n + 1)); window.stop();
    navigator.serviceWorker.register(BASE + "/sw.js", { scope: BASE + "/" }).then(() => navigator.serviceWorker.ready).then(() => { if (navigator.serviceWorker.controller) location.reload(); else navigator.serviceWorker.addEventListener("controllerchange", () => location.reload()); });
    return;
  }
  sessionStorage.removeItem("preview-sw");
  document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("a[href]"); if (!a) return; const h = a.getAttribute("href"); if (h && h.charAt(0) === "/" && h.charAt(1) !== "/" && h.indexOf(BASE + "/") !== 0) { e.preventDefault(); e.stopImmediatePropagation(); location.assign(BASE + h); } }, true);
  addEventListener("DOMContentLoaded", () => { const b = document.createElement("div"); b.textContent = "Read-only preview. Changes are not saved."; b.style.cssText = "position:fixed;z-index:99999;left:50%;bottom:12px;transform:translateX(-50%);background:#1c1a17;color:#f2ebe0;font:12px/1 system-ui,sans-serif;padding:8px 14px;border-radius:999px;opacity:.9;pointer-events:none"; document.body.appendChild(b); });
})();
