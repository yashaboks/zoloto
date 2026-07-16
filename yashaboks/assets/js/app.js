/* ============================================================
   yashaboks — app logic
   i18n render · catalog / trust / steps / contacts · payout
   calculator · reveals · header · mobile menu · count-up
   Data lives in data.js (CONFIG, ICONS, STEPS, TRUST, BUY,
   CATALOG) and i18n.js (I18N).
   ============================================================ */
(function () {
  "use strict";

  var LANG_KEY = "yashaboks.lang";
  var SUPPORTED = ["uk"];
  var DEFAULT_LANG = "uk";

  /* ---------- tiny helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }

  /* space thousands separator (non-breaking) → "35 000" */
  function fmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /* weight: accepts number or "13,33"/"13.33" string → shows "13,33" */
  function fmtWeight(n) {
    if (n == null || n === "") return "";
    var num = parseFloat(String(n).replace(",", "."));
    if (isNaN(num)) return String(n);
    return (Math.round(num * 100) / 100).toString().replace(".", ",");
  }

  function getStoredLang() {
    var stored = null;
    try { stored = localStorage.getItem(LANG_KEY); } catch (e) {}
    return SUPPORTED.indexOf(stored) !== -1 ? stored : DEFAULT_LANG;
  }
  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }

  function t(key, lang) {
    var dict = I18N[lang] || I18N[DEFAULT_LANG];
    return (dict && dict[key] != null) ? dict[key] : key;
  }

  /* line-icon (data.js ICONS — drawn with stroke via CSS) */
  function lineIcon(key) {
    var inner = (typeof ICONS !== "undefined" && ICONS[key]) ? ICONS[key] : "";
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + "</svg>";
  }

  /* filled brand / contact glyphs (currentColor) */
  var GLYPHS = {
    phone: '<path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.3 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4.5c0-.6.4-1 1-1h3.6c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/>',
    tiktok: '<path d="M16.5 3c.35 2.1 1.6 3.55 3.5 3.9v2.5c-1.3 0-2.5-.35-3.6-.95v5.75c0 3-2.4 5.45-5.4 5.45S5.6 17.2 5.6 14.2s2.4-5.45 5.4-5.45c.3 0 .55.02.8.07v2.55c-.25-.08-.5-.12-.8-.12-1.6 0-2.85 1.35-2.85 2.95S9.4 17.1 11 17.1s2.9-1.35 2.9-2.95V3h2.6z"/>',
    instagram: '<path d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.8.22 2.43.47.66.25 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.25.63.42 1.36.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.07-.22 1.8-.47 2.43a4.9 4.9 0 0 1-1.15 1.77c-.55.55-1.11.9-1.77 1.15-.63.25-1.36.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.07-.05-1.8-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.63-.42-1.36-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.8.47-2.43.25-.66.6-1.22 1.15-1.77.55-.55 1.11-.9 1.77-1.15.63-.25 1.36-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 1.8c-2.67 0-2.99.01-4.04.06-.98.04-1.51.21-1.86.35-.47.18-.8.4-1.15.75-.35.35-.57.68-.75 1.15-.14.35-.31.88-.35 1.86-.05 1.05-.06 1.37-.06 4.03s.01 2.98.06 4.03c.04.98.21 1.51.35 1.86.18.47.4.8.75 1.15.35.35.68.57 1.15.75.35.14.88.31 1.86.35 1.05.05 1.37.06 4.04.06s2.99-.01 4.04-.06c.98-.04 1.51-.21 1.86-.35.47-.18.8-.4 1.15-.75.35-.35.57-.68.75-1.15.14-.35.31-.88.35-1.86.05-1.05.06-1.37.06-4.03s-.01-2.98-.06-4.03c-.04-.98-.21-1.51-.35-1.86a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.35-.14-.88-.31-1.86-.35C14.99 3.81 14.67 3.8 12 3.8zm0 3.28a4.92 4.92 0 1 1 0 9.84 4.92 4.92 0 0 1 0-9.84zm0 1.8a3.12 3.12 0 1 0 0 6.24 3.12 3.12 0 0 0 0-6.24zm5.13-.42a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3z"/>',
    viber: '<path d="M11.9 2.5c2.5 0 4.7.5 6.2 2 1.5 1.5 2 3.5 2 5.9 0 2.4-.5 4.4-2 5.9-1 1-2.5 1.6-4 1.8-.1 1-.2 2-.3 2.6-.1.4-.4.6-.8.4-1-.6-2.9-2.1-3.9-3-.4 0-.8-.1-1.2-.1-2.5-.3-4.5-.8-5.9-2.2C.6 13.9.5 11 1.7 8.3 2.4 6.6 3.7 5.2 5.6 4.2 7.4 3.1 9.6 2.5 11.9 2.5zm.1 1.6c-2 0-3.9.5-5.4 1.4-1.5.9-2.6 2-3.2 3.4-1 2.2-.9 4.5.6 6 .1.1.2.2.3.3-.2.6-.5 1.6-.7 2.1.7-.3 1.7-.7 2.3-1 .2.1.5.1.7.2 2 .4 3.9.8 6.3.5 1.3-.2 2.5-.7 3.3-1.5 1.1-1.1 1.5-2.7 1.5-4.6 0-2-.4-3.6-1.5-4.7-1.2-1.2-3-1.8-4.1-1.8zm-.6 2.3c.2 0 .3.1.3.3 0 .2-.1.3-.3.3-.8 0-1.4.2-1.9.7s-.7 1.1-.7 1.9c0 .2-.1.3-.3.3s-.3-.1-.3-.3c0-1 .3-1.8.9-2.4.6-.6 1.4-.9 2.3-.9zm.1 1.5c.2 0 .3.1.3.3s-.1.3-.3.3c-.3 0-.5.1-.7.3-.2.2-.3.4-.3.7 0 .2-.1.3-.3.3s-.3-.1-.3-.3c0-.5.2-.9.5-1.2.3-.3.7-.5 1.1-.7zm-3.6.9c.2 0 .3.1.4.3l.6 1.4c.1.2 0 .4-.1.5l-.4.4c.4.7 1 1.3 1.8 1.7l.4-.5c.1-.2.3-.2.5-.1l1.4.6c.2.1.3.3.3.5-.1.6-.6 1.1-1.2 1.2-.4 0-.8 0-1.9-.5-2.1-.9-3.3-2.7-3.5-3-.2-.2-.8-1.1-.8-2s.5-1.4.7-1.6c.2-.2.4-.3.6-.3z"/>',
    whatsapp: '<path d="M12 2.1a9.9 9.9 0 0 0-8.4 15.1L2.1 22l4.9-1.4A9.9 9.9 0 1 0 12 2.1zm0 1.8a8.1 8.1 0 0 1 6.8 12.5l-.2.3.6 2.1-2.2-.6-.3.2A8.1 8.1 0 1 1 12 3.9zM8.9 7.3c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.5c.1.2 1.7 2.7 4.2 3.7 2.1.9 2.5.7 2.9.7.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3l-1.5-.7c-.2-.1-.4-.1-.5.1l-.7.8c-.1.2-.3.2-.5.1-.7-.3-1.4-.7-2.1-1.6-.2-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.6c-.2-.4-.3-.4-.5-.4h-.4z"/>',
    telegram: '<path d="M21.9 5.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.4-.9.4l.3-4.5 8.2-7.4c.4-.3-.1-.5-.6-.2L7.1 13.4l-4.4-1.4c-1-.3-1-.9.2-1.4l17.2-6.6c.8-.3 1.5.2 1.2 1.3z"/>'
  };
  function glyph(name) {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + (GLYPHS[name] || "") + "</svg>";
  }

  /* ---------- static i18n pass ---------- */
  function applyI18n(lang) {
    document.documentElement.lang = lang;

    $all("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = t(key, lang);
      var attr = el.getAttribute("data-i18n-attr");
      if (attr) el.setAttribute(attr, val);
      else el.textContent = val;
    });

    $all("[data-i18n-ph]").forEach(function (el) {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"), lang));
    });
  }

  /* ---------- renderers ---------- */
  function renderSteps(lang) {
    var ol = $("#steps");
    if (!ol) return;
    ol.innerHTML = STEPS.map(function (s, i) {
      var n = i + 1;
      return (
        '<li class="step reveal">' +
          '<span class="step-icon">' + lineIcon(s.icon) + "</span>" +
          "<h3>" + t("how.s" + n + "_t", lang) + "</h3>" +
          "<p>" + t("how.s" + n + "_d", lang) + "</p>" +
        "</li>"
      );
    }).join("");
  }

  function renderTrust(lang) {
    var grid = $("#trustGrid");
    if (!grid) return;
    grid.innerHTML = TRUST.map(function (item) {
      return (
        '<article class="tcard reveal">' +
          '<span class="tcard-icon">' + lineIcon(item.icon) + "</span>" +
          "<h3>" + t("trust." + item.key + "_t", lang) + "</h3>" +
          "<p>" + t("trust." + item.key + "_d", lang) + "</p>" +
        "</article>"
      );
    }).join("");
  }

  function renderBuy(lang) {
    var ul = $("#buyChips");
    if (!ul) return;
    ul.innerHTML = BUY.map(function (chip) {
      return "<li>" + (chip[lang] || chip.uk) + "</li>";
    }).join("");
  }

  /* how many items to show before the "expand" button kicks in */
  var CATALOG_LIMIT = 6;
  var catalogExpanded = false;

  /* ---------- external data (edited via /admin CMS) ----------
     Catalog + settings live in assets/data/*.json so the client can
     edit them through the panel. If the fetch fails (e.g. opened as a
     local file://), we fall back to the defaults baked into data.js. */
  var catalogItems = (typeof CATALOG !== "undefined") ? CATALOG.slice() : [];

  function loadJSON(url) {
    if (typeof fetch !== "function") return Promise.resolve(null);
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* normalize a CMS item (flat name_ru/name_uk, "" price) into the
     shape the renderer expects ({ name:{uk,ru}, price:null|number }) */
  function normItem(it) {
    var price = it.price;
    if (price === "" || price === undefined) price = null;
    var name = (it.name && typeof it.name === "object")
      ? it.name
      : { uk: it.name_uk || it.name_ru || "", ru: it.name_ru || it.name_uk || "" };
    var photos = [];
    if (Array.isArray(it.photos)) {
      photos = it.photos.filter(function (p) { return !!p; });
    } else if (it.photo) {
      photos = [it.photo];
    }
    return {
      type: it.type || "coin",
      name: name,
      proba: it.proba,
      weight: it.weight,
      length: it.length || "",
      price: price,
      status: it.status || "available",
      photos: photos,
      photo: photos[0] || ""
    };
  }

  function applyCatalog(data) {
    if (data && data.items && data.items.length) {
      catalogItems = data.items.map(normItem);
    }
  }

  function applySettings(data) {
    if (!data) return;
    if (typeof data.rate === "number") CONFIG.rate = data.rate;
    if (typeof data.pawnRate === "number") CONFIG.pawnRate = data.pawnRate;
    var s = CONFIG.social;
    ["phone", "phoneDisplay", "telegram", "whatsapp", "viber", "tiktok", "instagram"]
      .forEach(function (k) { if (data[k]) s[k] = data[k]; });
  }

  function renderCatalog(lang) {
    var grid = $("#catalogGrid");
    if (!grid) return;

    if (!catalogItems.length) {
      grid.innerHTML = '<p class="catalog-empty">' + t("catalog.empty", lang) + "</p>";
      var emptyMore = $("#catalogMore");
      if (emptyMore) emptyMore.hidden = true;
      return;
    }

    grid.innerHTML = catalogItems.map(function (it) {
      var isSold = it.status === "sold";
      var statusKey = isSold ? "catalog.sold" : "catalog.available";
      var statusCls = isSold ? "sold" : "available";

      var altText = it.name[lang] || it.name.uk;
      var multi = it.photos && it.photos.length > 1;
      var media = it.photo
        ? '<img src="' + it.photo + '" alt="' + altText + '" loading="lazy"' +
            (multi ? ' data-photos="' + it.photos.join("|") + '"' : "") + " />"
        : lineIcon(it.type);
      var countBadge = multi
        ? '<span class="item-count">' + it.photos.length + ' фото</span>'
        : "";

      var priceHTML = (it.price == null)
        ? '<div class="item-price deal">' + t("catalog.deal", lang) + "</div>"
        : '<div class="item-price">' + fmt(it.price) + " " + CONFIG.currency + "</div>";

      return (
        '<article class="item reveal' + (isSold ? " is-sold" : "") + '">' +
          '<div class="item-media">' +
            '<span class="item-proba">' + it.proba + "</span>" +
            '<span class="item-status ' + statusCls + '">' + t(statusKey, lang) + "</span>" +
            countBadge +
            media +
          "</div>" +
          '<div class="item-body">' +
            '<h3 class="item-name">' + (it.name[lang] || it.name.uk) + "</h3>" +
            '<div class="item-meta">' +
              "<span>" + t("catalog.proba", lang) + " <b>" + it.proba + "</b></span>" +
              "<span>" + t("catalog.weight", lang) + " <b>" + fmtWeight(it.weight) + " г</b></span>" +
              (it.length ? "<span>" + t("catalog.length", lang) + " <b>" + it.length + "</b></span>" : "") +
            "</div>" +
            priceHTML +
          "</div>" +
        "</article>"
      );
    }).join("");

    applyCatalogLimit(lang);
  }

  /* show only the first CATALOG_LIMIT items until "expand" is pressed */
  function applyCatalogLimit(lang) {
    var grid = $("#catalogGrid");
    var moreWrap = $("#catalogMore");
    var btn = $("#catalogMoreBtn");
    if (!grid) return;

    var items = $all(".item", grid);

    if (items.length <= CATALOG_LIMIT) {
      items.forEach(function (el) { el.classList.remove("is-hidden"); });
      if (moreWrap) moreWrap.hidden = true;
      return;
    }

    items.forEach(function (el, i) {
      var hide = !catalogExpanded && i >= CATALOG_LIMIT;
      el.classList.toggle("is-hidden", hide);
      if (!hide) el.classList.add("in"); // reveal freshly shown cards
    });

    if (moreWrap) moreWrap.hidden = false;
    if (btn) {
      btn.textContent = catalogExpanded
        ? t("catalog.collapse", lang)
        : t("catalog.expand", lang) + " (" + items.length + ")";
    }
  }

  function initCatalogMore() {
    var btn = $("#catalogMoreBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      catalogExpanded = !catalogExpanded;
      applyCatalogLimit(activeLang);
      if (!catalogExpanded) {
        var sec = $("#catalog");
        if (sec) sec.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  function renderContacts(lang) {
    var s = CONFIG.social;
    var handle = "@yashaboks";

    var actions = [
      { icon: "phone",     href: "tel:" + s.phone,   label: t("contact.call", lang), sub: s.phoneDisplay, primary: true, ext: false },
      { icon: "telegram",  href: s.telegram,         label: "Telegram", sub: handle,        ext: true },
      { icon: "whatsapp",  href: s.whatsapp,         label: "WhatsApp", sub: s.phoneDisplay, ext: true },
      { icon: "viber",     href: s.viber,            label: "Viber",    sub: s.phoneDisplay, ext: false },
      { icon: "tiktok",    href: s.tiktok,           label: t("contact.write_tiktok", lang),    sub: handle,        ext: true },
      { icon: "instagram", href: s.instagram,        label: t("contact.write_instagram", lang), sub: handle,        ext: true }
    ];

    var wrap = $("#contactActions");
    if (wrap) {
      wrap.innerHTML = actions.map(function (a) {
        var extra = a.ext ? ' target="_blank" rel="noopener noreferrer"' : "";
        return (
          '<a class="ca' + (a.primary ? " ca-primary" : "") + '" href="' + a.href + '"' + extra + ">" +
            '<span class="ca-icon">' + glyph(a.icon) + "</span>" +
            '<span class="ca-text"><b>' + a.label + "</b><small>" + a.sub + "</small></span>" +
          "</a>"
        );
      }).join("");
    }

    var foot = $("#footerSocials");
    if (foot) {
      var socials = [
        { icon: "tiktok",    href: s.tiktok,    label: "TikTok",    ext: true },
        { icon: "instagram", href: s.instagram, label: "Instagram", ext: true },
        { icon: "phone",     href: "tel:" + s.phone, label: t("contact.call", lang), ext: false }
      ];
      foot.innerHTML = socials.map(function (a) {
        var extra = a.ext ? ' target="_blank" rel="noopener noreferrer"' : "";
        return '<a href="' + a.href + '" aria-label="' + a.label + '"' + extra + ">" + glyph(a.icon) + "</a>";
      }).join("");
    }
  }

  /* ---------- photo lightbox (tap a catalog photo → fullscreen) ---------- */
  function initLightbox() {
    var grid = $("#catalogGrid");
    if (!grid) return;

    var overlay = null, imgEl = null, prevBtn = null, nextBtn = null, counterEl = null;
    var lastFocus = null, hideTimer = null;
    var list = [], idx = 0, curAlt = "";

    function build() {
      overlay = document.createElement("div");
      overlay.className = "lightbox";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.hidden = true;
      overlay.innerHTML =
        '<button class="lightbox-close" type="button" aria-label="' +
          t("lightbox.close", activeLang) + '">&times;</button>' +
        '<button class="lightbox-nav lightbox-prev" type="button" aria-label="&#8249;">&#8249;</button>' +
        '<img class="lightbox-img" src="" alt="" />' +
        '<button class="lightbox-nav lightbox-next" type="button" aria-label="&#8250;">&#8250;</button>' +
        '<span class="lightbox-counter"></span>';
      document.body.appendChild(overlay);
      imgEl = overlay.querySelector(".lightbox-img");
      prevBtn = overlay.querySelector(".lightbox-prev");
      nextBtn = overlay.querySelector(".lightbox-next");
      counterEl = overlay.querySelector(".lightbox-counter");

      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target.classList.contains("lightbox-close")) close();
      });
      prevBtn.addEventListener("click", function (e) { e.stopPropagation(); nav(-1); });
      nextBtn.addEventListener("click", function (e) { e.stopPropagation(); nav(1); });
      document.addEventListener("keydown", function (e) {
        if (!overlay || overlay.hidden) return;
        if (e.key === "Escape" || e.key === "Esc") close();
        else if (e.key === "ArrowLeft") nav(-1);
        else if (e.key === "ArrowRight") nav(1);
      });
    }

    function render() {
      imgEl.src = list[idx];
      imgEl.alt = curAlt;
      var multi = list.length > 1;
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;
      counterEl.hidden = !multi;
      if (multi) counterEl.textContent = (idx + 1) + " / " + list.length;
    }

    function nav(dir) {
      if (list.length < 2) return;
      idx = (idx + dir + list.length) % list.length;
      render();
    }

    function open(photos, startIdx, alt) {
      if (!overlay) build();
      if (hideTimer) { window.clearTimeout(hideTimer); hideTimer = null; }
      lastFocus = document.activeElement;
      list = photos && photos.length ? photos : [""];
      idx = startIdx || 0;
      curAlt = alt || "";
      render();
      overlay.hidden = false;
      document.body.classList.add("lb-open");
      void overlay.offsetWidth; // force reflow so the transition plays (rAF is throttled in bg tabs)
      overlay.classList.add("is-open");
      var btn = overlay.querySelector(".lightbox-close");
      if (btn) btn.focus();
    }

    function close() {
      if (!overlay) return;
      overlay.classList.remove("is-open");
      document.body.classList.remove("lb-open");
      hideTimer = window.setTimeout(function () {
        overlay.hidden = true;
        imgEl.src = "";
      }, 240);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    /* delegated: grid stays put, only innerHTML changes on re-render */
    grid.addEventListener("click", function (e) {
      var img = e.target.closest ? e.target.closest(".item-media img") : null;
      if (!img) return;
      var data = img.getAttribute("data-photos");
      var photos = data ? data.split("|") : [img.getAttribute("src")];
      open(photos, 0, img.getAttribute("alt"));
    });
  }

  /* ---------- payout calculator ---------- */
  var calc = {};
  function initCalc() {
    calc.grams = $("#calcGrams");
    calc.range = $("#calcRange");
    calc.payout = $("#calcPayout");
    calc.save = $("#calcSave");
    if (!calc.grams || !calc.range) return;

    var max = parseFloat(calc.range.max) || 100;

    function update(grams) {
      if (isNaN(grams) || grams < 0) grams = 0;
      var payout = grams * CONFIG.rate;
      var save = grams * (CONFIG.rate - CONFIG.pawnRate);
      if (calc.payout) calc.payout.innerHTML = fmt(payout);
      if (calc.save) calc.save.innerHTML = fmt(save) + " " + CONFIG.currency;
      var pct = Math.max(0, Math.min(100, (grams / max) * 100));
      calc.range.style.setProperty("--fill", pct + "%");
    }

    calc.grams.addEventListener("input", function () {
      var g = parseFloat(calc.grams.value);
      if (!isNaN(g)) {
        // keep slider in sync but don't fight the free number input above its max
        calc.range.value = Math.min(g, max);
      }
      update(isNaN(g) ? 0 : g);
    });

    calc.range.addEventListener("input", function () {
      var g = parseFloat(calc.range.value);
      calc.grams.value = g;
      update(g);
    });

    update(parseFloat(calc.grams.value) || 0);
  }

  /* ---------- hero count-up ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    if (isNaN(target)) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(target);
      return;
    }
    var start = null;
    var dur = 1100;
    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- reveal on scroll ---------- */
  function initReveals() {
    var targets = $all(".reveal");
    if (!("IntersectionObserver" in window) || !targets.length) {
      targets.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* tag static blocks as reveal targets (dynamic cards get it inline) */
  function markReveals() {
    var sel = [
      ".hero .eyebrow", ".hero-title", ".price-hero", ".ph-note",
      ".hero-sub", ".hero-cta", ".hero-chips",
      ".section-head", ".price-copy .compare", ".calc",
      ".contact-card"
    ];
    $all(sel.join(",")).forEach(function (el) { el.classList.add("reveal"); });
  }

  /* ---------- header scrolled state ---------- */
  function initHeader() {
    var header = $(".site-header");
    if (!header) return;
    function onScroll() {
      if (window.scrollY > 12) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- mobile menu ---------- */
  function initMobileMenu() {
    var toggle = $(".nav-toggle");
    var menu = $("#mobileMenu");
    var header = $(".site-header");
    if (!toggle || !menu) return;

    function setOpen(open) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { menu.hidden = false; }
      else { menu.hidden = true; }
      if (header) header.classList.toggle("menu-open", open);
    }

    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });

    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980) setOpen(false);
    });
  }

  /* ---------- language switch ---------- */
  var activeLang = DEFAULT_LANG;

  function renderDynamic(lang) {
    renderSteps(lang);
    renderTrust(lang);
    renderBuy(lang);
    renderCatalog(lang);
    renderContacts(lang);
  }

  function setLang(lang, opts) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    activeLang = lang;
    saveLang(lang);

    applyI18n(lang);
    renderDynamic(lang);

    $all(".lang-switch button").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-lang") === lang);
    });

    // re-observe freshly rendered cards
    if (!opts || !opts.initial) initReveals();
  }

  function initLangSwitch() {
    $all(".lang-switch button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-lang");
        if (lang === activeLang) return;
        var main = document.body;
        main.style.transition = "opacity .18s ease";
        main.style.opacity = "0.35";
        window.setTimeout(function () {
          setLang(lang);
          main.style.opacity = "1";
          window.setTimeout(function () { main.style.transition = ""; }, 220);
        }, 130);
      });
    });
  }

  /* ---------- brand → smooth scroll to top ---------- */
  function initScrollTop() {
    $all('a[href="#top"], a[href="#hero"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  /* ---------- boot ---------- */
  function init() {
    var lang = getStoredLang();

    var yearEl = $("#year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    markReveals();
    setLang(lang, { initial: true });

    initCalc();
    initHeader();
    initMobileMenu();
    initLangSwitch();
    initScrollTop();
    initCatalogMore();
    initLightbox();
    initReveals();

    var phNum = $(".ph-num[data-count]");
    if (phNum) countUp(phNum);
  }

  /* fetch external data (catalog + settings) then boot; on any
     failure we just boot with the defaults from data.js */
  function boot() {
    Promise.all([
      loadJSON("assets/data/settings.json"),
      loadJSON("assets/data/catalog.json")
    ]).then(function (res) {
      applySettings(res[0]);
      applyCatalog(res[1]);
    })["catch"](function () {})
      .then(function () { init(); }, function () { init(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
