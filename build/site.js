(function () {
  'use strict';
  var root = document.documentElement;
  var SPA = root.hasAttribute('data-spa');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (n) { return Math.max(0, Math.min(1, n)); };
  var active = null;
  /* Language */
  var I18N = window.OVA_I18N || {}, LANG = 'en';
  function t(str, v) {
    var m = LANG !== 'en' && I18N[LANG] && I18N[LANG][str];
    var o = m || str;
    if (v) o = o.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ''; });
    return o;
  }
  var tk = function (x) { return x; };
  window.OvaT = t;

  /* Theme */
  $$('#theme-btn, [data-theme-toggle]').forEach(function (themeBtn) { themeBtn.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ovanova-theme', next); } catch (e) {}
  }); });
  try { var saved = localStorage.getItem('ovanova-theme'); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}

  /* Navigation: mega menus, mobile sheet, tuck on scroll */
  var shell = $('.nav-shell');
  var megaBtns = $$('[data-mega]');
  var sheet = $('#sheet'), menuBtn = $('#menu-btn');
  var hoverT;
  function closeMegas(except) {
    megaBtns.forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var m = document.getElementById(b.getAttribute('aria-controls')); if (m) m.hidden = true;
    });
  }
  function openMega(b) {
    closeMegas(b);
    b.setAttribute('aria-expanded', 'true');
    document.getElementById(b.getAttribute('aria-controls')).hidden = false;
  }
  megaBtns.forEach(function (b) {
    var m = document.getElementById(b.getAttribute('aria-controls'));
    b.addEventListener('click', function () { if (b.getAttribute('aria-expanded') === 'true') closeMegas(); else openMega(b); });
    if (matchMedia('(hover: hover)').matches) {
      [b, m].forEach(function (el) {
        el.addEventListener('mouseenter', function () { clearTimeout(hoverT); openMega(b); });
        el.addEventListener('mouseleave', function () { clearTimeout(hoverT); hoverT = setTimeout(closeMegas, 180); });
      });
    }
  });
  function setSheet(open) {
    if (!sheet) return;
    sheet.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
    shell.classList.toggle('menu-open', open);
  }
  if (menuBtn) menuBtn.addEventListener('click', function () { setSheet(sheet.hidden); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMegas(); setSheet(false); } });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-shell')) { closeMegas(); setSheet(false); }
    var a = e.target.closest('a');
    if (a && a.closest('.mega, .sheet')) { closeMegas(); setSheet(false); }
  });

  /* Pointer light on glass */
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest('.spot') : null;
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* Count-up numbers */
  function tween(el, to, fmt, ms) {
    var from = parseFloat(el.dataset.v); if (isNaN(from)) from = to;
    el.dataset.v = to;
    if (calm || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function step(t) {
      var k = clamp((t - t0) / (ms || 500)), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1 && parseFloat(el.dataset.v) === to) requestAnimationFrame(step);
    })(t0);
  }

  /* Per-page activation: rise-ins, word reveals, counters */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target; io.unobserve(el);
      if (el.hasAttribute('data-rise')) el.classList.remove('pre');
      if (el.hasAttribute('data-count')) {
        var to = parseFloat(el.getAttribute('data-count'));
        el.dataset.v = 0;
        tween(el, to, function (n) { return Math.round(n).toLocaleString('en-US'); }, 1400);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;

  function activate(page) {
    active = page;
    var vh = window.innerHeight;
    if (!calm && io) {
      $$('[data-rise]', page).forEach(function (el) {
        if (el.closest('[hidden]')) { el.classList.remove('pre'); return; }
        if (el.getBoundingClientRect().top > vh * 0.92) { el.classList.add('pre'); io.observe(el); }
        else el.classList.remove('pre');
      });
      $$('[data-count]', page).forEach(function (el) {
        if (el.getBoundingClientRect().top > vh * 0.9) io.observe(el);
      });
    }
    $$('[data-words]', page).forEach(function (el) {
      if (!el.dataset.src) el.dataset.src = el.textContent.replace(/\s+/g, ' ').trim();
      if (calm || el.classList.contains('words-on')) return;
      splitWords(el, t(el.dataset.src));
      el.classList.add('words-on');
    });
    placeThumb();
    onScroll();
    if (window.OvaRail) window.OvaRail.page(page);
  }

  /* One scroll loop for the active page */
  var ticking = false, lastY = window.scrollY, sc = null;
  function frame() {
    ticking = false;
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    if (window.OvaRail) window.OvaRail.tick(y, Math.max(1, max));
    if (shell) {
      shell.style.setProperty('--p', max > 0 ? clamp(y / max).toFixed(4) : 0);
      var p = $('.progress'); if (p) p.style.setProperty('--p', max > 0 ? clamp(y / max).toFixed(4) : 0);
      var down = y > lastY + 4, up = y < lastY - 4;
      if (down && y > 320 && !megaBtns.some(function (b) { return b.getAttribute('aria-expanded') === 'true'; })) shell.classList.add('tuck');
      else if (up || y < 120) shell.classList.remove('tuck');
    }
    lastY = y;
    if (!active || calm) return;
    // collect the animated pieces once per page, then read every position before writing anything
    if (!sc || sc.page !== active) sc = { page: active, hero: $('.hero, .phero', active), st: $$('.statement.words-on', active), par: $$('.par', active), steps: $$('.steps', active).map(function (el) { return { el: el, st: $$('.step', el) }; }), tl: $$('.tl-item', active) };
    var heroH = sc.hero ? sc.hero.offsetHeight : 0;
    var rSt = sc.st.map(function (el) { return el.getBoundingClientRect(); });
    var rPar = sc.par.map(function (el) { return el.getBoundingClientRect(); });
    var rSteps = sc.steps.map(function (o) { return o.el.getBoundingClientRect(); });
    var rTl = sc.tl.map(function (el) { return el.getBoundingClientRect().top; });
    if (sc.hero) sc.hero.style.setProperty('--hs', clamp(y / heroH).toFixed(4));
    sc.st.forEach(function (el, n) {
      var r = rSt[n], ws = el.children, k = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.3)), lit = Math.round(k * ws.length);
      if (el._lit === lit && el._n === ws.length && el._w === ws[0]) return;
      el._lit = lit; el._n = ws.length; el._w = ws[0];
      for (var i = 0; i < ws.length; i++) ws[i].classList.toggle('lit', i < lit);
    });
    sc.par.forEach(function (el, n) { var r = rPar[n]; if (r.bottom > 0 && r.top < vh) el.style.setProperty('--py', (clamp((vh - r.top) / (vh + r.height)) * 2 - 1).toFixed(4)); });
    sc.steps.forEach(function (o, n) {
      var r = rSteps[n], k = clamp((vh * 0.8 - r.top) / (r.height + vh * 0.2));
      o.el.style.setProperty('--sp', k.toFixed(4));
      o.st.forEach(function (st, i) { st.classList.toggle('on', k >= (i + 0.3) / o.st.length || k >= 0.98); });
    });
    sc.tl.forEach(function (el, n) { el.classList.toggle('on', rTl[n] < vh * 0.62); });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { placeThumb(); onScroll(); });

  /* Home: system explorer (illustrative figures) */
  var info = {
    solar: [tk('Solar'), tk('Panels generate power through the day. The microgrid uses it first, before anything from the utility.')],
    battery: [tk('Battery'), tk('Stores surplus energy and releases it when the sun is down or the grid is out.')],
    generator: [tk('Generator'), tk('Backup generation for long outages, started only when it is needed.')],
    grid: [tk('Utility grid'), tk('Still connected, but no longer your only source. The system works with it when that helps.')],
    nerd: [tk('NERD controller'), tk('The spine and brain of the system. It decides, moment to moment, where each source should send power.')],
    home: [tk('Home'), tk('Your lights, refrigeration, heating and cooling. The loads the system exists to keep running.')],
    ev: [tk('EV charger'), tk('Charges your vehicle from local energy, timed around what the rest of the property needs.')]
  };
  var modes = {
    day: { links: { solar: 1, battery: -1, generator: 0, grid: -1, home: 1, ev: 1 },
      state: { solar: [tk('Generating'), 'on', 6.4], battery: [tk('Charging'), 'on', 1.5], generator: [tk('Standby'), '', 0], grid: [tk('Exporting'), 'on', 1.0], nerd: [tk('Balancing'), 'on', 6.4], home: [tk('Powered'), 'on', 2.1], ev: [tk('Charging'), 'on', 1.8] },
      scene: tk('Midday. Solar runs the property and charges the car. Surplus fills the battery, then flows to the grid where your utility allows it.') },
    evening: { links: { solar: 0, battery: 1, generator: 0, grid: 0, home: 1, ev: 0 },
      state: { solar: [tk('Idle'), '', 0], battery: [tk('Discharging'), 'on', 1.8], generator: [tk('Standby'), '', 0], grid: [tk('Standby'), '', 0], nerd: [tk('Balancing'), 'on', 1.8], home: [tk('Powered'), 'on', 1.8], ev: [tk('Paused'), '', 0] },
      scene: tk('Evening. The sun is down, so the energy stored at midday carries the home through the peak.') },
    outage: { links: { solar: 1, battery: 1, generator: 0, grid: 0, home: 1, ev: 0 },
      state: { solar: [tk('Generating'), 'on', 0.9], battery: [tk('Discharging'), 'on', 0.7], generator: [tk('Ready'), '', 0], grid: [tk('Down'), 'off', 0], nerd: [tk('Islanded'), 'on', 1.6], home: [tk('Powered'), 'on', 1.6], ev: [tk('Paused'), '', 0] },
      scene: tk('Outage. The grid drops and the microgrid carries on alone. Solar and battery run your loads, with the generator ready if the battery runs low.') }
  };
  var stage = $('.stage'), detail = $('#detail'), thumb = $('.modes .thumb');
  var mode = 'day', sel = 'solar', swapT;
  function placeThumb() {
    if (!thumb) return;
    var b = $('.modes button[aria-pressed="true"]');
    if (!b || !b.offsetWidth) return;
    thumb.style.width = b.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  function fillDetail() {
    var st = modes[mode].state[sel];
    $('#d-title').textContent = t(info[sel][0]);
    $('#d-text').textContent = t(info[sel][1]);
    var pill = $('#d-state'); pill.textContent = t(st[0]); pill.setAttribute('data-state', st[1]);
    $('#d-scene').textContent = t(modes[mode].scene);
    tween($('#d-kw'), st[2], function (n) { return n.toFixed(1); }, 600);
  }
  function renderSystem(swap) {
    var m = modes[mode];
    stage.setAttribute('data-mode', mode);
    $$('.modes button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
    placeThumb();
    $$('.pulse').forEach(function (p) { p.setAttribute('data-dir', m.links[p.dataset.link]); });
    $$('.node').forEach(function (n) {
      var st = m.state[n.dataset.node][1];
      n.classList.toggle('on', st === 'on'); n.classList.toggle('off', st === 'off'); n.classList.toggle('sel', n.dataset.node === sel);
    });
    if (swap && !calm) { detail.classList.add('swap'); clearTimeout(swapT); swapT = setTimeout(function () { fillDetail(); detail.classList.remove('swap'); }, 200); }
    else fillDetail();
    if (window.OvaSystemScene) window.OvaSystemScene.apply(systemState());
  }
  function systemState() {
    var names = {}; Object.keys(info).forEach(function (k) { names[k] = t(info[k][0]); });
    return { mode: mode, sel: sel, links: modes[mode].links, state: modes[mode].state, names: names };
  }
  window.OvaSystem = { get: systemState, pick: function (k) { sel = k; renderSystem(true); } };
  if (stage) {
    $$('.modes button').forEach(function (b) { b.addEventListener('click', function () { mode = b.dataset.mode; renderSystem(true); }); });
    $$('.node').forEach(function (n) {
      function pick() { sel = n.dataset.node; renderSystem(true); }
      n.addEventListener('click', pick);
      n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    });
    renderSystem(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeThumb);
  }

  /* Tabs with image crossfade */
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    function show(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        if (t.dataset.img) document.getElementById(t.dataset.img).classList.toggle('on', on);
      });
      var cap = list.dataset.cap && document.getElementById(list.dataset.cap);
      if (cap) cap.textContent = tab.firstElementChild.firstChild.textContent.trim();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { show(t); });
      t.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
        if (!d) return; e.preventDefault();
        var next = tabs[(i + d + tabs.length) % tabs.length]; show(next); next.focus();
      });
    });
  });

  /* Testimonial tracks */
  $$('[data-track]').forEach(function (wrap) {
    var track = $('.track', wrap);
    function slide(dir) { var c = $('.voice', track); track.scrollBy({ left: dir * (c.offsetWidth + 20), behavior: calm ? 'auto' : 'smooth' }); }
    var prev = $('[data-prev]', wrap), next = $('[data-next]', wrap);
    if (prev) prev.addEventListener('click', function () { slide(-1); });
    if (next) next.addEventListener('click', function () { slide(1); });
  });

  /* Estimate */
  var bill = $('#in-bill');
  if (bill) {
    var share = $('#in-share'), out = $('#in-out');
    var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
    var estimate = function () {
      [bill, share, out].forEach(function (el) { el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); });
      var year = Number(bill.value) * 12 * Number(share.value) / 100;
      $('#out-bill').textContent = usd(bill.value);
      $('#out-share').textContent = share.value + '%';
      $('#out-out').textContent = out.value + ' h';
      tween($('#fig-year'), year, usd, 450);
      tween($('#fig-ten'), year * 10, usd, 450);
      $('#fig-out').textContent = out.value + ' h';
    };
    [bill, share, out].forEach(function (el) { el.addEventListener('input', estimate); });
    estimate();
  }

  /* Forms: design preview, nothing is sent */
  $$('form.js-form').forEach(function (form) {
    var status = $('.form-status', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { status.textContent = t('Fill in the required fields to continue.'); form.reportValidity(); return; }
      status.textContent = t('Preview only: this form is not connected yet, so nothing was sent.');
    });
  });

  /* Images fade in once loaded, over a soft placeholder */
  document.documentElement.classList.add('js-img');
  Array.prototype.forEach.call(document.querySelectorAll('.frame img, .card img, .photo img, .app-poster img'), function (im) {
    var done = function () { im.classList.add('ld'); };
    if (im.complete && im.naturalWidth) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); }
  });

  /* Hero video */
  var vid = $('#hero-video'), vidBtn = $('#vid-btn');
  function setVideo(play) {
    if (!vid) return;
    if (play) { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } else vid.pause();
    vidBtn.setAttribute('aria-pressed', String(!play));
    vidBtn.setAttribute('aria-label', play ? t('Pause background video') : t('Play background video'));
    $('#vid-icon').setAttribute('d', play ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
  }
  if (vid) {
    var userPaused = calm;
    // the button always shows what the video is actually doing
    var syncBtn = function () {
      var playing = !vid.paused;
      vidBtn.setAttribute('aria-pressed', String(!playing));
      vidBtn.setAttribute('aria-label', playing ? t('Pause background video') : t('Play background video'));
      $('#vid-icon').setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
    };
    vid.addEventListener('play', syncBtn); vid.addEventListener('pause', syncBtn);
    if (calm) { vid.removeAttribute('autoplay'); vid.pause(); }
    else {
      // phones only autoplay video that is muted and inline: set it as properties too, not just attributes
      vid.muted = true; vid.defaultMuted = true; vid.playsInline = true; vid.setAttribute('webkit-playsinline', '');
      var tryPlay = function () { if (userPaused) return; var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); };
      tryPlay();
      // iPhones stream video only from servers that answer byte-range requests. If it has not started,
      // load the whole file and play it from memory instead.
      setTimeout(function () {
        if (!vid.paused || userPaused || vid._whole || !window.fetch || !window.URL) return;
        vid._whole = true;
        fetch(vid.currentSrc || vid.src).then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) {
          if (!bl) return;
          vid.src = URL.createObjectURL(bl); vid.load(); tryPlay();
        }).catch(function () {});
      }, 2000);
      // Low Power Mode holds autoplay until the first touch: start it then
      var kick = function () { if (vid.paused) tryPlay(); };
      document.addEventListener('touchend', kick, { once: true, passive: true });
      document.addEventListener('click', kick, { once: true });
    }
    vidBtn.addEventListener('click', function () { setVideo(vid.paused); userPaused = vid.paused; });
    // stop decoding the video while it is off screen; resume only if the visitor had it playing
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
      if (userPaused) return;
      if (es[0].isIntersecting) tryPlay ? tryPlay() : vid.play(); else vid.pause();
    }).observe(vid);
    syncBtn();
  }
  var drift = $('#m-solar');
  if (drift && !calm) {
    var home = $('#m-home'), tick = 0;
    setInterval(function () {
      tick += 1;
      drift.firstChild.nodeValue = (6.4 + Math.sin(tick / 3) * 0.3).toFixed(1);
      home.firstChild.nodeValue = (2.1 + Math.cos(tick / 2) * 0.2).toFixed(1);
    }, 1800);
  }


  /* Language switch: swaps static text, attributes and word-reveal statements, then tells the tools */
  var TATTR = ['alt', 'aria-label', 'placeholder', 'title', 'data-label'];
  function splitWords(el, txt) {
    el.innerHTML = txt.trim().split(/\s+/).map(function (w) { return '<span class="w">' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>'; }).join(' ');
  }
  function lookup(src) { var k = src.replace(/\s+/g, ' ').trim(); return LANG === 'en' ? null : (I18N[LANG] && I18N[LANG][k]) || null; }
  function applyLang(l, quiet) {
    LANG = (l !== 'en' && I18N[l]) ? l : 'en';
    root.setAttribute('lang', LANG);
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      var p = n.parentNode; if (!p || p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE') return 2;
      if (p.closest && p.closest('[data-words]')) return 2;
      return /[A-Za-zÀ-ſ]/.test(n.nodeValue) ? 1 : 2; } });
    var n, nodes = [];
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (n) {
      if (n.__en == null) n.__en = n.nodeValue;
      var src = n.__en, tr = lookup(src);
      n.nodeValue = tr ? src.match(/^\s*/)[0] + tr + src.match(/\s*$/)[0] : src;
    });
    $$('[' + TATTR.join('],[') + ']').forEach(function (el) {
      TATTR.forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        var k = '__en_' + a; if (el[k] == null) el[k] = el.getAttribute(a);
        el.setAttribute(a, lookup(el[k]) || el[k]);
      });
    });
    $$('[data-words]').forEach(function (el) {
      if (!el.dataset.src) el.dataset.src = el.textContent.replace(/\s+/g, ' ').trim();
      var txt = t(el.dataset.src);
      if (el.classList.contains('words-on')) splitWords(el, txt); else el.textContent = txt;
    });
    var pg = $('.page:not([hidden])');
    if (pg && pg.getAttribute('data-title')) document.title = t(pg.getAttribute('data-title'));
    $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === LANG)); });
    if (!quiet) { try { localStorage.setItem('ovanova-lang', LANG); } catch (e) {} }
    if (typeof renderSystem === 'function' && stage) renderSystem(false);
    document.dispatchEvent(new CustomEvent('ova:lang', { detail: LANG }));
    placeThumb(); onScroll();
  }
  window.OvaLang = applyLang;
  $$('[data-lang]').forEach(function (b) { b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); }); });
  (function () {
    var saved = null; try { saved = localStorage.getItem('ovanova-lang'); } catch (e) {}
    var want = saved || ((navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en');
    LANG = (want !== 'en' && I18N[want]) ? want : 'en';
  })();

  /* Mark the current page in the nav */
  function markNav(name) {
    $$('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    megaBtns.forEach(function (b) {
      var m = document.getElementById(b.getAttribute('aria-controls'));
      b.classList.toggle('current', !!$('[data-nav="' + name + '"]', m));
    });
  }

  /* Single-file build: hash router between pages */
  if (SPA) {
    var pages = {};
    $$('.page[data-page]').forEach(function (p) { pages[p.getAttribute('data-page')] = p; });
    var current = null;
    var show = function (name) {
      if (current === name) return false;
      Object.keys(pages).forEach(function (k) { pages[k].hidden = k !== name; });
      current = name;
      var p = pages[name];
      p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
      document.title = t(p.getAttribute('data-title'));
      markNav(name);
      if (vid) { if (name === 'home' && !calm && vidBtn.getAttribute('aria-pressed') !== 'true') { var pr = vid.play(); if (pr && pr.catch) pr.catch(function () {}); } else if (name !== 'home') vid.pause(); }
      window.scrollTo(0, 0);
      shell.classList.remove('tuck');
      requestAnimationFrame(function () { activate(p); });
      return true;
    };
    var route = function () {
      var h = decodeURIComponent(location.hash.slice(1));
      if (!h || pages[h]) { show(h || 'home'); return; }
      var target = document.getElementById(h);
      var owner = target && target.closest('.page');
      if (!owner) { show('home'); return; }
      var changed = show(owner.getAttribute('data-page'));
      setTimeout(function () { target.scrollIntoView({ behavior: 'auto', block: 'start' }); }, changed ? 60 : 0);
    };
    window.addEventListener('hashchange', route);
    route();
  } else {
    var page = $('.page');
    markNav(page.getAttribute('data-page'));
    activate(page);
  }
})();
