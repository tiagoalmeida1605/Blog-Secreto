/* Small inline SVG icon set for BS-Rework. No icon CDN and no emoji glyphs. */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const icons = {
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20"/><path d="M8 7h8"/>',
    study: '<path d="m2.5 9 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 11.3v5.1c3.1 2.2 7.9 2.2 11 0v-5.1"/><path d="M21.5 9v6"/>',
    folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h5l2 2H19.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/><path d="M3 9h18"/>',
    bulb: '<path d="M9 18h6M10 22h4"/><path d="M8.2 14.7A6 6 0 1 1 15.8 14.7c-.9.7-1.3 1.5-1.5 2.3h-4.6c-.2-.8-.6-1.6-1.5-2.3z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    archive: '<path d="M4 4h16v4H4z"/><path d="M5 8v12h14V8M9 12h6"/>',
    network: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="m10.9 6.8-4.8 9M13.1 6.8l4.8 9M7.2 18h9.6"/>',
    radio: '<path d="M4 8h16v12H4z"/><path d="m4 8 15-5"/><circle cx="9" cy="14" r="2.2"/><path d="M14 12h3M14 16h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    brain: '<path d="M9 5.2A3.2 3.2 0 0 0 4.5 8a3.4 3.4 0 0 0 .2 5.6A3.6 3.6 0 0 0 9 19.8z"/><path d="M15 5.2A3.2 3.2 0 0 1 19.5 8a3.4 3.4 0 0 1-.2 5.6 3.6 3.6 0 0 1-4.3 6.2z"/><path d="M9 5v14M15 5v14M9 9H7M15 9h2M9 14H7M15 14h2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
    shield: '<path d="M12 3 19 6v5c0 4.6-2.7 7.8-7 10-4.3-2.2-7-5.4-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 17 6l3 6M4 12l3 6a7 7 0 0 0 11.5-3"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
    send: '<path d="m21 3-7.5 18-3.3-7.2L3 10.5z"/><path d="M10.2 13.8 21 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 4l-4 16"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    camera: '<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  };
  function icon(name, className = "bs-ui-icon") {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", className);
    const template = document.createElementNS(NS, "g");
    // The fragments above are static, developer-authored SVG path markup only.
    const parsed = new DOMParser().parseFromString(`<svg xmlns="${NS}">${icons[name] || icons.info}</svg>`, "image/svg+xml");
    for (const child of Array.from(parsed.documentElement.children)) template.append(document.importNode(child, true));
    svg.append(template);
    return svg;
  }
  function replaceContent(element, name, className) {
    if (!element || element.dataset.bsUiIconApplied === name) return;
    element.replaceChildren(icon(name, className));
    element.dataset.bsUiIconApplied = name;
  }
  function setIcon(element, name, className) { if (element) replaceContent(element, name, className); }
  function applyStaticIcons() {
    const filters = { all: "grid", diary: "book", study: "study", project: "folder", idea: "bulb", other: "more", favorites: "star", archived: "archive" };
    document.querySelectorAll(".sidebar .nav-item").forEach((button) => {
      const span = button.querySelector(":scope > .nav-symbol");
      if (!span) return;
      const filter = button.dataset.filter;
      const name = filters[filter] || (button.id === "nexus-nav" ? "network" : button.id === "radio-nav" ? "radio" : null);
      if (name) setIcon(span, name, "bs-ui-icon bs-ui-nav-icon");
    });
    ["#new-entry-sidebar > span[aria-hidden='true']", "#new-entry-top > span[aria-hidden='true']"].forEach((selector) => document.querySelectorAll(selector).forEach((el) => setIcon(el, "plus", "bs-ui-icon")));
    setIcon(document.querySelector(".nxai-tab-mark"), "brain", "bs-ui-icon");
    setIcon(document.querySelector("#nxai-clear"), "trash", "bs-ui-icon");
    setIcon(document.querySelector(".nxai-notice-icon"), "info", "bs-ui-icon");
    setIcon(document.querySelector(".nxai-orb span"), "brain", "bs-ui-icon");
    setIcon(document.querySelector(".nxai-refresh-context > span"), "refresh", "bs-ui-icon");
    setIcon(document.querySelector(".nxai-lock-symbol"), "lock", "bs-ui-icon");
    setIcon(document.querySelector(".nxai-send-button > b"), "send", "bs-ui-icon");
    document.querySelectorAll(".nxai-prompt > b[aria-hidden='true']").forEach((el) => setIcon(el, "external", "bs-ui-icon"));
    document.querySelectorAll(".nxai-source-icon").forEach((el) => setIcon(el, el.classList.contains("nxai-source-icon-teal") ? "radio" : el.classList.contains("nxai-source-icon-blue") ? "network" : "book", "bs-ui-icon"));
    document.querySelectorAll(".empty-symbol").forEach((el) => setIcon(el, "book", "bs-ui-icon"));
    document.querySelectorAll(".entry-card .icon-button").forEach((el) => {
      const label = `${el.getAttribute("aria-label") || ""} ${el.title || ""} ${el.textContent || ""}`.toLowerCase();
      const name = /arquiv|archive/.test(label) ? "archive" : /editar|edit/.test(label) ? "edit" : /excluir|delete|remover|apagar/.test(label) ? "trash" : /favor|favorite|☆|★/.test(label) ? "star" : null;
      if (name) setIcon(el, name, "bs-ui-icon");
    });
    document.querySelectorAll(".nexus-disclaimer-mark").forEach((el) => setIcon(el, "info", "bs-ui-icon"));
    document.querySelectorAll(".nexus-idea-symbol").forEach((el) => setIcon(el, "bulb", "bs-ui-icon"));
    document.querySelectorAll(".nexus-inline-action span[aria-hidden='true']").forEach((el) => setIcon(el, "external", "bs-ui-icon"));
    document.querySelectorAll(".rgaWatchAction span[aria-hidden='true'], .rgaWatchQuickArrow").forEach((el) => setIcon(el, "external", "bs-ui-icon"));
    document.querySelectorAll(".rgaWatchNoticeIcon").forEach((el) => setIcon(el, "info", "bs-ui-icon"));
    document.querySelectorAll(".rgaWatchEmptyGlyph").forEach((el) => setIcon(el, el.closest(".is-error") ? "info" : "refresh", "bs-ui-icon"));
    document.querySelectorAll(".rgaWatchQuickIcon").forEach((el) => {
      const link = el.closest("a");
      const href = link?.getAttribute("href") || "";
      const name = href.includes("admin") ? "shield" : href.includes("github") ? "code" : href.includes("youtube") ? "video" : href.includes("instagram") ? "camera" : "external";
      setIcon(el, name, "bs-ui-icon");
    });
    document.querySelectorAll(".nxai-message-avatar").forEach((el) => {
      setIcon(el, el.closest(".nxai-message-user") ? "user" : "brain", "bs-ui-icon");
    });
    document.querySelectorAll(".rgaWatchOpenLink").forEach((el) => {
      if (el.dataset.bsUiArrowApplied) return;
      const label = (el.textContent || "").replace(/[↗→]\s*$/, "").trim();
      el.replaceChildren(document.createTextNode(label), document.createTextNode(" "), icon("external", "bs-ui-icon"));
      el.dataset.bsUiArrowApplied = "true";
    });
    document.querySelectorAll(".rgaWatchChecklist li").forEach((el) => {
      el.classList.add("bs-ui-checklist-item");
      if (!el.querySelector(".bs-ui-check-icon")) el.prepend(icon("check", "bs-ui-icon bs-ui-check-icon"), document.createTextNode(" "));
    });
  }
  function start() {
    applyStaticIcons();
    const observer = new MutationObserver(() => applyStaticIcons());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
