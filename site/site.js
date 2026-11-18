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
    var cur = root.getAttribute('data-theme') || 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ovanova-theme', next); } catch (e) {}
  }); });
  try { var saved = localStorage.getItem('ovanova-theme'); root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light'); } catch (e) {}

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

/* Ovanova decision tools. Each answers one question a visitor arrives with.
   All figures are illustrative engineering estimates; assumptions are stated next to every result. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(tag, attrs, s, parent) { var e = sv(tag, attrs, parent); e.textContent = s; return e; }
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- Shared home-energy model ---------- */
  // avg = average kW while running during an outage; peak = kW when it starts; shape = when it runs
  var LOADS = {
    fridge: { name: 'Refrigerator', lc: tk('refrigerator'), avg: 0.15, peak: 0.8, shape: 'flat' },
    freezer: { name: 'Freezer', lc: tk('freezer'), avg: 0.08, peak: 0.6, shape: 'flat' },
    lights: { name: 'Lights', lc: tk('lights'), avg: 0.2, peak: 0.4, shape: 'evening' },
    net: { name: 'Internet and phones', lc: tk('internet and phones'), avg: 0.08, peak: 0.15, shape: 'flat' },
    medical: { name: 'Medical device', lc: tk('medical device'), avg: 0.12, peak: 0.4, shape: 'flat' },
    well: { name: 'Well pump', lc: tk('well pump'), avg: 0.25, peak: 2.0, shape: 'day' },
    furnace: { name: 'Furnace fan', lc: tk('furnace fan'), avg: 0.35, peak: 0.8, shape: 'flat' },
    ac: { name: 'Central AC', lc: tk('central AC'), avg: 2.2, peak: 4.5, shape: 'hot' },
    water: { name: 'Water heater', lc: tk('water heater'), avg: 0.9, peak: 4.5, shape: 'day' },
    cook: { name: 'Electric cooking', lc: tk('electric cooking'), avg: 0.5, peak: 3.0, shape: 'meals' },
    ev: { name: 'EV charging', lc: tk('EV charging'), avg: 0.33, peak: 7.2, shape: 'night' }
  };
  // hourly weights for each shape, normalized to a mean of 1
  var SHAPES = (function () {
    var raw = {
      flat: function () { return 1; },
      evening: function (h) { return (h >= 18 && h < 23) ? 4 : (h >= 6 && h < 8) ? 2 : 0.15; },
      day: function (h) { return (h >= 6 && h < 22) ? 1.4 : 0.3; },
      hot: function (h) { return (h >= 11 && h < 21) ? 1.7 : 0.45; },
      meals: function (h) { return (h === 7 || h === 12 || h === 18 || h === 19) ? 5 : 0.05; },
      night: function (h) { return (h >= 0 && h < 6) ? 4 : 0; }
    };
    var out = {};
    Object.keys(raw).forEach(function (k) {
      var w = [], s = 0;
      for (var h = 0; h < 24; h++) { w.push(raw[k](h)); s += w[h]; }
      out[k] = w.map(function (x) { return x * 24 / s; });
    });
    return out;
  })();
  function loadAt(keys, hour) {
    var h = Math.floor(((hour % 24) + 24) % 24), kw = 0;
    keys.forEach(function (k) { kw += LOADS[k].avg * SHAPES[LOADS[k].shape][h]; });
    return kw;
  }
  // clear-sky output per kW of panels; summer ≈ 5.6 kWh/kW·day, winter ≈ 2.5
  function solarAt(kwp, hour, season, sky) {
    var h = ((hour % 24) + 24) % 24;
    var rise = season === 'winter' ? 7.5 : 6, set = season === 'winter' ? 16.5 : 20;
    if (h <= rise || h >= set) return 0;
    var peak = season === 'winter' ? 0.55 : 0.72;
    var cloud = sky === 'overcast' ? 0.3 : 1;
    return kwp * peak * cloud * Math.pow(Math.sin(Math.PI * (h - rise) / (set - rise)), 1.5);
  }
  // Simulate an outage that starts at 6 pm with a full battery. dt = 15 min.
  function simulate(o) {
    var dt = 0.25, steps = Math.round(o.hours / dt), soc = o.cap, out = [], firstOut = null, unmet = 0;
    for (var i = 0; i <= steps; i++) {
      var tm = i * dt, clock = 18 + tm;
      var load = loadAt(o.keys, clock), sun = solarAt(o.kwp, clock, o.season, o.sky);
      if (i > 0) {
        var net = sun - load;
        soc += net > 0 ? net * dt * 0.95 : net * dt / 0.95;
        if (soc > o.cap) soc = o.cap;
        if (soc <= 0) { unmet += -soc; soc = 0; if (firstOut === null) firstOut = tm; }
      }
      out.push({ t: tm, clock: clock, load: load, sun: sun, soc: soc, pct: o.cap ? soc / o.cap : 0, dark: soc <= 0 && load > sun });
    }
    var dayLoad = 0, daySun = 0;
    for (var h = 0; h < 24; h++) { dayLoad += loadAt(o.keys, h); daySun += solarAt(o.kwp, h + 0.5, o.season, o.sky); }
    var peak = 0; o.keys.forEach(function (k) { peak += LOADS[k].peak; });
    return { series: out, firstOut: firstOut, dayLoad: dayLoad, daySun: daySun, peak: peak, avg: dayLoad / 24 };
  }
  window.OvaModel = { LOADS: LOADS, SHAPES: SHAPES, simulate: simulate, loadAt: loadAt, solarAt: solarAt };

  /* ---------- Residential: outage planner ---------- */
  var BATT = {
    '13.5': { cap: 13.5, kw: 5, name: tk('one home battery') },
    '27': { cap: 27, kw: 10, name: tk('two home batteries') },
    '40.5': { cap: 40.5, kw: 15, name: tk('three home batteries') },
    '65': { cap: 65, kw: 50, name: tk('a NERD') }
  };
  function planner(root) {
    var form = $('.pl-controls', root), chart = $('.pl-chart', root), scrub = $('.pl-scrub', root), play = $('.pl-play', root);
    var verdict = $('.pl-verdict', root), sub = $('.pl-sub', root), tip = $('.pl-tip', root), clockEl = $('.pl-clock', root);
    var stats = { load: $('[data-o="load"]', root), sun: $('[data-o="sun"]', root), peak: $('[data-o="peak"]', root), batt: $('[data-o="batt"]', root) };
    var state = null, scene = null, tIdx = 0, playing = false, raf = 0, speed = 0.6, listeners = [];
    var H = 72;

    function read() {
      var keys = $$('input[name="pl-load"]:checked', form).map(function (i) { return i.value; });
      var b = BATT[$('input[name="pl-batt"]:checked', form).value];
      return { keys: keys, cap: b.cap, inv: b.kw, bname: b.name, kwp: Number($('#pl-solar', form).value),
        season: $('input[name="pl-season"]:checked', form).value, sky: $('input[name="pl-sky"]:checked', form).value, hours: H };
    }
    function hoursLabel(h) { return h >= 48 ? t('{n} days', { n: f1(h / 24) }) : t('{n} hours', { n: Math.round(h) }); }
    function suggest(o, r) {
      // try the single change that buys the most time
      if (r.firstOut === null) return '';
      var opts = [];
      if (o.keys.length) {
        var big = o.keys.slice().sort(function (a, b) { return LOADS[b].avg - LOADS[a].avg; })[0];
        var o1 = Object.assign({}, o, { keys: o.keys.filter(function (k) { return k !== big; }) });
        opts.push({ r: simulate(o1), k: 'off', v: { load: t(LOADS[big].lc) } });
      }
      var caps = Object.keys(BATT).map(Number).sort(function (a, b) { return a - b; });
      var next = caps.filter(function (c) { return c > o.cap; })[0];
      if (next) opts.push({ r: simulate(Object.assign({}, o, { cap: next })), k: 'batt', v: { batt: t(BATT[String(next)].name), kwh: next } });
      if (o.kwp < 15) opts.push({ r: simulate(Object.assign({}, o, { kwp: Math.min(15, o.kwp + 4) })), k: 'solar', v: { kw: Math.min(15, o.kwp + 4) - o.kwp } });
      var best = null;
      opts.forEach(function (x) { var v = x.r.firstOut === null ? 999 : x.r.firstOut; if (!best || v > best.v) best = { v: v, k: x.k, vars: x.v }; });
      if (!best || best.v <= r.firstOut + 1) return '';
      var full = best.v === 999, vars = Object.assign({ h: full ? '' : hoursLabel(best.v) }, best.vars);
      var T = {
        off: full ? t('Switch off the {load} and you make it through all 3 days.', vars) : t('Switch off the {load} and it lasts {h}.', vars),
        batt: full ? t('Step up to {batt} ({kwh} kWh) and you make it through all 3 days.', vars) : t('Step up to {batt} ({kwh} kWh) and it lasts {h}.', vars),
        solar: full ? t('Add {kw} kW of solar and you make it through all 3 days.', vars) : t('Add {kw} kW of solar and it lasts {h}.', vars)
      };
      return T[best.k];
    }
    function update() {
      var o = read(); var r = simulate(o); state = { o: o, r: r };
      stats.load.textContent = f1(r.dayLoad) + ' kWh';
      stats.sun.textContent = f1(r.daySun) + ' kWh';
      stats.peak.textContent = f1(r.peak) + ' kW';
      stats.batt.textContent = o.cap + ' kWh';
      $('#pl-solar-out', form).textContent = o.kwp + ' kW';
      if (!o.keys.length) {
        verdict.textContent = t('Pick what you need to keep running.'); sub.textContent = ''; tip.textContent = '';
      } else if (r.firstOut === null) {
        verdict.textContent = t('Stays on through the full 3-day outage.');
        sub.textContent = r.daySun >= r.dayLoad ? t('On days like this, solar makes more than you use, so it can keep going indefinitely.') : t('Solar covers {pct}% of what you use each day, so the battery slowly drains over a longer outage.', { pct: Math.round(r.daySun / r.dayLoad * 100) });
        tip.textContent = '';
      } else {
        verdict.textContent = t('Lasts {h}, then the lights go out.', { h: hoursLabel(r.firstOut) });
        sub.textContent = t('Outage starts at 6 pm with a full battery. Your selection uses {use} kWh a day; solar makes {sun} kWh.', { use: f1(r.dayLoad), sun: f1(r.daySun) });
        tip.textContent = suggest(o, r);
      }
      var warn = $('.pl-warn', root);
      if (r.peak > o.inv) { warn.hidden = false; warn.textContent = t('Everything starting at once would draw {peak} kW, more than this battery\u2019s {inv} kW. Smart load management starts big loads one at a time, so they never collide.', { peak: f1(r.peak), inv: o.inv }); }
      else warn.hidden = true;
      drawChart();
      setT(tIdx);
    }
    function drawChart() {
      var S = state.r.series, W = 720, top = 16, h1 = 110, gap = 34, h2 = 86, left = 38, right = 12, bottom = 26;
      var Ht = top + h1 + gap + h2 + bottom, iw = W - left - right;
      chart.innerHTML = '';
      chart.setAttribute('viewBox', '0 0 ' + W + ' ' + Ht);
      var x = function (t) { return left + t / H * iw; };
      var maxKw = 1;
      S.forEach(function (p) { maxKw = Math.max(maxKw, p.load, p.sun); });
      maxKw = Math.ceil(maxKw);
      // night bands (sun below horizon, summer/winter aware)
      var o = state.o;
      for (var d = 0; d < 4; d++) {
        var rise = o.season === 'winter' ? 7.5 : 6, set = o.season === 'winter' ? 16.5 : 20;
        var a = d * 24 + set - 18, b = d * 24 + 24 + rise - 18;
        a = clamp(a, 0, H); b = clamp(b, 0, H);
        if (b > a) sv('rect', { x: x(a), y: top, width: x(b) - x(a), height: h1 + gap + h2, class: 'ch-night' }, chart);
      }
      // battery panel
      var y1 = function (pct) { return top + h1 - pct * h1; };
      [0, 0.5, 1].forEach(function (g) {
        sv('line', { x1: left, x2: W - right, y1: y1(g), y2: y1(g), class: 'ch-grid' }, chart);
        txt('text', { x: left - 8, y: y1(g) + 4, class: 'ch-tick', 'text-anchor': 'end' }, Math.round(g * 100) + '%', chart);
      });
      var dA = 'M' + x(0) + ' ' + y1(0), dL = '';
      S.forEach(function (p, i) { dA += ' L' + x(p.t).toFixed(1) + ' ' + y1(p.pct).toFixed(1); dL += (i ? ' L' : 'M') + x(p.t).toFixed(1) + ' ' + y1(p.pct).toFixed(1); });
      dA += ' L' + x(H) + ' ' + y1(0) + ' Z';
      sv('path', { d: dA, class: 'ch-batt-area' }, chart);
      sv('path', { d: dL, class: 'ch-batt-line' }, chart);
      // dark periods
      var run = null;
      S.forEach(function (p, i) {
        if (p.dark && run === null) run = p.t;
        if ((!p.dark || i === S.length - 1) && run !== null) { sv('rect', { x: x(run), y: top, width: Math.max(2, x(p.t) - x(run)), height: h1, class: 'ch-out' }, chart); run = null; }
      });
      txt('text', { x: left, y: top - 4, class: 'ch-label' }, t('Battery'), chart);
      // power panel
      var top2 = top + h1 + gap;
      var y2 = function (kw) { return top2 + h2 - kw / maxKw * h2; };
      [0, maxKw].forEach(function (g) {
        sv('line', { x1: left, x2: W - right, y1: y2(g), y2: y2(g), class: 'ch-grid' }, chart);
        txt('text', { x: left - 8, y: y2(g) + 4, class: 'ch-tick', 'text-anchor': 'end' }, g + ' kW', chart);
      });
      var sA = 'M' + x(0) + ' ' + y2(0), lL = '';
      S.forEach(function (p, i) { sA += ' L' + x(p.t).toFixed(1) + ' ' + y2(p.sun).toFixed(1); lL += (i ? ' L' : 'M') + x(p.t).toFixed(1) + ' ' + y2(p.load).toFixed(1); });
      sA += ' L' + x(H) + ' ' + y2(0) + ' Z';
      sv('path', { d: sA, class: 'ch-sun-area' }, chart);
      sv('path', { d: lL, class: 'ch-load-line' }, chart);
      txt('text', { x: left, y: top2 - 6, class: 'ch-label ch-label-solar' }, t('Solar made'), chart);
      txt('text', { x: W - right, y: top2 - 6, class: 'ch-label ch-label-load', 'text-anchor': 'end' }, t('Home used'), chart);
      // time axis
      for (var hh = 0; hh <= H; hh += 6) {
        var clock = (18 + hh) % 24, lab = clock === 0 ? '12am' : clock === 12 ? '12pm' : clock > 12 ? (clock - 12) + 'pm' : clock + 'am';
        if (hh % 12 === 0) txt('text', { x: x(hh), y: Ht - 6, class: 'ch-tick', 'text-anchor': hh === 0 ? 'start' : hh === H ? 'end' : 'middle' }, lab, chart);
      }
      // scrub cursor
      sv('line', { x1: 0, x2: 0, y1: top, y2: top2 + h2, class: 'ch-cursor', id: 'pl-cursor' }, chart);
      sv('circle', { cx: 0, cy: 0, r: 5, class: 'ch-cursor-dot', id: 'pl-dot' }, chart);
      chart._x = x; chart._y1 = y1;
    }
    function setT(i) {
      var S = state.r.series; i = clamp(Math.round(i), 0, S.length - 1); tIdx = i;
      var p = S[i];
      scrub.value = i;
      var cx = chart._x(p.t);
      var c = $('#pl-cursor', chart), d = $('#pl-dot', chart);
      if (c) { c.setAttribute('x1', cx); c.setAttribute('x2', cx); d.setAttribute('cx', cx); d.setAttribute('cy', chart._y1(p.pct)); }
      var hr = Math.floor(p.clock % 24), mn = Math.round((p.clock % 1) * 60);
      var ap = hr >= 12 ? 'pm' : 'am', h12 = hr % 12 === 0 ? 12 : hr % 12;
      clockEl.innerHTML = '<b>' + t('Day {d} \u00b7 {time}', { d: Math.floor((p.t + 18) / 24) + 1, time: h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap }) + '</b><span>' + t('Battery {b}% \u00b7 Solar {s} kW \u00b7 Home {h} kW', { b: Math.round(p.pct * 100), s: f1(p.sun), h: f1(p.load) }) + '</span>';
      root.classList.toggle('is-dark', p.dark);
      if (scene) scene.set(p, state.o);
      listeners.forEach(function (f) { f(); });
    }
    function loop() {
      if (!playing) return;
      var S = state.r.series;
      tIdx += speed;
      if (tIdx >= S.length - 1) tIdx = 0;
      setT(tIdx);
      raf = requestAnimationFrame(loop);
    }
    function setPlay(on) {
      playing = on; play.setAttribute('aria-pressed', String(on));
      play.setAttribute('aria-label', on ? t('Pause the outage replay') : t('Play the outage replay'));
      $('path', play).setAttribute('d', on ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
      cancelAnimationFrame(raf); if (on) loop();
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    scrub.addEventListener('input', function () { setPlay(false); setT(Number(scrub.value)); });
    play.addEventListener('click', function () { setPlay(!playing); });
    scrub.max = H / 0.25;
    update();
    setT(Math.round(14 / 0.25)); // 8 am next morning: a telling first frame
    document.addEventListener('ova:lang', function () { update(); setPlay(playing); });

    // 3D view of the house: opened on demand in an app window, shut down when it closes
    var stage = $('.pl-scene', root), appOpen = false;
    root._planner = {
      open3d: function (done) {
        appOpen = true;
        loadThree(function (ok) {
          if (!ok || !window.THREE) { stage.classList.add('no3d'); return done(false); }
          try { scene = house3d(stage); scene.set(state.r.series[Math.round(tIdx)], state.o); done(true); }
          catch (e) { stage.classList.add('no3d'); done(false); }
        });
      },
      close3d: function () { appOpen = false; if (scene) { scene.dispose(); scene = null; } },
      setPlay: function (on) { setPlay(on); }, playing: function () { return playing; },
      verdict: function () { return verdict.textContent; }, tip: function () { return tip.textContent; }, sub: function () { return sub.textContent; },
      state: function () { return state; }, idx: function () { return Math.round(tIdx); },
      seek: function (i) { setT(i); }, setSpeed: function (v) { speed = v; }, speed: function () { return speed; },
      on: function (f) { listeners.push(f); }, form: form
    };
    // stop the replay when the planner is off screen, unless its 3D window is open
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (!es[0].isIntersecting && !appOpen && playing) setPlay(false); }).observe(root);
    // autoplay once when first seen, unless motion is reduced
    if (!calm && 'IntersectionObserver' in window) {
      var io2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io2.disconnect(); setTimeout(function () { setPlay(true); }, 900); } }, { threshold: 0.5 });
      io2.observe(chart);
    }
  }

  var threeState = null, threeQ = [];
  window.OvaLoadThree = function (cb) { loadThree(cb); };
  function loadThree(cb) {
    if (window.THREE) return cb(true);
    threeQ.push(cb);
    if (threeState) return;
    threeState = 'loading';
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = function () { threeQ.splice(0).forEach(function (f) { f(true); }); };
    s.onerror = function () { threeQ.splice(0).forEach(function (f) { f(false); }); };
    document.head.appendChild(s);
  }

  /* 3D house: panels, battery, windows and energy flow follow the simulation */
  function house3d(stage) {
    var T = window.THREE;
    var canvasWrap = $('.pl-canvas', stage);
    var coarse = matchMedia('(pointer: coarse)').matches;
    var renderer = new T.WebGLRenderer({ antialias: !coarse, alpha: true });
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    canvasWrap.appendChild(renderer.domElement);
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(28, 1, 0.1, 200);
    var target = new T.Vector3(-0.6, 1.8, 0.4), angle = 0.62, elev = 0.4, dist = 31;

    var css = function (n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); };
    var light = function () { if (stage.closest('.mc')) return false; var th = document.documentElement.getAttribute('data-theme'); return th ? th === 'light' : matchMedia('(prefers-color-scheme: light)').matches; };

    var hemi = new T.HemisphereLight(0xdfefff, 0x1a2430, 0.55); scene.add(new T.AmbientLight(0xffffff, 0.22)); scene.add(hemi);
    var sun = new T.DirectionalLight(0xfff1d6, 1.0); sun.position.set(10, 14, 6); scene.add(sun);
    var M = function (c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.05 }, o || {})); };

    var ground = new T.Mesh(new T.CircleGeometry(60, 96), M(0x0f171f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var drive = new T.Mesh(new T.PlaneGeometry(3.4, 7), M(0x26313b)); drive.rotation.x = -Math.PI / 2; drive.position.set(5.6, 0.01, 3.2); scene.add(drive);
    // house body
    var wallMat = M(0xd9dee3);
    var body = new T.Mesh(new T.BoxGeometry(7, 3, 5), wallMat); body.position.y = 1.5; scene.add(body);
    // gable roof: two slabs
    var pitch = 0.52, half = 2.5 / Math.cos(pitch) + 0.35;
    var roofMat = M(0x3a434c, { roughness: 0.9 });
    var slabF = new T.Mesh(new T.BoxGeometry(7.6, 0.18, half), roofMat);
    slabF.position.set(0, 3 + Math.tan(pitch) * 1.25, 1.25); slabF.rotation.x = pitch; scene.add(slabF);
    var slabB = slabF.clone(); slabB.position.z = -1.25; slabB.rotation.x = -pitch; scene.add(slabB);
    var gableGeo = new T.BufferGeometry();
    var gh = Math.tan(pitch) * 2.5;
    gableGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 2.5, 0, 0, -2.5, 0, gh, 0], 3));
    gableGeo.computeVertexNormals();
    [-3.5, 3.5].forEach(function (xp) { var g = new T.Mesh(gableGeo, new T.MeshStandardMaterial({ color: 0xd9dee3, side: T.DoubleSide, roughness: 0.8 })); g.position.set(xp, 3, 0); scene.add(g); });
    // windows glow with the home's power
    var winMat = new T.MeshStandardMaterial({ color: 0x18222c, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 });
    var wins = [];
    [[-2.3, 1.7], [-0.8, 1.7], [0.8, 1.7], [2.3, 1.7]].forEach(function (p) {
      var w = new T.Mesh(new T.PlaneGeometry(0.9, 1.1), winMat); w.position.set(p[0], p[1], 2.51); scene.add(w); wins.push(w);
    });
    var door = new T.Mesh(new T.PlaneGeometry(0.9, 1.9), M(0x2b3640)); door.position.set(0, 0.95, 2.505); door.visible = false; scene.add(door);
    var sideWin = new T.Mesh(new T.PlaneGeometry(1.2, 1.0), winMat); sideWin.rotation.y = Math.PI / 2; sideWin.position.set(3.51, 1.8, -0.8); scene.add(sideWin);
    // solar array on the front slope
    var panelMat = new T.MeshStandardMaterial({ color: 0x0c1d33, metalness: 0.4, roughness: 0.25, emissive: 0x2eadf7, emissiveIntensity: 0 });
    var panels = new T.Group(); scene.add(panels);
    var slots = [];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 8; c++) slots.push([-3.05 + c * 0.87, r]);
    function setPanels(kwp) {
      while (panels.children.length) panels.remove(panels.children[0]);
      var n = Math.min(slots.length, Math.round(kwp / 0.4 * 0.62));
      if (kwp > 0 && n < 2) n = 2;
      for (var i = 0; i < n; i++) {
        var s = slots[i];
        var p = new T.Mesh(new T.BoxGeometry(0.8, 0.06, 0.82), panelMat);
        var along = 0.55 + s[1] * 0.9;
        p.position.set(s[0], 3 + Math.tan(pitch) * 2.5 - Math.sin(pitch) * along + 0.13, Math.cos(pitch) * along);
        p.rotation.x = pitch; panels.add(p);
      }
    }
    // battery on the side wall with a live level
    var cab = new T.Mesh(new T.BoxGeometry(0.55, 1.7, 1.1), M(0xe7ebef, { roughness: 0.4 })); cab.position.set(3.8, 0.85, 1.3); scene.add(cab);
    var gaugeBg = new T.Mesh(new T.PlaneGeometry(0.16, 1.2), new T.MeshBasicMaterial({ color: 0x1b2631 })); gaugeBg.rotation.y = Math.PI / 2; gaugeBg.position.set(4.081, 0.9, 1.3); scene.add(gaugeBg);
    var gaugeMat = new T.MeshBasicMaterial({ color: 0x2eadf7 });
    var gauge = new T.Mesh(new T.PlaneGeometry(0.16, 1.2), gaugeMat); gauge.rotation.y = Math.PI / 2; gauge.position.set(4.083, 0.9, 1.3); scene.add(gauge);
    // EV
    var car = new T.Group();
    var carBody = new T.Mesh(new T.BoxGeometry(1.7, 0.55, 3.6), M(0xb9c3cc, { metalness: 0.5, roughness: 0.35 })); carBody.position.y = 0.55; car.add(carBody);
    var cabin = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 1.9), M(0x1d2731, { metalness: 0.3, roughness: 0.2 })); cabin.position.set(0, 1.05, -0.15); car.add(cabin);
    [[-0.8, 1.1], [0.8, 1.1], [-0.8, -1.2], [0.8, -1.2]].forEach(function (w) {
      var wh = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.25, 20), M(0x111111)); wh.rotation.z = Math.PI / 2; wh.position.set(w[0], 0.33, w[1]); car.add(wh);
    });
    car.position.set(5.6, 0, 3.6); scene.add(car);
    // the street: neighbors without backup sit dark through the outage
    var nWall = M(0x9aa5af), nRoof = M(0x2a333c, { roughness: 0.9 }), nWin = new T.MeshStandardMaterial({ color: 0x0d141b, roughness: 0.4 });
    function neighbor(x, z, ry, sc) {
      var g = new T.Group();
      var b = new T.Mesh(new T.BoxGeometry(6, 2.8, 4.6), nWall); b.position.y = 1.4; g.add(b);
      var rf = new T.Mesh(new T.ConeGeometry(4.4, 1.9, 4, 1), nRoof); rf.position.y = 3.75; rf.rotation.y = Math.PI / 4; rf.scale.set(1.05, 1, 0.8); g.add(rf);
      [-1.8, 0, 1.8].forEach(function (wx) { var w = new T.Mesh(new T.PlaneGeometry(0.8, 1), nWin); w.position.set(wx, 1.6, 2.31); g.add(w); });
      g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(sc); scene.add(g);
    }
    neighbor(-13.5, -4.5, 0.25, 0.95); neighbor(12.5, -9, -0.35, 0.9); neighbor(-3, -15, 0.05, 0.85);
    // utility pole with dead lines into the house
    var poleMat = M(0x5b4a3b, { roughness: 1 });
    var pole = new T.Mesh(new T.CylinderGeometry(0.13, 0.17, 7, 10), poleMat); pole.position.set(-7.5, 3.5, 5.5); scene.add(pole);
    var arm = new T.Mesh(new T.BoxGeometry(2.2, 0.14, 0.14), poleMat); arm.position.set(-7.5, 6.6, 5.5); scene.add(arm);
    var xfmr = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.8, 14), M(0x7c8791, { metalness: 0.4, roughness: 0.5 })); xfmr.position.set(-7.2, 5.6, 5.5); scene.add(xfmr);
    var fault = new T.Mesh(new T.SphereGeometry(0.13, 12, 12), new T.MeshBasicMaterial({ color: 0xef4f43 })); fault.position.set(-7.2, 6.15, 5.85); scene.add(fault);
    var wireMat = new T.LineBasicMaterial({ color: 0x5d6a76 });
    function wire(a, b, sag) {
      var mid = a.clone().lerp(b, 0.5); mid.y -= sag;
      var g = new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(a, mid, b).getPoints(24));
      scene.add(new T.Line(g, wireMat));
    }
    wire(new T.Vector3(-8.5, 6.7, 5.5), new T.Vector3(-24, 6.4, 6), 0.8);
    wire(new T.Vector3(-6.5, 6.7, 5.5), new T.Vector3(-24, 6.4, 7.5), 0.8);
    wire(new T.Vector3(-7.2, 6.0, 5.5), new T.Vector3(-3.5, 2.7, 1.8), 0.6);
    // live labels pinned to the scene
    var tagLayer = document.createElement('div'); tagLayer.className = 'hx-tags'; stage.appendChild(tagLayer);
    function mkTag(k, pos) { var e = document.createElement('span'); e.className = 'hx-tag'; e.setAttribute('data-k', k); e.innerHTML = '<i></i><b></b><em></em>'; tagLayer.appendChild(e); return { el: e, pos: pos }; }
    var tags = {
      solar: mkTag('solar', new T.Vector3(-0.4, 5.2, 0.6)), batt: mkTag('batt', new T.Vector3(3.8, 2.15, 1.3)), home: mkTag('home', new T.Vector3(-2.2, 3.4, 2.6)),
      grid: mkTag('grid', new T.Vector3(-7.5, 7.4, 5.5)), ev: mkTag('ev', new T.Vector3(5.6, 1.9, 3.6)), street: mkTag('street', new T.Vector3(-13.5, 4.9, -4.5))
    };
    function tagSet(k, label, val, cls) { var g = tags[k]; g.w = 0; g.el.children[1].textContent = label; g.el.children[2].textContent = val; g.el.className = 'hx-tag' + (cls ? ' ' + cls : ''); }
    var pv = new T.Vector3();
    function placeTags() {
      var w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
      Object.keys(tags).forEach(function (k) {
        var g = tags[k]; if (g.el.hidden) return;
        pv.copy(g.pos).project(cam);
        var off = pv.z > 1 || pv.x < -1.1 || pv.x > 1.1 || pv.y < -1.1 || pv.y > 1.1;
        g.el.style.opacity = off ? 0 : '';
        var hw = (g.w || (g.w = g.el.offsetWidth)) / 2 + 6, px = Math.max(hw, Math.min(w - hw, (pv.x + 1) / 2 * w)), py = Math.max(40, (1 - pv.y) / 2 * h);
        g.el.style.transform = 'translate(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px)';
      });
    }
    // energy particles along three paths
    var flows = {
      solarHome: new T.QuadraticBezierCurve3(new T.Vector3(0, 4.2, 1.2), new T.Vector3(1, 5.5, 2.6), new T.Vector3(0, 1.8, 2.6)),
      solarBatt: new T.QuadraticBezierCurve3(new T.Vector3(2.2, 3.9, 1.6), new T.Vector3(4.6, 4.6, 2.4), new T.Vector3(3.9, 1.8, 1.3)),
      battHome: new T.QuadraticBezierCurve3(new T.Vector3(3.8, 1.2, 1.9), new T.Vector3(3.6, 0.6, 3.6), new T.Vector3(1.5, 1.2, 2.6))
    };
    var dotGeo = new T.SphereGeometry(0.075, 10, 10);
    var solarDot = new T.MeshBasicMaterial({ color: 0xf4c64e }), battDot = new T.MeshBasicMaterial({ color: 0x2eadf7 });
    var parts = [];
    Object.keys(flows).forEach(function (k) {
      for (var i = 0; i < 14; i++) {
        var m = new T.Mesh(dotGeo, k === 'battHome' ? battDot : solarDot);
        m.userData = { k: k, o: i / 14 }; scene.add(m); parts.push(m);
      }
    });
    var flowRate = { solarHome: 0, solarBatt: 0, battHome: 0 };

    var now = null, kwpShown = -1, clock = 0, last = performance.now(), visible = true, drag = null;
    function size() {
      var w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    }
    function themeColors() {
      var lt = light();
      ground.material.color.set(lt ? 0xdfe6ec : 0x0f171f);
      drive.material.color.set(lt ? 0xc9d2da : 0x1f2a34);
      hemi.groundColor.set(lt ? 0xb8c4cf : 0x1a2430);
    }
    themeColors();
    var themeMo = new MutationObserver(themeColors); themeMo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function set(p, o) {
      now = p;
      if (o.kwp !== kwpShown) { setPanels(o.kwp); kwpShown = o.kwp; }
      car.visible = o.keys.indexOf('ev') > -1;
      var h = p.clock % 24;
      var rise = o.season === 'winter' ? 7.5 : 6, setT = o.season === 'winter' ? 16.5 : 20;
      var dayK = (h > rise && h < setT) ? Math.sin(Math.PI * (h - rise) / (setT - rise)) : 0;
      var az = Math.PI * ((h - rise) / (setT - rise)) - Math.PI / 2;
      sun.position.set(Math.sin(az) * 16, 3 + dayK * 16, 8);
      sun.intensity = 0.15 + dayK * 1.1 * (o.sky === 'overcast' ? 0.45 : 1);
      hemi.intensity = 0.4 + dayK * 0.5;
      stage.style.setProperty('--day', dayK.toFixed(3));
      var lit = p.dark ? 0 : clamp(p.load / 1.2, 0.25, 1) * (1 - dayK * 0.75);
      winMat.emissiveIntensity = lit * 1.4;
      panelMat.emissiveIntensity = p.sun > 0 ? clamp(p.sun / 6, 0.05, 0.6) : 0;
      gauge.scale.y = Math.max(0.001, p.pct); gauge.position.y = 0.3 + 1.2 * p.pct / 2;
      gaugeMat.color.set(p.pct < 0.15 ? 0xef7f73 : 0x2eadf7);
      var direct = Math.min(p.sun, p.load);
      flowRate.solarHome = p.dark ? 0 : direct;
      flowRate.solarBatt = Math.max(0, p.sun - p.load) * (p.pct < 0.999 ? 1 : 0);
      flowRate.battHome = p.dark ? 0 : Math.max(0, p.load - p.sun);
      var kwS = function (v) { return v < 1 ? Math.round(v * 1000) + ' W' : f1(v) + ' kW'; };
      tags.solar.el.hidden = o.kwp <= 0;
      tagSet('solar', t('Solar'), p.sun > 0.05 ? kwS(p.sun) : t('night'), p.sun > 0.05 ? 'sun' : 'idle');
      var chg = p.sun > p.load && p.pct < 0.999 ? ' \u2191' : p.load > p.sun && !p.dark ? ' \u2193' : '';
      tagSet('batt', t('Battery'), Math.round(p.pct * 100) + '%' + chg, p.pct < 0.15 ? 'bad' : 'on');
      tagSet('home', t('Home'), p.dark ? t('power out') : kwS(p.load), p.dark ? 'bad' : 'on');
      tagSet('grid', t('Grid'), t('down'), 'bad');
      tagSet('street', t('Neighbors'), t('no power'), 'idle');
      var evOn = o.keys.indexOf('ev') > -1, evKw = evOn ? LOADS.ev.avg * SHAPES.night[Math.floor(h)] : 0;
      tags.ev.el.hidden = !evOn;
      tagSet('ev', t('EV'), p.dark ? t('waiting') : evKw > 0 ? t('charging') + ' ' + kwS(evKw) : t('parked'), evKw > 0 && !p.dark ? 'on' : 'idle');
      if (calm || !visible) render(0);
    }
    function render(dt) {
      clock += dt;
      parts.forEach(function (m) {
        var rate = flowRate[m.userData.k];
        m.visible = rate > 0.02;
        if (!m.visible) return;
        var u = (m.userData.o + clock * (0.12 + Math.min(rate, 6) * 0.06)) % 1;
        m.position.copy(flows[m.userData.k].getPoint(u));
        var sc = 0.6 + Math.min(rate, 4) * 0.18; m.scale.set(sc, sc, sc);
      });
      if (!drag && !calm) angle += dt * 0.025;
      fault.material.color.setHex(Math.floor(clock * 2) % 2 ? 0x5a1d1a : 0xef4f43);
      cam.position.set(target.x + Math.sin(angle) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(angle) * dist * Math.cos(elev));
      cam.lookAt(target);
      renderer.render(scene, cam);
      placeTags();
    }
    var dead = false, raf = 0;
    function tick(t) {
      if (dead) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (visible) render(calm ? 0 : dt);
      raf = requestAnimationFrame(tick);
    }
    // drag to orbit
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, a: angle, e: elev }; el.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
    el.addEventListener('pointermove', function (e) { if (!drag) return; angle = drag.a - (e.clientX - drag.x) * 0.008; elev = clamp(drag.e + (e.clientY - drag.y) * 0.004, 0.12, 0.95); if (calm || !visible) render(0); });
    var end = function () { drag = null; stage.classList.remove('dragging'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    var vio = null, vro = null;
    if ('IntersectionObserver' in window) { vio = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }); vio.observe(stage); } else visible = true;
    window.addEventListener('resize', size);
    if ('ResizeObserver' in window) { vro = new ResizeObserver(size); vro.observe(canvasWrap); }
    size();
    stage.classList.add('has3d');
    raf = requestAnimationFrame(tick);
    function dispose() {
      dead = true; cancelAnimationFrame(raf);
      if (vio) vio.disconnect(); if (vro) vro.disconnect(); themeMo.disconnect();
      window.removeEventListener('resize', size);
      scene.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(function (m) { m.dispose(); }); });
      renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      stage.classList.remove('has3d');
      if (tagLayer.parentNode) tagLayer.parentNode.removeChild(tagLayer);
    }
    return { set: set, dispose: dispose };
  }

  /* ---------- Commercial: what outages cost ---------- */
  function exposure(root) {
    var ids = ['ex-hour', 'ex-events', 'ex-len', 'ex-restart', 'ex-spoil', 'ex-rate', 'ex-shave'];
    var inp = {}; ids.forEach(function (i) { inp[i] = $('#' + i, root); });
    var bar = $('.ex-bar', root), legend = $('.ex-legend', root);
    function update() {
      var v = {}; ids.forEach(function (i) { v[i] = Number(inp[i].value); var o = $('[for="' + i + '"].val', root); if (o) o.textContent = o.dataset.fmt === 'usd' ? usd(v[i]) : v[i] + (o.dataset.unit || ''); });
      var parts = [
        { k: t('Lost operating hours'), v: v['ex-events'] * v['ex-len'] * v['ex-hour'], c: 'seg-a' },
        { k: t('Restart and recovery'), v: v['ex-events'] * v['ex-restart'] * v['ex-hour'], c: 'seg-b' },
        { k: t('Spoilage and damage'), v: v['ex-events'] * v['ex-spoil'], c: 'seg-c' },
        { k: t('Avoidable demand charges'), v: v['ex-shave'] * v['ex-rate'] * 12, c: 'seg-d' }
      ];
      var total = parts.reduce(function (s, p) { return s + p.v; }, 0);
      $('.ex-total', root).textContent = usd(total);
      $('.ex-per', root).textContent = v['ex-events'] ? usd((parts[0].v + parts[1].v + parts[2].v) / v['ex-events']) : '$0';
      $('.ex-20', root).textContent = usd(total * 20);
      bar.innerHTML = ''; legend.innerHTML = '';
      parts.forEach(function (p) {
        var w = total ? p.v / total * 100 : 0;
        var s = document.createElement('span'); s.className = 'seg ' + p.c; s.style.width = w + '%'; bar.appendChild(s);
        var li = document.createElement('li'); li.innerHTML = '<i class="sw ' + p.c + '"></i><span>' + p.k + '</span><b>' + usd(p.v) + '</b><em>' + Math.round(w) + '%</em>'; legend.appendChild(li);
      });
      ids.forEach(function (i) { var el = inp[i]; if (el.type === 'range') el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); });
    }
    root.addEventListener('input', update); update();
    document.addEventListener('ova:lang', update);
  }

  /* ---------- Power Towns: peak shaving on a feeder ---------- */
  var FEEDER = [0.55, 0.51, 0.48, 0.47, 0.47, 0.5, 0.56, 0.63, 0.68, 0.73, 0.78, 0.83, 0.88, 0.93, 0.97, 0.99, 1, 0.98, 0.94, 0.88, 0.8, 0.72, 0.65, 0.6];
  function peakShave(root) {
    var chart = $('.ps-chart', root);
    function shave(L, P, E) {
      var lo = Math.min.apply(null, L), hi = Math.max.apply(null, L);
      for (var it = 0; it < 50; it++) {
        var T = (lo + hi) / 2, ok = true, need = 0;
        L.forEach(function (l) { var x = l - T; if (x > P + 1e-9) ok = false; if (x > 0) need += x; });
        if (ok && need <= E) hi = T; else lo = T;
      }
      return hi;
    }
    function update() {
      var peak = Number($('#ps-peak', root).value), pct = Number($('#ps-pow', root).value) / 100, dur = Number($('input[name="ps-dur"]:checked', root).value), rate = Number($('#ps-rate', root).value);
      $('[for="ps-peak"].val', root).textContent = peak + ' MW';
      $('[for="ps-pow"].val', root).textContent = f1(peak * pct) + ' MW';
      $('[for="ps-rate"].val', root).textContent = '$' + rate + '/kW-mo';
      ['ps-peak', 'ps-pow', 'ps-rate'].forEach(function (i) { var el = $('#' + i, root); el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); });
      var L = FEEDER.map(function (f) { return f * peak; }), P = peak * pct, E = P * dur;
      var T = P > 0 ? shave(L, P, E) : peak;
      var after = L.map(function (l) { return Math.min(l, T); });
      // recharge in the lowest hours without creating a new peak (90% round trip)
      var needE = L.reduce(function (s, l) { return s + Math.max(0, l - T); }, 0) / 0.9;
      var order = L.map(function (l, i) { return i; }).sort(function (a, b) { return L[a] - L[b]; });
      var charge = L.map(function () { return 0; });
      order.forEach(function (i) { if (needE <= 0) return; var room = Math.min(P, T - L[i]); if (room <= 0) return; var c = Math.min(room, needE); charge[i] = c; needE -= c; });
      var net = L.map(function (l, i) { return Math.min(l, T) + charge[i]; });
      var newPeak = Math.max.apply(null, net);
      var cut = peak - newPeak;
      $('.ps-before', root).textContent = f1(peak) + ' MW';
      $('.ps-after', root).textContent = f1(newPeak) + ' MW';
      $('.ps-cut', root).textContent = '−' + f1(cut) + ' MW (' + Math.round(cut / peak * 100) + '%)';
      $('.ps-save', root).textContent = usd(cut * 1000 * rate * 12);
      window.OvaPeakLast = { L: L, T: T, charge: charge, newPeak: newPeak, peak: peak, capLabel: t('New peak {mw} MW', { mw: f1(newPeak) }), peakLabel: t('Peak today {mw} MW', { mw: f1(peak) }) };
      if (window.OvaPeakScene) window.OvaPeakScene.apply(window.OvaPeakLast);
      $('.ps-batt', root).textContent = f1(P) + ' MW / ' + f1(E) + ' MWh';
      // chart
      var W = 720, Ht = 300, left = 46, right = 14, top = 18, bottom = 30, iw = W - left - right, ih = Ht - top - bottom;
      var x = function (h) { return left + h / 23 * iw; }, y = function (mw) { return top + ih - mw / (peak * 1.08) * ih; };
      chart.innerHTML = ''; chart.setAttribute('viewBox', '0 0 ' + W + ' ' + Ht);
      [0, 0.5, 1].forEach(function (g) {
        sv('line', { x1: left, x2: W - right, y1: y(g * peak), y2: y(g * peak), class: 'ch-grid' }, chart);
        txt('text', { x: left - 8, y: y(g * peak) + 4, class: 'ch-tick', 'text-anchor': 'end' }, f1(g * peak) + ' MW', chart);
      });
      var area = function (top, bot) {
        var d = 'M' + x(0) + ' ' + y(top[0]);
        for (var i = 1; i < 24; i++) d += ' L' + x(i) + ' ' + y(top[i]);
        for (var j = 23; j >= 0; j--) d += ' L' + x(j) + ' ' + y(bot[j]);
        return d + ' Z';
      };
      sv('path', { d: area(L, after), class: 'ch-shaved' }, chart);
      sv('path', { d: area(net, after), class: 'ch-charge' }, chart);
      var line = function (arr) { return arr.map(function (v, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(v); }).join(' '); };
      sv('path', { d: line(L), class: 'ch-before' }, chart);
      sv('path', { d: line(net), class: 'ch-after' }, chart);
      sv('line', { x1: left, x2: W - right, y1: y(newPeak), y2: y(newPeak), class: 'ch-cap' }, chart);
      txt('text', { x: W - right, y: y(newPeak) - 8, class: 'ch-tick ch-cap-label', 'text-anchor': 'end' }, t('New peak {mw} MW', { mw: f1(newPeak) }), chart);
      [0, 6, 12, 18, 23].forEach(function (h) {
        var lab = h === 0 ? '12am' : h === 12 ? '12pm' : h === 23 ? '11pm' : h > 12 ? (h - 12) + 'pm' : h + 'am';
        txt('text', { x: x(h), y: Ht - 8, class: 'ch-tick', 'text-anchor': h === 0 ? 'start' : h === 23 ? 'end' : 'middle' }, lab, chart);
      });
    }
    root.addEventListener('input', update); root.addEventListener('change', update); update();
    document.addEventListener('ova:lang', update);
  }

  /* ---------- Power Towns: reliability indices ---------- */
  function reliability(root) {
    function update() {
      var N = Number($('#ri-n', root).value), CI = Number($('#ri-ci', root).value), CMI = Number($('#ri-cmi', root).value), cov = Number($('#ri-cov', root).value) / 100;
      $('[for="ri-cov"].val', root).textContent = Math.round(cov * 100) + '%';
      var el = $('#ri-cov', root); el.style.setProperty('--fill', (cov / 0.6 * 100) + '%');
      var ok = N > 0 && CI > 0;
      var saifi = ok ? CI / N : 0, saidi = ok ? CMI / N : 0, caidi = ok ? CMI / CI : 0;
      var ci2 = CI * (1 - cov), cmi2 = CMI * (1 - cov);
      $('.ri-saifi', root).textContent = saifi.toFixed(2);
      $('.ri-saidi', root).textContent = Math.round(saidi) + ' min';
      $('.ri-caidi', root).textContent = Math.round(caidi) + ' min';
      $('.ri-saifi2', root).textContent = ok ? (ci2 / N).toFixed(2) : '0';
      $('.ri-saidi2', root).textContent = ok ? Math.round(cmi2 / N) + ' min' : '0 min';
      $('.ri-caidi2', root).textContent = ok && ci2 > 0 ? Math.round(cmi2 / ci2) + ' min' : '0 min';
    }
    root.addEventListener('input', update); update();
  }

  /* ---------- PET: which unit for this job ---------- */
  var FIELD = {
    med: { name: 'Medical tent', avg: 1.5, peak: 2.5 },
    fridge: { name: 'Refrigeration unit', avg: 0.8, peak: 1.6 },
    light: { name: 'Shelter lights and fans', avg: 0.5, peak: 0.8 },
    charge: { name: 'Phone charging station', avg: 0.3, peak: 0.5 },
    kitchen: { name: 'Field kitchen', avg: 2.5, peak: 6 },
    hvac: { name: 'HVAC unit', avg: 2, peak: 4 },
    tools: { name: 'Power tools', avg: 0.8, peak: 3.5 },
    pump: { name: 'Water pump', avg: 0.75, peak: 1.5 },
    comms: { name: 'Command center IT and radios', avg: 1, peak: 1.5 }
  };
  var PETS = [
    { id: 'ember', name: 'Ember', batt: 64, out: 22.8, solar: 3.06, gen: 9 },
    { id: 'flame', name: 'Flame', batt: 64, out: 22.8, solar: 4.59, gen: 26 },
    { id: 'blaze', name: 'Blaze', batt: 114.4, out: 62.4, solar: 0, gen: 0 }
  ];
  function petSizer(root) {
    var SUN_H = 4.5;
    function counts() { var c = {}; $$('[data-field]', root).forEach(function (r) { c[r.dataset.field] = Number($('output', r).textContent); }); return c; }
    function update() {
      var c = counts(), hrs = Number($('#pz-hours', root).value);
      $('[for="pz-hours"].val', root).textContent = t('{n} h/day', { n: hrs });
      var el = $('#pz-hours', root); el.style.setProperty('--fill', ((hrs - 4) / 20 * 100) + '%');
      var avg = 0, peak = 0;
      Object.keys(c).forEach(function (k) { avg += FIELD[k].avg * c[k]; peak += FIELD[k].peak * c[k]; });
      var day = avg * hrs;
      $('.pz-peak', root).textContent = f1(peak) + ' kW';
      $('.pz-day', root).textContent = f1(day) + ' kWh';
      var pick = null;
      PETS.forEach(function (p) {
        var card = $('[data-pet="' + p.id + '"]', root);
        var fits = peak <= p.out && peak > 0;
        if (fits && !pick) pick = p;
        var solarDay = p.solar * SUN_H;
        var runDays = day > 0 ? p.batt / Math.max(0.01, day - solarDay) : Infinity;
        var genH = p.gen ? Math.max(0, day - solarDay) / p.gen : 0;
        card.classList.toggle('fits', fits);
        card.classList.toggle('nofit', peak > p.out);
        $('.pz-fit', card).textContent = peak === 0 ? t('Add loads') : fits ? t('Handles the load') : t('Load too large');
        var runTxt;
        if (day <= 0) runTxt = '—';
        else if (day <= solarDay) runTxt = t('Indefinitely on sun');
        else if (p.gen) runTxt = t('Indefinitely with fuel');
        else runTxt = runDays >= 1 ? t('{n} days', { n: f1(runDays) }) : t('{n} hours', { n: Math.round(runDays * 24) });
        $('.pz-run', card).textContent = runTxt;
        $('.pz-sol', card).textContent = p.solar ? t('{pct}% of daily need', { pct: f1(Math.min(100, solarDay / Math.max(day, 0.01) * 100)) }) : t('Not listed');
        if (p.gen) {
          var gtxt = t('{n} h/day', { n: day ? f1(genH) : 0 });
          $('.pz-genh', card).textContent = gtxt;
          if (p.id === 'flame') $('.pz-genh-vis', root).textContent = gtxt;
          if (p.id === 'flame') $('.pz-genbar-vis', root).style.width = clamp(genH / 24 * 100, 0, 100) + '%';
        }
        var bar = $('.pz-meter i', card); bar.style.width = clamp(peak / p.out * 100, 0, 100) + '%';
        $('.pz-meter', card).classList.toggle('over', peak > p.out);
      });
      $$('[data-pet]', root).forEach(function (cd) { cd.classList.toggle('pick', !!pick && cd.dataset.pet === pick.id); });
      $('.pz-verdict', root).textContent = peak === 0 ? t('Add the loads you need to power.') : pick ? t('Recommended: PET {name}.', { name: pick.name }) : t('This load needs more than one PET. Talk to us about pairing units.');
      $('.pz-convgen', root).textContent = t('{n} h/day', { n: hrs });
      $('.pz-convbar', root).style.width = (hrs / 24 * 100) + '%';
    }
    $$('[data-field]', root).forEach(function (r) {
      var o = $('output', r);
      $$('button', r).forEach(function (b) { b.addEventListener('click', function () { o.textContent = clamp(Number(o.textContent) + Number(b.dataset.d), 0, 9); update(); }); });
    });
    root.addEventListener('input', update); update();
    document.addEventListener('ova:lang', update);
  }

  /* ---------- NERD: what 65 kWh runs ---------- */
  function nerdRun(root) {
    document.addEventListener('ova:lang', function () { nerdRun(root); }, { once: true });
    var cap = 65;
    $$('[data-mix]', root).forEach(function (row) {
      var keys = row.dataset.mix.split(' ');
      var day = 0; for (var h = 0; h < 24; h++) day += loadAt(keys, h);
      var hours = cap / (day / 24);
      $('.nr-h', row).textContent = hours >= 48 ? t('{n} days', { n: f1(hours / 24) }) : t('{n} hours', { n: Math.round(hours) });
      $('.nr-bar i', row).style.setProperty('--w', clamp(hours / 96 * 100, 4, 100) + '%');
      $('.nr-kwh', row).textContent = t('{n} kWh/day', { n: f1(day) });
    });
  }
  function nerdLinks(root) {
    var status = $('.nl-status', root);
    function update() {
      var on = $$('input[type="checkbox"]', root).filter(function (i) { return i.checked; });
      $$('[data-link]', root).forEach(function (l) { l.classList.toggle('cut', !$('#' + l.dataset.link, root).checked); });
      root.classList.toggle('alldown', on.length === 0);
      status.innerHTML = on.length
        ? '<b>' + t('{n} of 4 links up.', { n: on.length }) + '</b> ' + t('Remote monitoring and updates continue over {list}.', { list: on.map(function (i) { return t(i.dataset.name); }).join(', ') })
        : '<b>' + t('All links down.') + '</b> ' + t('The NERD keeps running your property on local control. Your priorities and reserves stay in force.');
    }
    root.addEventListener('change', update); update();
    document.addEventListener('ova:lang', update);
  }

  /* ---------- Boot ---------- */
  $$('[data-tool="planner"]').forEach(planner);
  $$('[data-tool="exposure"]').forEach(exposure);
  $$('[data-tool="peak"]').forEach(peakShave);
  $$('[data-tool="reliability"]').forEach(reliability);
  $$('[data-tool="pet"]').forEach(petSizer);
  $$('[data-tool="nerd-run"]').forEach(nerdRun);
  $$('[data-tool="nerd-links"]').forEach(nerdLinks);
})();

/* Home: "Build your microgrid" sandbox.
   Add or remove parts, move the clock, cut the grid. A 15-minute energy-balance model runs a full day
   and every view (3D scene, live readings, 24-hour chart, verdict) reads from it. */
(function () {
  'use strict';
  var root = document.querySelector('[data-tool="sandbox"]');
  if (!root || !window.OvaModel) return;
  var $ = function (s, r) { return (r || root).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || root).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var M = window.OvaModel;
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a, p) { var e = document.createElementNS(NS, tag); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  // realistic daily totals (kWh) on a standard household load curve; all-electric leans on afternoon AC
  var HOMES = { ess: 12, typ: 28, all: 45 };
  var SHAPE = [0.55, 0.5, 0.48, 0.47, 0.48, 0.55, 0.8, 1.0, 0.95, 0.85, 0.8, 0.82, 0.88, 0.92, 1.0, 1.1, 1.25, 1.5, 1.7, 1.75, 1.6, 1.35, 1.0, 0.75];
  var SHAPE_AC = [0.5, 0.45, 0.42, 0.4, 0.4, 0.45, 0.6, 0.75, 0.85, 0.95, 1.1, 1.25, 1.4, 1.55, 1.7, 1.8, 1.85, 1.8, 1.7, 1.5, 1.25, 1.0, 0.8, 0.6];
  function norm(a) { var m = a.reduce(function (s, x) { return s + x; }, 0) / a.length; return a.map(function (x) { return x / m; }); }
  SHAPE = norm(SHAPE); SHAPE_AC = norm(SHAPE_AC);
  function homeAt(type, h) { var sh = type === 'all' ? SHAPE_AC : SHAPE; return HOMES[type] / 24 * sh[Math.floor(((h % 24) + 24) % 24)]; }
  var BATT_KWH = 13.5, BATT_KW = 5, GEN_KW = 12, DT = 0.25;
  var cfg = { solar: 6, batt: 1, gen: false, ev: true, home: 'typ', outage: false };
  var tod = 13, playing = false, sim = null;

  function clockLabel(h) {
    h = ((h % 24) + 24) % 24;
    var hr = Math.floor(h), mn = Math.round((h - hr) * 60); if (mn === 60) { hr = (hr + 1) % 24; mn = 0; }
    var ap = hr >= 12 ? 'pm' : 'am', h12 = hr % 12 === 0 ? 12 : hr % 12;
    return h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + ap;
  }

  /* One day of energy balance, after a warm-up day so the battery starts realistic */
  function simulate(c) {
    var cap = c.batt * BATT_KWH, pmax = c.batt * BATT_KW, soc = cap * 0.5;
    var pts = [], tot = { load: 0, imp: 0, exp: 0, gen: 0, unmet: 0, dark: 0, genH: 0 };
    for (var i = 0; i < 2 * 96; i++) {
      var h = (i % 96) * DT;
      // in an outage the controller pauses EV charging to protect the home
      var home = homeAt(c.home, h), ev = c.ev && !c.outage ? M.loadAt(['ev'], h) : 0, load = home + ev;
      var sun = M.solarAt(c.solar, h + DT / 2, 'summer', 'clear') * 0.92;
      var bat = 0, grid = 0, gen = 0, unmet = 0, net = sun - load;
      if (net >= 0) {
        var ch = Math.max(0, Math.min(net, pmax, (cap - soc) / 0.95 / DT));
        soc += ch * 0.95 * DT; bat = ch;
        if (!c.outage) grid = -(net - ch);
      } else {
        var need = -net, dis = Math.max(0, Math.min(need, pmax, soc * 0.95 / DT));
        soc -= dis / 0.95 * DT; bat = -dis; need -= dis;
        if (need > 0.001) {
          if (!c.outage) grid = need;
          else if (c.gen) { gen = Math.min(need, GEN_KW); unmet = need - gen; }
          else unmet = need;
        }
      }
      // in an outage the generator tops the battery up before it runs flat
      if (c.outage && c.gen && cap > 0 && soc < cap * 0.25 && gen < GEN_KW) {
        var top = Math.min(GEN_KW - gen, pmax - Math.max(0, bat), (cap * 0.6 - soc) / 0.95 / DT);
        if (top > 0) { soc += top * 0.95 * DT; gen += top; bat += top; }
      }
      soc = Math.max(0, Math.min(cap, soc));
      if (i >= 96) {
        pts.push({ h: h, sun: sun, home: home, ev: ev, load: load, bat: bat, grid: grid, gen: gen, unmet: unmet, soc: cap ? soc / cap : 0, dark: unmet > 0.05 });
        tot.load += load * DT; tot.imp += Math.max(0, grid) * DT; tot.exp += Math.max(0, -grid) * DT; tot.gen += gen * DT; tot.unmet += unmet * DT;
        if (unmet > 0.05) tot.dark += DT;
        if (gen > 0.05) tot.genH += DT;
      }
    }
    var self = c.outage ? 1 - tot.unmet / tot.load : 1 - (tot.imp + tot.gen) / tot.load;
    var darkStart = null, darkEnd = null;
    // the longest dark stretch, read around midnight so an overnight gap counts as one
    var order = pts.map(function (p, i) { return (i + 48) % 96; });
    var run = null, best = null;
    order.forEach(function (idx) {
      var p = pts[idx];
      if (p.dark) { if (!run) run = { s: p.h, n: 0 }; run.n++; run.e = p.h + DT; }
      else if (run) { if (!best || run.n > best.n) best = run; run = null; }
    });
    if (run && (!best || run.n > best.n)) best = run;
    if (best) { darkStart = best.s; darkEnd = best.e; }
    return { pts: pts, tot: tot, self: Math.max(0, Math.min(1, self)), darkStart: darkStart, darkEnd: darkEnd };
  }

  function bestFix() {
    if (!cfg.outage || sim.tot.dark <= 0) return '';
    var tries = [];
    if (cfg.batt < 4) tries.push({ c: Object.assign({}, cfg, { batt: cfg.batt + 1 }), s: tk('Add one battery') });
    if (cfg.solar < 24) tries.push({ c: Object.assign({}, cfg, { solar: Math.min(24, cfg.solar + 4) }), s: tk('Add 4 kW of solar') });
    if (!cfg.gen) tries.push({ c: Object.assign({}, cfg, { gen: true }), s: tk('Add the backup generator') });
    if (cfg.home !== 'ess') tries.push({ c: Object.assign({}, cfg, { home: 'ess' }), s: tk('Run only the essentials') });
    var best = null;
    tries.forEach(function (x) { var r = simulate(x.c); if (!best || r.tot.dark < best.d) best = { d: r.tot.dark, s: x.s }; });
    if (!best || best.d >= sim.tot.dark) return '';
    return best.d === 0 ? t('{fix} and you stay powered around the clock.', { fix: t(best.s) })
      : t('{fix} and the dark stretch drops to {h} hours.', { fix: t(best.s), h: f1(best.d) });
  }

  /* ---------- Render ---------- */
  var chart = $('.sbx-chart');
  function drawChart() {
    var W = 560, H = 150, L = 34, R = 8, top = 10, bot = 22, iw = W - L - R, ih = H - top - bot;
    chart.innerHTML = ''; chart.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var x = function (h) { return L + h / 24 * iw; };
    var maxKw = 2; sim.pts.forEach(function (p) { maxKw = Math.max(maxKw, p.sun, p.load); });
    var yk = function (kw) { return top + ih - kw / maxKw * ih; }, yp = function (pc) { return top + ih - pc * ih; };
    sv('rect', { x: x(0), y: top, width: x(6) - x(0), height: ih, class: 'ch-night' }, chart);
    sv('rect', { x: x(20), y: top, width: x(24) - x(20), height: ih, class: 'ch-night' }, chart);
    var run = null;
    sim.pts.forEach(function (p, i) {
      if (p.dark && run === null) run = p.h;
      if ((!p.dark || i === sim.pts.length - 1) && run !== null) { sv('rect', { x: x(run), y: top, width: Math.max(2, x(p.h + (p.dark ? DT : 0)) - x(run)), height: ih, class: 'ch-out' }, chart); run = null; }
    });
    var a = 'M' + x(0) + ' ' + yk(0);
    sim.pts.forEach(function (p) { a += ' L' + x(p.h + DT / 2).toFixed(1) + ' ' + yk(p.sun).toFixed(1); });
    a += ' L' + x(24) + ' ' + yk(0) + ' Z';
    sv('path', { d: a, class: 'ch-sun-area' }, chart);
    sv('path', { d: sim.pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.h + DT / 2).toFixed(1) + ' ' + yk(p.load).toFixed(1); }).join(' '), class: 'ch-load-line' }, chart);
    if (cfg.batt) sv('path', { d: sim.pts.map(function (p, i) { return (i ? 'L' : 'M') + x(p.h + DT).toFixed(1) + ' ' + yp(p.soc).toFixed(1); }).join(' '), class: 'ch-batt-line' }, chart);
    [0, 6, 12, 18, 24].forEach(function (h) {
      var lab = h === 0 || h === 24 ? '12am' : h === 12 ? '12pm' : h > 12 ? (h - 12) + 'pm' : h + 'am';
      var tx = sv('text', { x: x(h), y: H - 6, class: 'ch-tick', 'text-anchor': h === 0 ? 'start' : h === 24 ? 'end' : 'middle' }, chart); tx.textContent = lab;
    });
    var ty = sv('text', { x: L - 6, y: yk(maxKw) + 4, class: 'ch-tick', 'text-anchor': 'end' }, chart); ty.textContent = Math.round(maxKw) + ' kW';
    sv('line', { x1: 0, x2: 0, y1: top, y2: top + ih, class: 'ch-cursor', id: 'sbx-cursor' }, chart);
    chart._x = x;
  }
  function point() { var i = Math.min(95, Math.max(0, Math.floor(tod / DT))); return sim.pts[i]; }

  function status(p) {
    if (p.dark) return [tk('Power out'), 'off'];
    if (cfg.outage) return [p.gen > 0.05 ? tk('Islanded, generator assisting') : tk('Islanded, running alone'), 'on'];
    if (p.grid < -0.05) return [tk('Exporting to the grid'), 'on'];
    if (p.grid > 0.05) return [tk('Buying from the grid'), ''];
    if (p.bat < -0.05) return [tk('Running on battery'), 'on'];
    if (p.sun > 0.05) return [tk('Running on sun'), 'on'];
    return [tk('Idle'), ''];
  }
  function renderNow() {
    var p = point();
    $('.sbx-time').textContent = clockLabel(tod);
    $('#sbx-tod').value = tod;
    $('#sbx-tod').style.setProperty('--fill', (tod / 24 * 100) + '%');
    var st = status(p), pill = $('.sbx-pill');
    pill.textContent = t(st[0]); pill.setAttribute('data-state', st[1]);
    $('[data-v="sun"]').textContent = f1(p.sun) + ' kW';
    $('[data-v="load"]').textContent = f1(p.load) + ' kW';
    $('[data-v="batt"]').textContent = cfg.batt ? Math.round(p.soc * 100) + '%' + (p.bat > 0.05 ? ' ↑' : p.bat < -0.05 ? ' ↓' : '') : '—';
    $('[data-v="grid"]').textContent = cfg.outage ? t('Down') : p.grid > 0.05 ? t('Buying {kw} kW', { kw: f1(p.grid) }) : p.grid < -0.05 ? t('Selling {kw} kW', { kw: f1(-p.grid) }) : t('Standby');
    var c = document.getElementById('sbx-cursor'); if (c && chart._x) { var cx = chart._x(tod); c.setAttribute('x1', cx); c.setAttribute('x2', cx); }
    root.classList.toggle('is-dark', !!p.dark);
    if (window.OvaSystemScene) window.OvaSystemScene.apply(api.get());
  }
  function renderAll() {
    sim = simulate(cfg);
    $('[data-out="solar"]').textContent = cfg.solar + ' kW';
    $('[data-out="batt"]').textContent = cfg.batt ? t('{n} × 13.5 kWh', { n: cfg.batt }) : t('None');
    $$('[data-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!cfg[b.dataset.toggle])); });
    $$('[data-step]').forEach(function (b) {
      var k = b.dataset.step, d = Number(b.dataset.d), lim = k === 'solar' ? [0, 24] : [0, 4];
      b.disabled = cfg[k] + d * (k === 'solar' ? 2 : 1) < lim[0] || cfg[k] + d * (k === 'solar' ? 2 : 1) > lim[1];
    });
    var grid = $('.sbx-grid'); grid.setAttribute('aria-pressed', String(cfg.outage));
    $('.sbx-grid-l').textContent = cfg.outage ? t('Grid is down') : t('Grid is up');
    // verdict
    var v = $('.sbx-verdict'), sub = $('.sbx-sub'), fix = $('.sbx-fix');
    if (!cfg.outage) {
      v.textContent = t('Self-powered {pct}% of the day.', { pct: Math.round(sim.self * 100) });
      sub.textContent = t('Bought {imp} kWh from the grid and sold {exp} kWh back. Cut the grid to test an outage.', { imp: f1(sim.tot.imp), exp: f1(sim.tot.exp) });
    } else if (sim.tot.dark <= 0) {
      v.textContent = t('Rides through the outage, day and night.');
      sub.textContent = (cfg.gen && sim.tot.gen > 0 ? t('The generator ran for about {h} hours to top up the battery.', { h: f1(sim.tot.genH) }) : t('Solar and storage alone carry the home.')) + (cfg.ev ? ' ' + t('EV charging pauses automatically until the grid is back.') : '');
    } else {
      v.textContent = t('Lights out for {h} hours, from {a} to {b}.', { h: f1(sim.tot.dark), a: clockLabel(sim.darkStart), b: clockLabel(sim.darkEnd) });
      sub.textContent = (cfg.batt ? t('The battery runs out overnight before the sun comes back.') : t('With no battery, the home goes dark as soon as the sun sets.')) + (cfg.ev ? ' ' + t('EV charging is already paused to save power.') : '');
    }
    fix.textContent = bestFix();
    root.classList.toggle('outage', cfg.outage);
    drawChart(); renderNow();
  }

  /* ---------- Controls ---------- */
  $$('[data-step]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.step, d = Number(b.dataset.d) * (k === 'solar' ? 2 : 1);
      cfg[k] = Math.max(0, Math.min(k === 'solar' ? 24 : 4, cfg[k] + d)); renderAll();
    });
  });
  $$('[data-toggle]').forEach(function (b) { b.addEventListener('click', function () { var k = b.dataset.toggle; cfg[k] = !cfg[k]; renderAll(); }); });
  $$('input[name="sbx-home"]').forEach(function (r) { r.addEventListener('change', function () { cfg.home = r.value; renderAll(); }); });
  $('.sbx-grid').addEventListener('click', function () {
    cfg.outage = !cfg.outage;
    if (cfg.outage && tod > 6 && tod < 17) tod = 18; // jump to evening, when an outage bites
    renderAll();
  });
  var range = $('#sbx-tod');
  range.addEventListener('input', function () { setPlay(false); tod = Number(range.value); renderNow(); });
  chart.addEventListener('click', function (e) {
    var r = chart.getBoundingClientRect(), vbx = (e.clientX - r.left) / r.width * 560;
    tod = Math.max(0, Math.min(23.75, (vbx - 34) / (560 - 42) * 24)); setPlay(false); renderNow();
  });
  var play = $('.sbx-play'), raf = 0, last = 0;
  function loop(ts) {
    if (!playing) return;
    var dt = last ? Math.min(0.1, (ts - last) / 1000) : 0; last = ts;
    tod = (tod + dt * 1.25) % 24; renderNow();
    raf = requestAnimationFrame(loop);
  }
  function setPlay(on) {
    playing = on; last = 0;
    play.setAttribute('aria-pressed', String(on));
    play.setAttribute('aria-label', on ? t('Pause the day') : t('Play the day'));
    play.querySelector('path').setAttribute('d', on ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
    cancelAnimationFrame(raf); if (on) raf = requestAnimationFrame(loop);
  }
  play.addEventListener('click', function () { setPlay(!playing); });
  document.addEventListener('ova:lang', function () { renderAll(); });

  var NAMES = { solar: tk('Solar'), battery: tk('Battery'), generator: tk('Generator'), grid: tk('Utility grid'), nerd: tk('NERD controller'), home: tk('Home'), ev: tk('EV charger') };
  var api = {
    get: function () {
      var p = point(), n = {};
      Object.keys(NAMES).forEach(function (k) { n[k] = t(NAMES[k]); });
      return { tod: tod, cfg: Object.assign({}, cfg), p: p, names: n };
    }
  };
  api.play = function (on) { setPlay(!!on && !calm); };
  window.OvaSandbox = api;
  renderAll();
})();

/* Ovanova 3D infographics: a shared stage plus two data-driven scenes.
   Scenes read the same state as the 2D charts, which stay in the page as the accessible fallback. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var isLight = function () { var th = document.documentElement.getAttribute('data-theme'); return th ? th === 'light' : matchMedia('(prefers-color-scheme: light)').matches; };


  /* Real 3D models (generated with Higgsfield, optimized for the web) */
  var MODEL_BASE = 'models/', loaderState = null, loaderQ = [], modelCache = {};
  function withLoader(T, cb) {
    if (T.GLTFLoader) return cb(true);
    loaderQ.push(cb); if (loaderState) return; loaderState = 'loading';
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
    s.onload = function () { loaderQ.splice(0).forEach(function (f) { f(!!window.THREE.GLTFLoader); }); };
    s.onerror = function () { loaderQ.splice(0).forEach(function (f) { f(false); }); };
    document.head.appendChild(s);
  }
  function loadModel(T, name, cb) {
    if (modelCache[name]) { modelCache[name].then(function (o) { if (o) cb(o.clone()); }); return; }
    modelCache[name] = new Promise(function (res) {
      withLoader(T, function (ok) {
        if (!ok) return res(null);
        new T.GLTFLoader().load(MODEL_BASE + name + (window.OVA_MODEL_EXT || '.glb'), function (g) {
          g.scene.traverse(function (n) {
            if (!n.isMesh) return;
            var m = n.material;
            if (m.map) m.map.encoding = T.LinearEncoding;
            m.metalness = 0; m.roughness = 0.72; m.needsUpdate = true;
          });
          res(g.scene);
        }, undefined, function () { res(null); });
      });
    });
    modelCache[name].then(function (o) { if (o) cb(o.clone()); });
  }
  // scale a model to a size and stand it on the ground, centred
  function fitTo(T, obj, size, byHeight) {
    var pivot = new T.Group(); pivot.add(obj);
    var b = new T.Box3().setFromObject(obj), s = b.getSize(new T.Vector3());
    obj.scale.setScalar(byHeight ? size / s.y : size / Math.max(s.x, s.z));
    b = new T.Box3().setFromObject(obj); var c = b.getCenter(new T.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b.min.y;
    return pivot;
  }

  function needThree(cb) { if (window.OvaLoadThree) window.OvaLoadThree(cb); else cb(!!window.THREE); }

  /* Shared stage: renderer, orbit camera, fly-in, theme hook.
     Draws only while visible; with o.ondemand it also stops drawing once nothing is moving.
     dispose() stops everything and frees the GPU context. */
  var coarse = matchMedia('(pointer: coarse)').matches;
  function stage3d(wrap, o) {
    var T = window.THREE;
    var renderer = new T.WebGLRenderer({ antialias: !coarse, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.domElement.className = 's3-canvas';
    wrap.appendChild(renderer.domElement);
    var scene = new T.Scene();
    var cam = new T.PerspectiveCamera(o.fov || 30, 1, 0.1, 400);
    var st = { angle: o.angle, elev: o.elev, dist: o.dist, target: o.target || new T.Vector3() };
    var fly = calm ? 1 : 0, flying = false, visible = false, drag = null, moved = 0, last = performance.now(), frames = [], posts = [], themeFns = [];
    var px = 0, py = 0, dead = false, activeUntil = performance.now() + 2500, raf = 0;
    function place() {
      var k = 1 - Math.pow(1 - fly, 3);
      var d = st.dist * (1 + (1 - k) * 0.9), e = st.elev + (1 - k) * 0.35, a = st.angle - (1 - k) * 0.9;
      a += px * 0.05; e += py * 0.03;
      cam.position.set(st.target.x + Math.sin(a) * d * Math.cos(e), st.target.y + Math.sin(e) * d, st.target.z + Math.cos(a) * d * Math.cos(e));
      cam.lookAt(st.target);
    }
    function size() {
      if (dead) return;
      var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h, false); cam.aspect = w / h;
      cam.fov = (o.fov || 30) * (cam.aspect < 1 ? 1.35 : 1); cam.updateProjectionMatrix();
      kick(300);
    }
    function render() { if (dead) return; place(); renderer.render(scene, cam); posts.forEach(function (f) { f(); }); }
    function kick(ms) { activeUntil = Math.max(activeUntil, performance.now() + (ms || 1500)); }
    function tick(t) {
      if (dead) return;
      var dt = Math.min(0.05, (t - last) / 1000); last = t;
      var awake = !o.ondemand || drag || (flying && fly < 1) || t < activeUntil;
      if (visible && awake) {
        if (flying && fly < 1) fly = Math.min(1, fly + dt / 1.8);
        if (!drag && !calm && o.spin && !o.ondemand) st.angle += dt * o.spin;
        frames.forEach(function (f) { f(calm ? 0 : dt); });
        render();
      }
      raf = requestAnimationFrame(tick);
    }
    var el = renderer.domElement;
    var onDown = function (e) { drag = { x: e.clientX, y: e.clientY, a: st.angle, e: st.elev }; moved = 0; el.setPointerCapture(e.pointerId); wrap.classList.add('dragging'); };
    var onMove = function (e) {
      if (drag) {
        moved = Math.max(moved, Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y));
        st.angle = drag.a - (e.clientX - drag.x) * 0.008;
        st.elev = clamp(drag.e + (e.clientY - drag.y) * 0.004, o.minElev || 0.12, o.maxElev || 1.1);
        if (calm) render();
      } else if (!calm && !coarse) {
        var r = el.getBoundingClientRect();
        px = ((e.clientX - r.left) / r.width - 0.5); py = ((e.clientY - r.top) / r.height - 0.5);
        kick(500);
      }
    };
    var onUp = function () { drag = null; wrap.classList.remove('dragging'); kick(400); };
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', function () { px = 0; py = 0; kick(500); });
    var io = null, ro = null;
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) { flying = true; kick(800); } }, { threshold: 0.1 }); io.observe(wrap); }
    else { visible = true; flying = true; }
    if ('ResizeObserver' in window) { ro = new ResizeObserver(size); ro.observe(wrap); }
    window.addEventListener('resize', size);
    var mo = new MutationObserver(function () { themeFns.forEach(function (f) { f(wrap.closest('.mc') ? false : isLight()); }); kick(300); if (calm) render(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    size();
    raf = requestAnimationFrame(tick);
    wrap.classList.add('has3d');
    function dispose() {
      if (dead) return; dead = true;
      cancelAnimationFrame(raf);
      if (io) io.disconnect(); if (ro) ro.disconnect(); mo.disconnect();
      window.removeEventListener('resize', size);
      scene.traverse(function (n) {
        if (n.geometry) n.geometry.dispose();
        if (n.material) [].concat(n.material).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      });
      renderer.dispose();
      if (renderer.forceContextLoss) renderer.forceContextLoss();
      if (el.parentNode) el.parentNode.removeChild(el);
      $$('.s3-labels', wrap).forEach(function (l) { l.parentNode.removeChild(l); });
      wrap.classList.remove('has3d', 'dragging');
    }
    return {
      T: T, scene: scene, cam: cam, renderer: renderer, st: st, el: el,
      onFrame: function (f) { frames.push(f); }, onPost: function (f) { posts.push(f); },
      onTheme: function (f) { themeFns.push(f); f(wrap.closest('.mc') ? false : isLight()); }, render: render, kick: kick, dispose: dispose,
      wasDrag: function () { return moved > 5; }, alive: function () { return !dead; }
    };
  }
  window.OvaStage3D = stage3d;

  /* Project a 3D point to a positioned HTML label */
  function labeler(s, wrap) {
    var v = new s.T.Vector3();
    return function (el, pos) {
      v.copy(pos).project(s.cam);
      var w = wrap.clientWidth, h = wrap.clientHeight;
      el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
      el.style.opacity = v.z < 1 ? '' : '0';
    };
  }

  /* ---------- Scene 1: the home microgrid ---------- */
  function microgrid(wrap) {
    var s = stage3d(wrap, { angle: 0.62, elev: 0.5, dist: 48, target: null, spin: 0.025 });
    var T = s.T, scene = s.scene;
    s.st.target = new T.Vector3(0, 1.2, 0);
    var M = function (c, x) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, x || {})); };
    var hemi = new T.HemisphereLight(0xdfefff, 0x18222c, 0.6); scene.add(hemi);
    scene.add(new T.AmbientLight(0xffffff, 0.22));
    var sun = new T.DirectionalLight(0xfff1d6, 1); sun.position.set(-12, 20, 10); scene.add(sun);
    var ground = new T.Mesh(new T.CircleGeometry(80, 96), M(0x0f171f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var pad = new T.Mesh(new T.CircleGeometry(16, 72), M(0x16212b)); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.01; scene.add(pad);
    function grp(x, z) { var g = new T.Group(); g.position.set(x, 0, z); scene.add(g); return g; }

    // things that pop in and out as the visitor adds or removes them
    var pops = [];
    function popIn(obj, parent) { obj.scale.setScalar(0.001); obj.userData.k = 0; obj.userData.goal = 1; parent.add(obj); pops.push(obj); return obj; }
    function popOut(obj) { obj.userData.goal = 0; }

    // NERD hub
    var hub = grp(0, 0);
    var cab = new T.Mesh(new T.BoxGeometry(1.6, 2.6, 1.1), M(0xdfe4e9, { roughness: 0.35, metalness: 0.2 })); cab.position.y = 1.3; hub.add(cab);
    var haloMat = new T.MeshBasicMaterial({ color: 0x2eadf7, transparent: true, opacity: 0.55, side: T.DoubleSide });
    var halo = new T.Mesh(new T.RingGeometry(2.2, 2.34, 64), haloMat); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.03; hub.add(halo);

    // solar field: one unit per 2 kW
    var solarG = grp(-10, -6), solarItems = [], solarProto = null;
    function makePanel() {
      if (solarProto) { var o = solarProto.clone(); return o; }
      var g = new T.Group();
      var p = new T.Mesh(new T.BoxGeometry(2.3, 0.08, 1.3), M(0x0c1d33, { roughness: 0.25, metalness: 0.5 })); p.position.y = 1.0; p.rotation.x = -0.5; g.add(p);
      var leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.9, 6), M(0x7d8892)); leg.position.y = 0.45; g.add(leg);
      return g;
    }
    function slotSolar(i) { return new T.Vector3(-5.1 + (i % 4) * 3.4, 0, -3.2 + Math.floor(i / 4) * 3.1); }
    function setSolar(n, rebuild) {
      if (rebuild) { solarItems.forEach(function (o) { solarG.remove(o); }); solarItems = []; }
      while (solarItems.length < n) { var o = makePanel(); o.position.copy(slotSolar(solarItems.length)); solarItems.push(popIn(o, solarG)); }
      while (solarItems.length > n) popOut(solarItems.pop());
    }
    // battery bank: one cabinet per battery
    var battG = grp(-11, 5), battItems = [], battProto = null;
    function makeBatt() {
      if (battProto) return battProto.clone();
      var b = new T.Mesh(new T.BoxGeometry(1.0, 1.9, 0.9), M(0xe7ebef, { roughness: 0.4 })); b.position.y = 0.95;
      var g = new T.Group(); g.add(b); return g;
    }
    function setBatt(n, rebuild) {
      if (rebuild) { battItems.forEach(function (o) { battG.remove(o); }); battItems = []; }
      while (battItems.length < n) { var o = makeBatt(); o.position.set(-1.9 + battItems.length * 1.3, 0, 0); o.rotation.y = 0.15; battItems.push(popIn(o, battG)); }
      while (battItems.length > n) popOut(battItems.pop());
    }
    // generator
    var genG = grp(-3, 9), genObj = null;
    var genLightMat = new T.MeshBasicMaterial({ color: 0x55606b });
    function makeGen() {
      var g = new T.Group();
      var body = new T.Mesh(new T.BoxGeometry(2.6, 1.3, 1.3), M(0x55606b, { roughness: 0.6 })); body.position.y = 0.65; g.add(body);
      var stack = new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.9, 8), M(0x2a323a)); stack.position.set(0.8, 1.7, 0); g.add(stack);
      var led = new T.Mesh(new T.SphereGeometry(0.1, 10, 10), genLightMat); led.position.set(-0.9, 1.0, 0.66); g.add(led);
      return g;
    }
    // utility grid tower
    var grid = grp(6, -11);
    var towerMat = M(0x8a96a2, { metalness: 0.4, roughness: 0.5 });
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(function (q) {
      var leg = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 6.5, 6), towerMat); leg.position.set(q[0] * 0.6, 3.2, q[1] * 0.6); leg.rotation.z = -q[0] * 0.08; leg.rotation.x = q[1] * 0.08; grid.add(leg);
    });
    [5.2, 6.1].forEach(function (y) { var arm = new T.Mesh(new T.BoxGeometry(3.4, 0.08, 0.08), towerMat); arm.position.y = y; grid.add(arm); });
    var wireMat = new T.MeshBasicMaterial({ color: 0x8a96a2 });
    [-1.6, 1.6].forEach(function (xo) {
      var curve = new T.CatmullRomCurve3([new T.Vector3(xo, 6.1, 0), new T.Vector3(xo + 6, 5.2, -4), new T.Vector3(xo + 14, 6.1, -9)]);
      grid.add(new T.Mesh(new T.TubeGeometry(curve, 24, 0.025, 4), wireMat));
    });
    // home
    var home = grp(9, 3);
    var hb = new T.Mesh(new T.BoxGeometry(5, 2.6, 3.8), M(0xd9dee3)); hb.position.y = 1.3; home.add(hb);
    var houseLight = new T.PointLight(0xffc98a, 0, 10); houseLight.position.set(0, 1.6, 0.8); home.add(houseLight);
    // EV
    var evG = grp(8, 9.5), evObj = null, evProto = null;
    function makeEV() {
      if (evProto) return evProto.clone();
      var g = new T.Group();
      var body = new T.Mesh(new T.BoxGeometry(1.6, 0.55, 3.4), M(0xb9c3cc, { metalness: 0.5, roughness: 0.35 })); body.position.y = 0.55; g.add(body);
      var cabin = new T.Mesh(new T.BoxGeometry(1.4, 0.48, 1.8), M(0x1d2731)); cabin.position.set(0, 1.03, -0.15); g.add(cabin);
      return g;
    }

    // cables and energy particles
    var hubPt = new T.Vector3(0, 0.25, 0);
    var ends = { solar: new T.Vector3(-8, 0.25, -4.5), battery: new T.Vector3(-8.8, 0.25, 4.6), generator: new T.Vector3(-3, 0.25, 7.8), grid: new T.Vector3(5.6, 0.25, -9.6), home: new T.Vector3(6.4, 0.25, 3), ev: new T.Vector3(6.6, 0.25, 7.8) };
    var cableMat = M(0x26313c, { roughness: 0.9 });
    var colors = { solar: 0xf4c64e, battery: 0x2eadf7, generator: 0xf2a94b, grid: 0xc9d6e2, home: 0x2eadf7, ev: 0x2eadf7 };
    var links = {}, dotGeo = new T.SphereGeometry(0.14, 10, 10);
    Object.keys(ends).forEach(function (k) {
      var a = ends[k], mid = a.clone().add(hubPt).multiplyScalar(0.5); mid.y = 0.25;
      mid.add(new T.Vector3(-(a.z - hubPt.z), 0, a.x - hubPt.x).normalize().multiplyScalar(1.4));
      var curve = new T.QuadraticBezierCurve3(a, mid, hubPt);
      var cable = new T.Mesh(new T.TubeGeometry(curve, 40, 0.07, 6), cableMat); scene.add(cable);
      var dots = [], mat = new T.MeshBasicMaterial({ color: colors[k] });
      for (var i = 0; i < 10; i++) { var d = new T.Mesh(dotGeo, mat); d.userData.o = i / 10; d.visible = false; scene.add(d); dots.push(d); }
      links[k] = { curve: curve, dots: dots, kw: 0, cable: cable };
    });

    // live labels
    var place = labeler(s, wrap);
    var labelPos = { nerd: [0, 3.5, 0], solar: [-10, 3.2, -6], battery: [-10, 2.8, 5], generator: [-3, 2.4, 9], grid: [6, 7.4, -11], home: [9, 4.8, 3], ev: [8, 2.2, 9.5] };
    var labels = {}, layer = document.createElement('div'); layer.className = 's3-labels'; wrap.appendChild(layer);
    Object.keys(labelPos).forEach(function (k) {
      var b = document.createElement('div'); b.className = 's3-tag live'; b.innerHTML = '<i></i><span></span><b></b>';
      layer.appendChild(b); labels[k] = { el: b, pos: new T.Vector3().fromArray(labelPos[k]) };
    });

    var st = null, dayK = 1, dayGoal = 1, clk = 0, haveHouse = false;
    var f1 = function (n) { return (Math.round(n * 10) / 10).toFixed(1); };
    function lab(k, show, name, val, state) {
      var L = labels[k]; L.el.hidden = !show; if (!show) return;
      L.el.querySelector('span').textContent = name; L.el.querySelector('b').textContent = val; L.el.dataset.state = state;
    }
    function apply(x) {
      var c = x.cfg, p = x.p, h = x.tod;
      var first = !st; st = x;
      setSolar(c.solar / 2); setBatt(c.batt);
      if (c.gen && !genObj) genObj = popIn(makeGen(), genG);
      if (!c.gen && genObj) { popOut(genObj); genObj = null; }
      if (c.ev && !evObj) { evObj = popIn(makeEV(), evG); }
      if (!c.ev && evObj) { popOut(evObj); evObj = null; }
      // sun and sky follow the clock (summer: up at 6, down at 20)
      var k = (h > 5.5 && h < 20.5) ? Math.sin(Math.PI * (h - 5.5) / 15) : 0;
      dayGoal = Math.max(0.06, Math.min(1, k * 1.25));
      var az = Math.PI * ((h - 6) / 14);
      sun.position.set(-Math.cos(az) * 18, 2 + k * 18, 9);
      // flows (kW, sign gives direction relative to the hub)
      links.solar.kw = p.sun; links.battery.kw = -p.bat; links.generator.kw = p.gen; links.grid.kw = p.grid; links.home.kw = -(p.dark ? 0 : p.home); links.ev.kw = -(p.dark ? 0 : p.ev);
      links.solar.cable.visible = c.solar > 0; links.battery.cable.visible = c.batt > 0; links.generator.cable.visible = c.gen; links.ev.cable.visible = c.ev;
      wireMat.color.set(c.outage ? 0xef7f73 : 0x8a96a2);
      haloMat.color.set(p.dark ? 0xef7f73 : c.outage ? 0x6fdba0 : 0x2eadf7);
      genLightMat.color.set(p.gen > 0.05 ? 0x6fdba0 : 0x55606b);
      var n = x.names;
      lab('solar', c.solar > 0, n.solar, f1(p.sun) + ' kW', p.sun > 0.05 ? 'on' : '');
      lab('battery', c.batt > 0, n.battery, Math.round(p.soc * 100) + '%' + (p.bat > 0.05 ? ' ↑' : p.bat < -0.05 ? ' ↓' : ''), p.soc < 0.1 ? 'off' : Math.abs(p.bat) > 0.05 ? 'on' : '');
      lab('generator', c.gen, n.generator, p.gen > 0.05 ? f1(p.gen) + ' kW' : t('Off'), p.gen > 0.05 ? 'on' : '');
      lab('grid', true, n.grid, c.outage ? '✕' : (p.grid > 0.05 ? '← ' : p.grid < -0.05 ? '→ ' : '') + f1(Math.abs(p.grid)) + ' kW', c.outage ? 'off' : Math.abs(p.grid) > 0.05 ? 'on' : '');
      lab('home', true, n.home, p.dark ? '0.0 kW' : f1(p.home) + ' kW', p.dark ? 'off' : 'on');
      lab('ev', c.ev, n.ev, c.outage ? t('Paused') : f1(p.ev) + ' kW', p.ev > 0.05 && !p.dark ? 'on' : '');
      lab('nerd', true, n.nerd, c.outage ? (p.dark ? '⚠' : t('Island')) : t('Grid-tied'), p.dark ? 'off' : 'on');
      if (first) dayK = dayGoal;
      if (calm) s.render();
    }

    var gNight = new T.Color(), gDay = new T.Color(), pNight = new T.Color(), pDay = new T.Color();
    s.onTheme(function (lt) {
      gNight.set(lt ? 0x8d9eae : 0x070d13); gDay.set(lt ? 0xe6edf3 : 0x24384a);
      pNight.set(lt ? 0x9aabbb : 0x0d151d); pDay.set(lt ? 0xd5dfe7 : 0x2d4559);
      cableMat.color.set(lt ? 0x9aa8b5 : 0x26313c);
      hemi.groundColor.set(lt ? 0xb8c4cf : 0x18222c);
    });
    s.onFrame(function (dt) {
      clk += dt;
      dayK += (dayGoal - dayK) * Math.min(1, dt * 3 || 1);
      wrap.style.setProperty('--day', dayK.toFixed(3));
      ground.material.color.copy(gNight).lerp(gDay, dayK); pad.material.color.copy(pNight).lerp(pDay, dayK);
      sun.intensity = 0.15 + dayK * 1.05; hemi.intensity = 0.32 + dayK * 0.5;
      var dark = st && st.p.dark;
      houseLight.intensity = (haveHouse ? 1 : 0.6) * (dark ? 0 : (1 - dayK) * 1.8);
      halo.scale.setScalar(1 + Math.sin(clk * (dark ? 6 : 1.6)) * (dark ? 0.08 : 0.04));
      // pop animation
      for (var i = pops.length - 1; i >= 0; i--) {
        var o = pops[i], g = o.userData.goal;
        o.userData.k += ((g) - o.userData.k) * Math.min(1, (dt || 0.016) * 7);
        var e = g ? 1 + Math.sin(Math.min(1, o.userData.k) * Math.PI) * 0.12 * (1 - o.userData.k) : 1;
        o.scale.setScalar(Math.max(0.001, o.userData.k * e));
        if (!g && o.userData.k < 0.02) { o.parent && o.parent.remove(o); pops.splice(i, 1); }
        else if (g && o.userData.k > 0.995) { o.scale.setScalar(1); pops.splice(i, 1); }
      }
      Object.keys(links).forEach(function (k) {
        var L = links[k], kw = Math.abs(L.kw), on = kw > 0.05;
        var sp = 0.12 + Math.min(kw, 8) * 0.05, sc = 0.55 + Math.min(kw, 6) * 0.14;
        L.dots.forEach(function (d) {
          d.visible = on; if (!on) return;
          var u = (d.userData.o + clk * sp) % 1;
          if (L.kw < 0) u = 1 - u;
          d.position.copy(L.curve.getPoint(u)); d.position.y += 0.14; d.scale.setScalar(sc);
        });
      });
    });

    // real models replace stand-ins as they arrive
    var hideAll = function (g, keep) { g.children.forEach(function (c) { if (!keep || keep.indexOf(c) < 0) c.visible = false; }); };
    loadModel(T, 'house', function (o) { var p = fitTo(T, o, 7); p.rotation.y = -0.35; hideAll(home, [houseLight]); home.add(p); haveHouse = true; });
    loadModel(T, 'nerd', function (o) { var p = fitTo(T, o, 2.7, true); p.rotation.y = 0.2; cab.visible = false; hub.add(p); });
    loadModel(T, 'nerd', function (o) { battProto = fitTo(T, o, 1.8, true); if (st) setBatt(st.cfg.batt, true); });
    loadModel(T, 'solar', function (o) { solarProto = fitTo(T, o, 3.4); solarProto.rotation.y = 0.1; if (st) setSolar(st.cfg.solar / 2, true); });
    loadModel(T, 'ev', function (o) { evProto = fitTo(T, o, 3.6); if (evObj) { evG.remove(evObj); var i = pops.indexOf(evObj); if (i > -1) pops.splice(i, 1); evObj = popIn(makeEV(), evG); } });

    s.onPost(function () { Object.keys(labels).forEach(function (k) { if (!labels[k].el.hidden) place(labels[k].el, labels[k].pos); }); });
    return { apply: apply, render: s.render, dispose: s.dispose };
  }

  /* ---------- Scene 2: the feeder load landscape ---------- */
  function landscape(wrap) {
    var s = stage3d(wrap, { angle: -0.55, elev: 0.36, dist: 52, maxElev: 1.0, ondemand: true });
    var T = s.T, scene = s.scene;
    s.st.target = new T.Vector3(0, 5, 0);
    scene.add(new T.HemisphereLight(0xdfefff, 0x18222c, 0.75));
    scene.add(new T.AmbientLight(0xffffff, 0.3));
    var dl = new T.DirectionalLight(0xffffff, 0.8); dl.position.set(-10, 25, 18); scene.add(dl);
    var floor = new T.Mesh(new T.PlaneGeometry(70, 26), new T.MeshStandardMaterial({ color: 0x0f171f, roughness: 1 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    var H = 14, W = 1.2, GAP = 0.35, x0 = -(24 * (W + GAP)) / 2 + W / 2;
    var gridMat = new T.MeshStandardMaterial({ color: 0x9fb2c4, roughness: 0.6, metalness: 0.1 });
    var shaveMat = new T.MeshStandardMaterial({ color: 0x2eadf7, emissive: 0x2eadf7, emissiveIntensity: 0.35, transparent: true, opacity: 0.85, roughness: 0.3 });
    var chargeMat = new T.MeshStandardMaterial({ color: 0x6fdba0, emissive: 0x6fdba0, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, roughness: 0.4 });
    var unit = new T.BoxGeometry(W, 1, W);
    var cols = [];
    for (var h = 0; h < 24; h++) {
      var base = new T.Mesh(unit, gridMat), top = new T.Mesh(unit, shaveMat), chg = new T.Mesh(unit, chargeMat);
      [base, top, chg].forEach(function (m) { m.position.x = x0 + h * (W + GAP); scene.add(m); });
      cols.push({ base: base, top: top, chg: chg, cur: { b: 0, t: 0, c: 0 }, tgt: { b: 0, t: 0, c: 0 } });
    }
    var capMat = new T.MeshBasicMaterial({ color: 0x2eadf7, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false });
    var cap = new T.Mesh(new T.PlaneGeometry(24 * (W + GAP) + 2, 3.4), capMat); cap.rotation.x = -Math.PI / 2; scene.add(cap);
    var capEdge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(24 * (W + GAP) + 2, 3.4)), new T.LineBasicMaterial({ color: 0x2eadf7 }));
    capEdge.rotation.x = -Math.PI / 2; scene.add(capEdge);
    var peakMat = new T.LineDashedMaterial({ color: 0x9fb2c4, dashSize: 0.5, gapSize: 0.4 });
    var peakGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(x0 - 1.4, 0, -1.7), new T.Vector3(-x0 + 1.4, 0, -1.7)]);
    var peakLine = new T.Line(peakGeo, peakMat); peakLine.computeLineDistances(); scene.add(peakLine);
    // labels
    var place = labeler(s, wrap);
    var layer = document.createElement('div'); layer.className = 's3-labels'; wrap.appendChild(layer);
    var mk = function (cls) { var d = document.createElement('div'); d.className = 's3-note ' + cls; layer.appendChild(d); return d; };
    var lCap = mk('cap'), lPeak = mk('peak');
    var hours = [0, 6, 12, 18, 23].map(function (h) { var d = mk('hour'); d.textContent = h === 0 ? '12am' : h === 12 ? '12pm' : h === 23 ? '11pm' : h > 12 ? (h - 12) + 'pm' : h + 'am'; return { el: d, pos: new T.Vector3(x0 + h * (W + GAP), 0, 1.9) }; });
    var capY = H, peakY = H;
    function apply(d) {
      var scale = H / (d.peak * 1.0);
      cols.forEach(function (c, i) {
        c.tgt.b = Math.min(d.L[i], d.T) * scale;
        c.tgt.t = Math.max(0, d.L[i] - d.T) * scale;
        c.tgt.c = d.charge[i] * scale;
      });
      capY = d.newPeak * scale; peakY = d.peak * scale;
      lCap.textContent = d.capLabel; lPeak.textContent = d.peakLabel;
      if (calm) { cols.forEach(function (c) { c.cur = Object.assign({}, c.tgt); }); s.render(); }
    }
    s.onTheme(function (lt) {
      floor.material.color.set(lt ? 0xdfe6ec : 0x0b1218);
      gridMat.color.set(lt ? 0x7d93a8 : 0x9fb2c4);
    });
    var capCur = H;
    s.onFrame(function (dt) {
      var k = calm ? 1 : Math.min(1, dt * 6);
      cols.forEach(function (c) {
        ['b', 't', 'c'].forEach(function (p) { c.cur[p] += (c.tgt[p] - c.cur[p]) * k; });
        var b = Math.max(0.001, c.cur.b), tp = Math.max(0.001, c.cur.t), ch = Math.max(0.001, c.cur.c);
        c.base.scale.y = b; c.base.position.y = b / 2;
        c.top.scale.y = tp; c.top.position.y = b + tp / 2; c.top.visible = c.cur.t > 0.02;
        c.chg.scale.y = ch; c.chg.position.y = b + ch / 2; c.chg.visible = c.cur.c > 0.02;
      });
      capCur += (capY - capCur) * k;
      cap.position.y = capCur; capEdge.position.y = capCur;
      peakLine.position.y = peakY;
    });
    var tmp = new T.Vector3();
    s.onPost(function () {
      place(lCap, tmp.set(x0 - 1.4, capCur, -1.7));
      place(lPeak, tmp.set(x0 - 1.4, peakY + 0.5, -1.7));
      hours.forEach(function (h) { place(h.el, h.pos); });
    });
    return { apply: function (d) { apply(d); s.kick(1800); }, dispose: s.dispose };
  }


  /* ---------- Scene 3: the PET trailer, for the sizer ---------- */
  function petViewer(wrap) {
    var s = stage3d(wrap, { angle: 0.9, elev: 0.3, dist: 14.5, maxElev: 0.9, fov: 26, ondemand: true });
    var T = s.T, scene = s.scene;
    s.st.target = new T.Vector3(0, 1.4, 0);
    scene.add(new T.HemisphereLight(0xeaf4ff, 0x1a2430, 0.55));
    scene.add(new T.AmbientLight(0xffffff, 0.18));
    var dl = new T.DirectionalLight(0xfff4e0, 0.75); dl.position.set(6, 12, 8); scene.add(dl);
    var ground = new T.Mesh(new T.CircleGeometry(30, 72), new T.MeshStandardMaterial({ color: 0x0f171f, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var ringM = new T.Mesh(new T.RingGeometry(3.4, 3.48, 96), new T.MeshBasicMaterial({ color: 0x2eadf7, transparent: true, opacity: 0.55 }));
    ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.01; scene.add(ringM);
    s.onTheme(function (lt) { ground.material.color.set(lt ? 0xe2e9ef : 0x0b1218); });
    loadModel(T, 'pet', function (o) { if (!s.alive()) return; var p = fitTo(T, o, 5); scene.add(p); s.kick(1200); });
    var clk = 0; s.onFrame(function (dt) { clk += dt; ringM.scale.setScalar(1 + Math.sin(clk * 1.4) * 0.03); });
    return s;
  }

  /* ---------- Boot ---------- */
  // inline scenes: mount when near the screen, shut down a moment after leaving it
  function managed(wrap, make, onMount) {
    if (!('IntersectionObserver' in window)) { needThree(function (ok) { if (ok) onMount(make(wrap)); }); return; }
    var sc = null, loading = false, timer = 0;
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) {
        clearTimeout(timer);
        if (sc || loading) return; loading = true;
        needThree(function (ok) {
          loading = false;
          if (!ok) { wrap.classList.add('no3d'); return; }
          try { sc = make(wrap); onMount(sc); } catch (e) { wrap.classList.add('no3d'); }
        });
      } else if (sc) {
        timer = setTimeout(function () { if (sc) { sc.dispose(); sc = null; onMount(null); } }, 1500);
      }
    }, { rootMargin: '300px' }).observe(wrap);
  }
  $$('[data-scene="pet3d"]').forEach(function (wrap) { managed(wrap, petViewer, function () {}); });
  $$('[data-scene="landscape"]').forEach(function (wrap) {
    managed(wrap, landscape, function (sc) { window.OvaPeakScene = sc; if (sc && window.OvaPeakLast) sc.apply(window.OvaPeakLast); });
  });
  // the sandbox scene starts only when its app window opens
  window.OvaScenes = {
    model: function (name, height, cb) {
      needThree(function (ok) {
        if (!ok) return cb(null);
        var done = false, to = setTimeout(function () { if (!done) { done = true; cb(null); } }, 9000);
        loadModel(window.THREE, name, function (o) { if (done) return; done = true; clearTimeout(to); cb(fitTo(window.THREE, o, height, true)); });
      });
    },
    microgrid: function (wrap, cb) {
      needThree(function (ok) {
        if (!ok) return cb(null);
        try { var sc = microgrid(wrap); window.OvaSystemScene = sc; if (window.OvaSandbox) sc.apply(window.OvaSandbox.get()); cb(sc); }
        catch (e) { cb(null); }
      });
    },
    preload: function (names, cb) {
      needThree(function (ok) {
        if (!ok) return cb(false);
        var left = names.length; if (!left) return cb(true);
        names.forEach(function (n) { loadModel(window.THREE, n, function () { if (--left === 0) cb(true); }); });
        setTimeout(function () { if (left > 0) { left = -1; cb(true); } }, 8000);
      });
    }
  };
})();

/* Apply the visitor's language once every script has rendered */
if (window.OvaLang) { var __l = document.documentElement.getAttribute('lang'); window.OvaLang((function () { try { return localStorage.getItem('ovanova-lang'); } catch (e) { return null; } })() || ((navigator.language || '').toLowerCase().indexOf('es') === 0 ? 'es' : 'en'), true); }

/* View switch between the 3D scene and the flat chart */
(function () {
  Array.prototype.slice.call(document.querySelectorAll('.viz')).forEach(function (viz) {
    var s3 = viz.querySelector('.s3');
    viz.addEventListener('change', function (e) {
      if (!e.target.closest('.viz-switch')) return;
      viz.classList.toggle('flat', e.target.value === 'flat');
      window.dispatchEvent(new Event('resize'));
    });
    if (s3 && 'MutationObserver' in window) new MutationObserver(function () {
      if (s3.classList.contains('no3d')) { viz.classList.add('flat'); var sw = viz.querySelector('.viz-switch'); if (sw) sw.hidden = true; }
    }).observe(s3, { attributes: true, attributeFilter: ['class'] });
  });
})();

/* Ovanova tool UX: presets, result handoff to the contact form, plain-language explainers, planner dock. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var SPA = document.documentElement.hasAttribute('data-spa');

  /* ---------- Presets: one tap to a realistic starting point ---------- */
  function clearPressed(group) { $$('[data-set],[data-loads]', group).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); }
  $$('.presets').forEach(function (group) {
    var tool = group.closest('[data-tool]');
    var target = $('.pl-controls', tool) || tool;
    $$('button', group).forEach(function (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () {
        if (btn.dataset.loads) {
          var want = btn.dataset.loads.split(' ');
          $$('input[name="pl-load"]', tool).forEach(function (i) { i.checked = want.indexOf(i.value) > -1; });
        }
        if (btn.dataset.set) {
          var set = JSON.parse(btn.dataset.set);
          Object.keys(set).forEach(function (k) {
            var el = tool.querySelector('#' + k);
            if (el) { if (el.type === 'radio' || el.type === 'checkbox') el.checked = !!set[k]; else el.value = set[k]; return; }
            var radio = tool.querySelector('input[type="radio"][name="' + k + '"][value="' + set[k] + '"]');
            if (radio) { radio.checked = true; return; }
            var out = tool.querySelector('[data-field="' + k + '"] output');
            if (out) out.textContent = set[k];
          });
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        clearPressed(group); btn.setAttribute('aria-pressed', 'true');
      });
    });
    // a manual change means the preset no longer describes what is on screen
    tool.addEventListener('input', function (e) { if (e.isTrusted) clearPressed(group); });
    tool.addEventListener('click', function (e) { if (e.isTrusted && e.target.closest('.step-ctl')) clearPressed(group); });
  });

  /* ---------- Send results to Ovanova ---------- */
  var NAMES = { planner: tk('outage planner'), exposure: tk('outage cost calculator'), peak: tk('peak shaving tool'), pet: tk('PET sizer') };
  var TOPIC = { planner: 'Home microgrid', exposure: 'Commercial microgrid', peak: 'Power Towns', reliability: 'Power Towns', pet: 'PET', 'nerd-run': 'NERD' };
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  // text of an element without explainer buttons or small captions
  function txt(el) { if (!el) return ''; var c = el.cloneNode(true); $$('.tipq, small', c).forEach(function (x) { x.parentNode.removeChild(x); }); return clean(c.textContent); }
  function brief(tool) {
    var kind = tool.getAttribute('data-tool');
    var sec = tool.closest('section');
    var name = t(NAMES[kind] || '');
    var lines = [t('My results from the Ovanova {tool}:', { tool: name })];
    var verdict = $('.pl-verdict', tool);
    if (verdict && clean(verdict.textContent)) lines.push(clean(verdict.textContent));
    var tip = $('.pl-tip', tool); if (tip && clean(tip.textContent)) lines.push(clean(tip.textContent));
    if (kind === 'exposure') lines.push(txt($('.ex-total', tool).previousElementSibling) + ': ' + clean($('.ex-total', tool).textContent));
    if (kind === 'peak') lines.push(txt($('.ps-save', tool).previousElementSibling) + ': ' + clean($('.ps-save', tool).textContent));
    $$('.kv-row .kv', tool).forEach(function (kv) {
      var l = $('.label', kv), v = $('b', kv);
      if (l && v) lines.push('- ' + txt(l) + ': ' + clean(v.textContent));
    });
    var inputs = [];
    var loads = $$('input[name="pl-load"]:checked', tool).map(function (i) { return clean(i.nextElementSibling.firstChild.textContent); });
    if (loads.length) inputs.push(t('Must stay on') + ': ' + loads.join(', '));
    $$('.segs input:checked', tool).forEach(function (i) {
      var fs = i.closest('fieldset'); var lg = fs && $('legend', fs);
      if (lg && !i.closest('.viz-switch')) inputs.push(txt(lg) + ': ' + txt(i.nextElementSibling));
    });
    $$('.ctl', tool).forEach(function (c) {
      var l = $('label span, .ctl-top > span', c), o = $('output', c);
      if (l && o) inputs.push(txt(l) + ': ' + clean(o.textContent));
    });
    $$('[data-field]', tool).forEach(function (r) {
      var n = Number($('output', r).textContent);
      if (n > 0) inputs.push(clean(r.firstElementChild.firstChild.textContent) + ' × ' + n);
    });
    if (inputs.length) { lines.push(''); lines.push(t('What I entered') + ':'); inputs.forEach(function (x) { lines.push('- ' + x); }); }
    return { topic: TOPIC[kind] || '', text: lines.join('\n'), from: name };
  }
  function store(b) {
    window.__ovaBrief = b;
    try { sessionStorage.setItem('ova-brief', JSON.stringify(b)); } catch (e) {}
  }
  function take() {
    var b = window.__ovaBrief;
    if (!b) { try { b = JSON.parse(sessionStorage.getItem('ova-brief') || 'null'); } catch (e) { b = null; } }
    return b;
  }
  function fillContact() {
    var b = take(); if (!b) return;
    var msg = $('#ct-msg'), topic = $('#ct-topic'), note = $('.brief-note');
    if (!msg) return;
    msg.value = b.text + '\n\n' + (msg.value || '');
    msg.style.minHeight = Math.min(420, 60 + b.text.split('\n').length * 22) + 'px';
    if (topic && b.topic) topic.value = b.topic;
    if (note) { $('.brief-from', note).textContent = b.from; note.hidden = false; }
    window.__ovaBrief = null;
    try { sessionStorage.removeItem('ova-brief'); } catch (e) {}
  }
  $$('[data-send]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      store(brief(btn.closest('[data-tool]')));
      if (SPA) { fillContact(); location.hash = 'contact-form'; }
      else location.href = 'contact.html#contact-form';
    });
  });
  if (!SPA) fillContact();
  window.OvaBrief = { store: store, fill: fillContact };

  /* ---------- Plain-language explainers ---------- */
  var GLOSS = {
    kwh: tk('kW is power: how much is being used right now. kWh is energy: power over time. A 1 kW heater running for 3 hours uses 3 kWh.'),
    peak: tk('Peak demand is the most power drawn at a single moment, for example when the AC, well pump and oven all start together. Batteries and inverters must be sized for it.'),
    demand: tk('A demand charge is a monthly fee for each kW of your single highest peak, on top of the energy you use. Shaving that one peak lowers the whole charge.'),
    island: tk('Islanding means the microgrid disconnects from the utility during an outage and keeps running on its own sources, then reconnects when the grid is back.'),
    saidi: tk('Standard utility reliability scores (IEEE 1366). SAIFI: how often the average customer loses power. SAIDI: total minutes out per year. CAIDI: how long each outage lasts.'),
    duration: tk('Duration is how many hours the battery can deliver its full power. A 4 MW battery with 4 hours of duration stores 16 MWh.')
  };
  var open = null;
  function closeTip() { if (open) { open.btn.setAttribute('aria-expanded', 'false'); open.pop.remove(); open = null; } }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.tipq');
    if (!b) { if (open && !e.target.closest('.tip-pop')) closeTip(); return; }
    e.preventDefault(); e.stopPropagation();
    if (open && open.btn === b) { closeTip(); return; }
    closeTip();
    var pop = document.createElement('div');
    pop.className = 'tip-pop'; pop.setAttribute('role', 'tooltip'); pop.id = 'tip-' + b.dataset.tip;
    pop.textContent = t(GLOSS[b.dataset.tip] || '');
    document.body.appendChild(pop);
    var r = b.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 32);
    pop.style.width = w + 'px';
    var left = Math.max(16, Math.min(window.innerWidth - w - 16, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 10 + window.scrollY;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-describedby', pop.id);
    open = { btn: b, pop: pop };
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTip(); });
  window.addEventListener('scroll', function () { if (open && Math.abs(open.btn.getBoundingClientRect().top) > window.innerHeight) closeTip(); }, { passive: true });

  /* ---------- Planner: live answer docked on phones while adjusting ---------- */
  $$('[data-tool="planner"]').forEach(function (tool) {
    var dock = $('.pl-dock', tool), form = $('.pl-controls', tool), verdict = $('.pl-verdict', tool), result = $('.pl-result', tool);
    if (!dock || !('IntersectionObserver' in window)) return;
    var sync = function () {
      $('.pl-dock-v', dock).textContent = clean(verdict.textContent);
      var dark = /lights go out|se apagan/i.test(verdict.textContent);
      dock.classList.toggle('bad', dark);
    };
    new MutationObserver(sync).observe(verdict, { childList: true, characterData: true, subtree: true });
    sync();
    var queued = false;
    var upd = function () {
      queued = false;
      var vh = window.innerHeight, f = form.getBoundingClientRect(), r = result.getBoundingClientRect();
      var on = f.top < vh * 0.75 && f.bottom > vh * 0.35 && r.top > vh * 0.85;
      dock.classList.toggle('show', on);
    };
    var q = function () { if (!queued) { queued = true; requestAnimationFrame(upd); } };
    window.addEventListener('scroll', q, { passive: true }); window.addEventListener('resize', q); upd();
    dock.addEventListener('click', function () { result.scrollIntoView({ behavior: 'auto', block: 'start' }); });
  });
})();

/* Customer stories: one featured story at a time, a strip of every customer, filters by type. */
(function () {
  'use strict';
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  $$('[data-voices]').forEach(function (sec) {
    var stories = $$('.vx-story', sec), people = $$('.vx-person', sec), filters = $$('[data-vf]', sec);
    var cur = null, filt = sec.getAttribute('data-filter') || 'all';
    var visible = function () { return people.filter(function (p) { return filt === 'all' || p.getAttribute('data-seg') === filt; }); };
    function show(k, focusStrip) {
      cur = k;
      stories.forEach(function (s) { var on = s.getAttribute('data-k') === k; s.hidden = !on; if (on) { s.classList.remove('open'); var m = s.querySelector('.vx-more'); if (m) { m.setAttribute('aria-expanded', 'false'); m.textContent = t('Read the full story'); } } });
      people.forEach(function (p) {
        var on = p.getAttribute('data-k') === k; p.setAttribute('aria-pressed', String(on));
        if (on && focusStrip !== false) { var strip = p.parentNode, l = p.offsetLeft - strip.clientWidth / 2 + p.offsetWidth / 2; strip.scrollTo({ left: Math.max(0, l), behavior: 'auto' }); }
      });
    }
    function setFilter(f) {
      filt = f;
      filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-vf') === f)); });
      var vis = visible();
      people.forEach(function (p) { p.hidden = vis.indexOf(p) < 0; });
      if (!vis.some(function (p) { return p.getAttribute('data-k') === cur; })) show(vis[0].getAttribute('data-k'));
    }
    function step(d) {
      var vis = visible(), i = vis.findIndex(function (p) { return p.getAttribute('data-k') === cur; });
      show(vis[(i + d + vis.length) % vis.length].getAttribute('data-k'));
    }
    sec.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('.vx-person'))) return show(b.getAttribute('data-k'));
      if ((b = e.target.closest('[data-vf]'))) return setFilter(b.getAttribute('data-vf'));
      if (e.target.closest('.vx-prev')) return step(-1);
      if (e.target.closest('.vx-next')) return step(1);
      if ((b = e.target.closest('.vx-alt'))) {
        // swap the two photos
        var main = b.parentNode.querySelector('.vx-main'), alt = b.querySelector('img'), src = main.src;
        main.src = alt.src; alt.src = src; return;
      }
      if ((b = e.target.closest('.vx-more'))) {
        var st = b.closest('.vx-story'), open = !st.classList.contains('open');
        st.classList.toggle('open', open); b.setAttribute('aria-expanded', String(open));
        b.textContent = open ? t('Show less') : t('Read the full story');
      }
    });
    sec.addEventListener('keydown', function (e) {
      if (!e.target.closest('.vx-people') || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1);
      var p = people.filter(function (x) { return x.getAttribute('data-k') === cur; })[0]; if (p) p.focus();
    });
    cur = sec.getAttribute('data-first');
    setFilter(filt); show(cur || visible()[0].getAttribute('data-k'), false);
  });
})();

/* Typography: no single-word last lines, and help buttons never wrap alone.
   Joins the last two words of short text blocks with a no-break space. Works in every browser
   (CSS text-wrap: pretty is not everywhere yet) and runs again after a language switch.
   Every join is measured afterwards and undone if it would push text past its box or the screen. */
(function () {
  'use strict';
  var NB = ' ';
  var SEL = 'h1, h2, h3, h4, p, li, figcaption, blockquote, .label, .lead, .small, .tool-note, .btn, .hx-ev span, .app-points li, dd, dt, legend, label > span:not(:has(small))';
  function lastText(el) {
    // the last non-empty text node that is part of the flowing text (not inside an svg or a help button)
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
      var p = n.parentNode;
      while (p && p !== el) { if (p.nodeName === 'svg' || (p.classList && (p.classList.contains('tipq') || p.classList.contains('arrow') || p.classList.contains('w')))) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
      return NodeFilter.FILTER_ACCEPT;
    } });
    var last = null, n; while ((n = w.nextNode())) last = n; return last;
  }
  function fix(el, done) {
    // hero headlines already have their line breaks set by hand
    if (el.closest('.statement, .hx-tags, .s3-labels, .app-loading, svg, .giant, h1.lines')) return;
    var n = lastText(el); if (!n) return;
    // "3-day", "20-year", "72-hour": a number and its unit never split at the hyphen
    if (/\d-[A-Za-z\u00c0-\u017f]/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(\d)-(?=[A-Za-z\u00c0-\u017f])/g, '$1\u2011');
    var v = n.nodeValue, m = v.match(/^([\s\S]*\S)[ \t\n]+(\S+)(\s*)$/);
    if (!m) return;
    var words = el.textContent.trim().split(/\s+/).length;
    var prev = (m[1].match(/(\S+)$/) || ['', ''])[1];
    if (words < 3 || m[2].length + prev.length > 28) return;
    n.nodeValue = m[1] + NB + m[2] + m[3];
    done.push({ el: el, n: n, old: v });
  }
  function glueHelp(q, done) {
    // a no-break space before the help button keeps it on the line with the word before it
    var t = q.previousSibling;
    if (t && t.nodeType === 3 && /[ \t\n]$/.test(t.nodeValue)) { var old = t.nodeValue, v = old.replace(/\s+$/, ''); if (v) { t.nodeValue = v + NB; done.push({ el: q.parentNode, n: t, old: old }); } }
  }
  function verify(done) {
    if (!done.length) return;
    // one layout pass: read every changed block, then undo the joins that overflow
    var vw = document.documentElement.clientWidth;
    var bad = done.filter(function (d) {
      var el = d.el; if (!el.isConnected || !el.offsetParent) return false;
      // measure the block and its own container (cards in a swipe row are allowed to sit off screen)
      var par = el.parentNode;
      return el.getBoundingClientRect().width > vw || el.scrollWidth > el.clientWidth + 1 || (par && par.scrollWidth > par.clientWidth + 1);
    });
    bad.forEach(function (d) { if (d.n.isConnected) d.n.nodeValue = d.old; });
  }
  function run(root) {
    root = root || document; var done = [];
    Array.prototype.forEach.call(root.querySelectorAll(SEL), function (el) { fix(el, done); });
    Array.prototype.forEach.call(root.querySelectorAll('.tipq'), function (q) { glueHelp(q, done); });
    verify(done);
  }
  run();
  document.addEventListener('ova:lang', function () { setTimeout(run, 30); });
  // tools rewrite verdicts, tips and timelines as you change inputs: tidy those too
  if ('MutationObserver' in window) {
    var queue = [], pending = false;
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target; if (t.nodeType !== 1 || t.closest('.hx-tags, .s3-labels, svg, .statement')) continue;
        queue.push(t);
      }
      if (!pending && queue.length) { pending = true; requestAnimationFrame(function () {
        pending = false; var q = queue.splice(0), done = [];
        q.forEach(function (t) { if (t.matches(SEL)) fix(t, done); else if (t.children.length) Array.prototype.forEach.call(t.querySelectorAll(SEL), function (el) { fix(el, done); }); });
        verify(done);
      }); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.OvaTypo = run;
})();

/* Outage control room: the live readout beside the 3D house. Everything is read from the
   planner's own simulation, so the window, the page and the 3D scene always agree. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var kw = function (v) { return v < 0.995 ? Math.round(v * 1000) + ' W' : f1(v) + ' kW'; };
  var m = document.getElementById('app-house'), pl = $('.planner');
  if (!m || !pl || !pl._planner || !window.OvaModel) return;
  var P = pl._planner, L = window.OvaModel.LOADS, SH = window.OvaModel.SHAPES;
  var on = false, sig = '', evs = [];

  function when(p) {
    var hr = Math.floor(p.clock % 24), mn = Math.round((p.clock % 1) * 60);
    var h12 = hr % 12 === 0 ? 12 : hr % 12;
    return { day: Math.floor((p.t + 18) / 24) + 1, time: h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + (hr >= 12 ? 'pm' : 'am') };
  }
  function stamp(p) { var w = when(p); return t('Day {d} · {time}', { d: w.day, time: w.time }); }

  // the moments that matter, read off the simulation
  function events(S) {
    var out = [{ i: 0, k: 'bad', txt: t('The grid goes down. The house switches to the battery without a flicker.') }];
    var sunWas = S[0].sun > 0.05, darkWas = false, fullWas = true, low = null;
    for (var i = 1; i < S.length; i++) {
      var p = S[i], sun = p.sun > 0.05, full = p.pct >= 0.999;
      if (!sun && (!low || p.pct < low.pct)) low = { i: i, pct: p.pct };
      if (sun && !sunWas) {
        if (low && low.pct > 0) out.push({ i: low.i, k: 'low', txt: t('Lowest point of the night: {n}% left.', { n: Math.round(low.pct * 100) }) });
        out.push({ i: i, k: 'sun', txt: t('Sunrise. The panels start carrying the house.') }); low = null;
      }
      if (!sun && sunWas) out.push({ i: i, k: 'set', txt: p.dark ? t('Sunset, with nothing left in the battery.') : t('Sunset. The battery takes over for the night.') });
      if (p.dark && !darkWas) out.push({ i: i, k: 'bad', txt: t('Battery empty. The lights go out.') });
      if (!p.dark && darkWas) out.push({ i: i, k: 'sun', txt: t('The sun brings the power back.') });
      if (full && !fullWas) out.push({ i: i, k: 'good', txt: t('Battery full again. Spare solar has nowhere to go.') });
      sunWas = sun; darkWas = p.dark; fullWas = full;
    }
    out.push({ i: S.length - 1, k: S[S.length - 1].dark ? 'bad' : 'good', txt: S[S.length - 1].dark ? t('Hour 72: still waiting on the grid, in the dark.') : t('Hour 72: still running, with {n}% in the battery.', { n: Math.round(S[S.length - 1].pct * 100) }) });
    return out.sort(function (a, b) { return a.i - b.i; });
  }

  function strip(S) {
    var svg = $('.hx-strip', m), n = S.length - 1, x = function (i) { return (i / n * 1000).toFixed(1); }, h = '';
    var run = null;
    S.forEach(function (p, i) {
      var night = p.sun <= 0.05;
      if (night && run === null) run = i;
      if ((!night || i === n) && run !== null) { h += '<rect class="n" x="' + x(run) + '" y="0" width="' + (x(i) - x(run)) + '" height="56"/>'; run = null; }
    });
    var d = 'M0 56';
    S.forEach(function (p, i) { d += ' L' + x(i) + ' ' + (54 - p.pct * 48).toFixed(1); });
    h += '<path class="b" d="' + d + ' L1000 56 Z"/>';
    S.forEach(function (p, i) { if (p.dark) h += '<rect class="o" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.6).toFixed(1) + '" height="56"/>'; });
    evs.forEach(function (e) { if (e.i > 0 && e.i < n) h += '<line class="e e-' + e.k + '" x1="' + x(e.i) + '" x2="' + x(e.i) + '" y1="0" y2="8"/>'; });
    svg.innerHTML = h;
  }

  function full() {
    var st = P.state(), S = st.r.series, o = st.o;
    evs = events(S);
    strip(S);
    $('.hx-scrub', m).max = S.length - 1;
    $('.hx-events', m).innerHTML = evs.map(function (e, j) {
      return '<li><button type="button" class="hx-ev hx-ev-' + e.k + '" data-i="' + e.i + '" data-j="' + j + '"><time>' + stamp(S[e.i]) + '</time><span>' + e.txt + '</span></button></li>';
    }).join('');
    $('.hx-verdict', m).textContent = P.verdict();
    var tip = P.tip(); $('.hx-tip', m).textContent = tip; $('.hx-tip', m).hidden = !tip;
    $$('.hx-seg', m).forEach(function (g) {
      var cur = $('input[name="' + g.getAttribute('data-tune') + '"]:checked', P.form).value;
      $$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === cur)); });
    });
    $('[data-hx="solar"]', m).textContent = o.kwp + ' kW';
    sig = '';
    frame();
  }

  function frame() {
    if (!on) return;
    var st = P.state(), S = st.r.series, o = st.o, i = P.idx(), p = S[i];
    var w = when(p);
    $('.hx-time', m).textContent = stamp(p);
    $('.hx-hour', m).textContent = t('Hour {h} of the outage', { h: Math.floor(p.t) });
    $('.hx-scrub', m).value = i;
    $('.hx-track', m).style.setProperty('--at', (i / (S.length - 1) * 100).toFixed(2) + '%');

    // status
    var sun = p.sun > 0.05, k, title, line;
    if (p.dark) { k = 'bad'; title = t('Power out'); line = sun ? t('The battery is empty and the sun can’t cover the house yet.') : t('The battery is empty. Power returns when the sun comes up.'); }
    else if (sun && p.sun >= p.load) { k = 'sun'; title = t('Running on sunshine'); line = p.pct < 0.999 ? t('Solar covers the whole house and refills the battery.') : t('Solar covers the whole house. The battery is full.'); }
    else if (sun) { k = 'mix'; title = t('Sun plus battery'); line = t('Solar covers {n}% of the house. The battery covers the rest.', { n: Math.round(p.sun / p.load * 100) }); }
    else { k = 'base'; title = t('Running on the battery'); line = t('The street is dark. Your house isn’t.'); }
    var stEl = $('.hx-status', m); stEl.className = 'hx-status hx-' + k;
    $('b', stEl).textContent = title; $('p', stEl).textContent = line;

    // battery
    var pct = Math.round(p.pct * 100);
    $('.hx-batt-v b', m).textContent = pct + '%';
    var ring = $('.hx-ring', m); ring.style.strokeDashoffset = String(100 - p.pct * 100); ring.classList.toggle('low', p.pct < 0.15);
    $('[data-hx="kwh"]', m).textContent = t('{a} of {b} kWh', { a: f1(p.soc), b: o.cap });
    var net = p.load - p.sun, left;
    if (p.dark) left = t('Empty');
    else if (net > 0.01) { var hrs = p.soc / net; left = hrs >= 48 ? t('2 days or more') : hrs >= 1 ? t('About {n} h at this rate', { n: Math.round(hrs) }) : t('Under an hour'); }
    else left = p.pct >= 0.999 ? t('Full') : t('Charging +{kw}', { kw: kw(-net) });
    $('[data-hx="left"]', m).textContent = left;

    // flows
    var direct = Math.min(p.sun, p.load), toB = p.sun > p.load && p.pct < 0.999 ? p.sun - p.load : 0;
    var spare = p.sun > p.load && p.pct >= 0.999 ? p.sun - p.load : 0;
    var fromB = p.dark ? 0 : Math.max(0, p.load - p.sun), unmet = p.dark ? Math.max(0, p.load - p.sun) : 0;
    var F = { sh: p.dark ? 0 : direct, sb: toB, bh: fromB, sp: spare, un: unmet }, max = Math.max(1, p.load, p.sun);
    Object.keys(F).forEach(function (f) {
      var row = $('[data-f="' + f + '"]', m), v = F[f];
      row.classList.toggle('zero', v < 0.01);
      $('s', row).style.width = (v / max * 100).toFixed(1) + '%';
      $('b', row).textContent = v < 0.01 ? '—' : kw(v);
    });

    // loads running right now
    var hr = Math.floor(p.clock % 24), key = o.keys.join() + '|' + hr + '|' + p.dark;
    if (key !== sig) {
      sig = key;
      var rows = o.keys.map(function (k) { return { k: k, v: L[k].avg * SH[L[k].shape][hr] }; }).sort(function (a, b) { return b.v - a.v; });
      var top = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([0.1]));
      $('.hx-loads', m).innerHTML = rows.length ? rows.map(function (r) {
        var idle = r.v < 0.02, cls = p.dark ? 'off' : idle ? 'idle' : '';
        var val = p.dark ? t('No power') : idle ? t('Not running now') : kw(r.v);
        return '<li class="' + cls + '"><span>' + t(L[r.k].name) + (r.k === 'medical' ? ' <em>' + t('Priority') + '</em>' : '') + '</span><i><s style="width:' + (p.dark || idle ? 0 : r.v / top * 100).toFixed(0) + '%"></s></i><b>' + val + '</b></li>';
      }).join('') : '<li class="idle"><span>' + t('Nothing selected') + '</span></li>';
    }
    // highlight the latest moment reached
    var cur = -1; evs.forEach(function (e, j) { if (e.i <= i) cur = j; });
    $$('.hx-ev', m).forEach(function (b) { var j = Number(b.getAttribute('data-j')); b.classList.toggle('now', j === cur); b.classList.toggle('past', j < cur); });
    syncPlay();
  }

  function syncPlay() {
    var b = $('[data-house-play]', m), playing = P.playing();
    b.setAttribute('aria-pressed', String(playing));
    b.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
    $('path', b).setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
  }
  function setSpeed(v) {
    P.setSpeed(v);
    $$('[data-speed]', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === v)); });
  }

  var lastSt = null;
  P.on(function () { if (!on) return; if (P.state() !== lastSt) { lastSt = P.state(); full(); } else frame(); });

  m.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-house-play]'))) { P.setPlay(!P.playing()); syncPlay(); return; }
    if ((b = e.target.closest('[data-speed]'))) { setSpeed(Number(b.getAttribute('data-speed'))); if (!P.playing()) { P.setPlay(true); syncPlay(); } return; }
    if ((b = e.target.closest('.hx-ev'))) { P.setPlay(false); P.seek(Number(b.getAttribute('data-i'))); syncPlay(); return; }
    if ((b = e.target.closest('.hx-seg button'))) {
      var name = b.parentNode.getAttribute('data-tune'), inp = $('input[name="' + name + '"][value="' + b.getAttribute('data-v') + '"]', P.form);
      if (inp && !inp.checked) { inp.checked = true; P.form.dispatchEvent(new Event('change', { bubbles: true })); }
      return;
    }
    if ((b = e.target.closest('[data-solar]'))) {
      var r = $('#pl-solar', P.form), v = Math.max(0, Math.min(15, Number(r.value) + Number(b.getAttribute('data-solar'))));
      if (v !== Number(r.value)) { r.value = v; P.form.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  });
  $('.hx-scrub', m).addEventListener('input', function (e) { P.setPlay(false); P.seek(Number(e.target.value)); syncPlay(); });
  document.addEventListener('ova:lang', function () { if (on) full(); });

  window.OvaHouseApp = {
    start: function () { on = true; lastSt = P.state(); setSpeed(0.3); full(); },
    stop: function () { on = false; P.setSpeed(0.6); }
  };
})();

/* Town control room: a day on one feeder. Normal day = the battery yard shaves the afternoon
   peak and recharges overnight. Storm = the feeder trips and critical sites island on the
   battery until crews restore power. Opens in an app window; nothing runs until it does. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var m = document.getElementById('app-town'), ps = $('.ps[data-tool="peak"]');
  if (!m || !ps) return;

  var FEED = [0.55, 0.51, 0.48, 0.47, 0.47, 0.5, 0.56, 0.63, 0.68, 0.73, 0.78, 0.83, 0.88, 0.93, 0.97, 0.99, 1, 0.98, 0.94, 0.88, 0.8, 0.72, 0.65, 0.6];
  var CRIT = 0.08; // share of town load at the critical sites
  var SITES = [
    { k: 'hospital', name: 'Hospital', share: 0.34 },
    { k: 'water', name: 'Water plant', share: 0.3 },
    { k: 'fire', name: 'Fire and police', share: 0.12 },
    { k: 'shelter', name: 'Storm shelter', share: 0.24 }
  ];
  var opt = { scen: 'day', storm: 6 };

  function read() {
    return { peak: Number($('#ps-peak', ps).value), pct: Number($('#ps-pow', ps).value) / 100, dur: Number($('input[name="ps-dur"]:checked', ps).value), rate: Number($('#ps-rate', ps).value), scen: opt.scen, storm: opt.storm };
  }
  function shave(L, P, E) {
    var lo = Math.min.apply(null, L), hi = Math.max.apply(null, L);
    for (var it = 0; it < 50; it++) {
      var T = (lo + hi) / 2, ok = true, need = 0;
      L.forEach(function (l) { var x = l - T; if (x > P + 1e-9) ok = false; if (x > 0) need += x; });
      if (ok && need <= E) hi = T; else lo = T;
    }
    return hi;
  }
  function interp(arr, h) { var a = Math.floor(h) % 24, b = (a + 1) % 24, k = h - Math.floor(h); return arr[a] * (1 - k) + arr[b] * k; }

  function simulate(o) {
    var P = o.peak * o.pct, E = P * o.dur, L = FEED.map(function (f) { return f * o.peak; });
    var T = P > 0 ? shave(L, P, E) : o.peak;
    var needE = L.reduce(function (s, l) { return s + Math.max(0, l - T); }, 0) / 0.9;
    var order = L.map(function (l, i) { return i; }).sort(function (a, b) { return L[a] - L[b]; });
    var charge = L.map(function () { return 0; });
    order.forEach(function (i) { if (needE <= 0) return; var room = Math.min(P, T - L[i]); if (room <= 0) return; var c = Math.min(room, needE); charge[i] = c; needE -= c; });
    var S = [], dt = 0.25, soc, a = 14, b = 14 + o.storm;
    if (o.scen === 'day') {
      var firstDis = 0; for (var h0 = 0; h0 < 24; h0++) if (L[h0] > T + 1e-6) { firstDis = h0; break; }
      var pre = 0; for (var h1 = 0; h1 < firstDis; h1++) pre += charge[h1] * 0.9;
      soc = clamp(E - pre, 0, E);
    } else soc = E;
    var critLeft = null, firstOut = null;
    for (var i = 0; i <= 96; i++) {
      var hr = i * dt, load = interp(L, hr), hh = Math.floor(hr) % 24, p = { t: hr, load: load, grid: load, dis: 0, ch: 0, crit: load * CRIT, out: false, critOn: true };
      if (o.scen === 'day') {
        p.dis = Math.min(P, Math.max(0, load - T), soc / dt);
        p.ch = load <= T ? Math.min(charge[hh], (E - soc) / 0.9 / dt) : 0;
        p.grid = load - p.dis + p.ch;
      } else if (hr >= a && hr < b) {
        p.out = true; p.grid = 0;
        p.dis = Math.min(P, p.crit, soc / dt);
        p.critOn = p.dis >= p.crit * 0.999 && P > 0;
        if (!p.critOn) { p.dis = 0; if (firstOut === null) firstOut = hr; }
      } else if (hr >= b) {
        p.ch = Math.min(P, (E - soc) / 0.9 / dt, Math.max(0, T - load) + P * 0.5);
        p.grid = load + p.ch;
      }
      if (i > 0) { soc = clamp(soc - p.dis * dt + p.ch * dt * 0.9, 0, E); }
      p.soc = soc; p.pct = E > 0 ? soc / E : 0;
      S.push(p);
    }
    var newPeak = 0; S.forEach(function (p) { if (!p.out) newPeak = Math.max(newPeak, p.grid); });
    if (o.scen === 'storm') critLeft = firstOut === null ? o.storm : firstOut - a;
    var cust = Math.round(o.peak * 1000 / 3.4 / 100) * 100;
    return { S: S, P: P, E: E, T: T, L: L, newPeak: o.scen === 'day' ? newPeak : null, peak: o.peak, cust: cust, critHours: critLeft, firstOut: firstOut, a: a, b: b,
      save: (o.peak - Math.min(o.peak, newPeak)) * 1000 * o.rate * 12 };
  }

  /* ---------- 3D town ---------- */
  function town3d(stage) {
    var T = window.THREE, wrap = $('.pl-canvas', stage);
    var coarse = matchMedia('(pointer: coarse)').matches;
    var renderer = new T.WebGLRenderer({ antialias: !coarse, alpha: true });
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    wrap.appendChild(renderer.domElement);
    var scene = new T.Scene(), cam = new T.PerspectiveCamera(30, 1, 0.5, 400);
    var target = new T.Vector3(-4, 0, 1), angle = 0.55, elev = 0.62, dist = 82;
    var hemi = new T.HemisphereLight(0xdfefff, 0x1a2430, 0.5); scene.add(hemi); scene.add(new T.AmbientLight(0xffffff, 0.22));
    var sun = new T.DirectionalLight(0xfff1d6, 1); scene.add(sun);
    var M = function (c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0.05 }, o || {})); };
    var ground = new T.Mesh(new T.CircleGeometry(95, 96), M(0x0f171f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var roadMat = M(0x222c36);
    [[0, 0, 74, 3], [-8, 0, 2.4, 44], [8, 0, 2.4, 44]].forEach(function (r) { var g = new T.Mesh(new T.PlaneGeometry(r[2], r[3]), roadMat); g.rotation.x = -Math.PI / 2; g.position.set(r[0], 0.02, r[1]); scene.add(g); });

    // critical sites
    var sites = {}, siteGlow = {};
    var winOn = new T.MeshStandardMaterial({ color: 0x18222c, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.4 });
    function site(k, x, z, build) {
      var g = new T.Group(); g.position.set(x, 0, z); build(g); scene.add(g);
      var ring = new T.Mesh(new T.RingGeometry(5.2, 5.6, 64), new T.MeshBasicMaterial({ color: 0x2eadf7, transparent: true, opacity: 0, side: T.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, z); scene.add(ring);
      var mat = winOn.clone(); g.traverse(function (n) { if (n.userData.win) n.material = mat; });
      sites[k] = { g: g, ring: ring, mat: mat, pos: new T.Vector3(x, 0, z) };
    }
    function box(g, w, h, d, c, x, z) { var b = new T.Mesh(new T.BoxGeometry(w, h, d), M(c)); b.position.set(x || 0, h / 2, z || 0); g.add(b); return b; }
    function wins(g, n, w, y, z, span) { for (var i = 0; i < n; i++) { var p = new T.Mesh(new T.PlaneGeometry(w, 0.6), winOn); p.userData.win = true; p.position.set(-span / 2 + span * (i + 0.5) / n, y, z); g.add(p); } }
    site('hospital', -16, -10, function (g) {
      box(g, 8, 4.2, 5, 0xe3e8ec); wins(g, 5, 1, 1.4, 2.51, 7); wins(g, 5, 1, 3, 2.51, 7);
      var c1 = new T.Mesh(new T.BoxGeometry(2.2, 0.1, 0.6), new T.MeshBasicMaterial({ color: 0xef4f43 })); c1.position.set(0, 4.26, 0); g.add(c1);
      var c2 = c1.clone(); c2.rotation.y = Math.PI / 2; g.add(c2);
    });
    site('water', 18, -10, function (g) {
      var tank = new T.Mesh(new T.CylinderGeometry(2, 2, 2.6, 24), M(0xc8d2db, { metalness: 0.3, roughness: 0.5 })); tank.position.y = 7; g.add(tank);
      var top = new T.Mesh(new T.ConeGeometry(2.1, 1, 24), M(0xa7b3be)); top.position.y = 8.8; g.add(top);
      [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(function (l) { var leg = new T.Mesh(new T.CylinderGeometry(0.12, 0.12, 5.8, 6), M(0x7c8791)); leg.position.set(l[0], 2.9, l[1]); g.add(leg); });
      var plant = box(g, 4, 2, 3, 0xb7c2cc, 4.2, 0.5); var w = new T.Mesh(new T.PlaneGeometry(2.6, 0.5), winOn); w.userData.win = true; w.position.set(4.2, 1.2, 2.01); g.add(w);
    });
    site('fire', -16, 11, function (g) {
      box(g, 6, 3, 4.5, 0xc4574e); [-1.5, 1.5].forEach(function (x) { var d = new T.Mesh(new T.PlaneGeometry(2.2, 2), M(0x2a333c)); d.position.set(x, 1, 2.26); g.add(d); });
      wins(g, 3, 0.9, 2.5, -2.26, 5); g.children[g.children.length - 1].rotation.y = Math.PI;
      var w2 = new T.Mesh(new T.PlaneGeometry(4.6, 0.5), winOn); w2.userData.win = true; w2.position.set(0, 2.55, 2.26); g.add(w2);
    });
    site('shelter', 18, 11, function (g) {
      box(g, 9, 3, 5.5, 0xd4c6a8); wins(g, 6, 0.9, 1.7, 2.76, 8);
      var gym = new T.Mesh(new T.CylinderGeometry(2.8, 2.8, 9, 24, 1, false, 0, Math.PI), M(0x8c9aa6)); gym.rotation.z = Math.PI / 2; gym.position.set(0, 3, 0); g.add(gym);
    });

    // homes: instanced bodies, roofs and windows
    var spots = [];
    for (var x = -28; x <= 28; x += 4.4) for (var z = -20; z <= 20; z += 4.6) {
      if (Math.abs(z) < 3.4 || Math.abs(x - 8) < 2.6 || Math.abs(x + 8) < 2.6) continue;
      var near = [[-16, -10, 7.5], [18, -10, 7.5], [-16, 11, 6.5], [18, 11, 7.5]].some(function (s) { return Math.hypot(x - s[0], z - s[1]) < s[2]; });
      if (near || x < -20 && Math.abs(z) < 16) continue;
      if (Math.hypot(x, z) > 34) continue;
      spots.push([x + (Math.sin(x * 7 + z) * 0.4), z]);
    }
    var nH = spots.length, dummy = new T.Object3D();
    var bodyI = new T.InstancedMesh(new T.BoxGeometry(2.6, 1.7, 2.4), M(0xaeb8c1), nH);
    var roofI = new T.InstancedMesh(new T.ConeGeometry(2.1, 1.2, 4), M(0x39434c), nH);
    var homeWin = new T.MeshStandardMaterial({ color: 0x18222c, emissive: 0xffd9a0, emissiveIntensity: 0 });
    var winI = new T.InstancedMesh(new T.PlaneGeometry(1.5, 0.55), homeWin, nH);
    spots.forEach(function (s, i) {
      var face = s[1] > 0 ? -1 : 1;
      dummy.position.set(s[0], 0.85, s[1]); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); bodyI.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s[0], 2.3, s[1]); dummy.rotation.set(0, Math.PI / 4, 0); dummy.updateMatrix(); roofI.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s[0], 0.95, s[1] + face * 1.21); dummy.rotation.set(0, face > 0 ? 0 : Math.PI, 0); dummy.updateMatrix(); winI.setMatrixAt(i, dummy.matrix);
    });
    scene.add(bodyI, roofI, winI);

    // substation and battery yard
    var sx = -30, sz = -2;
    var pad = new T.Mesh(new T.PlaneGeometry(9, 9), M(0x3a444e)); pad.rotation.x = -Math.PI / 2; pad.position.set(sx, 0.03, sz); scene.add(pad);
    for (var k = 0; k < 3; k++) { var tr = new T.Mesh(new T.BoxGeometry(1.6, 2, 1.4), M(0x8a96a1, { metalness: 0.4, roughness: 0.5 })); tr.position.set(sx - 2.5 + k * 2.5, 1, sz - 1.5); scene.add(tr); }
    var gantry = new T.Mesh(new T.BoxGeometry(7, 0.25, 0.25), M(0x9aa5af)); gantry.position.set(sx, 5, sz + 2); scene.add(gantry);
    [-3.4, 3.4].forEach(function (d) { var pz = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 5, 8), M(0x9aa5af)); pz.position.set(sx + d, 2.5, sz + 2); scene.add(pz); });
    var fault = new T.Mesh(new T.SphereGeometry(0.4, 14, 14), new T.MeshBasicMaterial({ color: 0xef4f43 })); fault.position.set(sx, 5.6, sz + 2); fault.visible = false; scene.add(fault);
    var yard = [], gaugeMat = new T.MeshBasicMaterial({ color: 0x2eadf7 });
    for (var c = 0; c < 4; c++) {
      var ct = new T.Mesh(new T.BoxGeometry(4.2, 1.9, 1.7), M(0xe7ebef, { roughness: 0.45 })); ct.position.set(-31.5 + (c % 2) * 5, 0.95, 9 + Math.floor(c / 2) * 2.6); scene.add(ct);
      var gauge = new T.Mesh(new T.PlaneGeometry(3.6, 0.22), gaugeMat); gauge.position.set(ct.position.x, 1.5, ct.position.z + 0.86); scene.add(gauge); yard.push(gauge);
    }
    var lineMat = new T.LineBasicMaterial({ color: 0x5d6a76 });
    function wire(a, b, sag) { var mid = a.clone().lerp(b, 0.5); mid.y -= sag; scene.add(new T.Line(new T.BufferGeometry().setFromPoints(new T.QuadraticBezierCurve3(a, mid, b).getPoints(20)), lineMat)); }
    var poleMat = M(0x5b4a3b);
    var prev = new T.Vector3(sx + 3.4, 5, sz + 2);
    for (var px = -22; px <= 30; px += 6.5) {
      var pole = new T.Mesh(new T.CylinderGeometry(0.12, 0.15, 5, 6), poleMat); pole.position.set(px, 2.5, -2.2); scene.add(pole);
      var top2 = new T.Vector3(px, 5, -2.2); wire(prev, top2, 0.4); prev = top2;
    }
    wire(new T.Vector3(sx - 3.4, 5, sz + 2), new T.Vector3(-90, 9, sz + 6), 1.2);

    // energy particles
    var curves = {
      grid: new T.CatmullRomCurve3([new T.Vector3(sx + 3, 1.4, sz + 0.5), new T.Vector3(-14, 1, 0), new T.Vector3(0, 1, 0), new T.Vector3(14, 1, 0), new T.Vector3(30, 1, 0)]),
      dis: new T.QuadraticBezierCurve3(new T.Vector3(-29, 2.2, 9), new T.Vector3(-26, 4, 5), new T.Vector3(sx + 2, 1.8, sz + 1)),
      ch: new T.QuadraticBezierCurve3(new T.Vector3(sx + 2, 1.8, sz + 1), new T.Vector3(-26, 4, 5), new T.Vector3(-29, 2.2, 9))
    };
    SITES.forEach(function (s) { var p = sites[s.k].pos; curves['c_' + s.k] = new T.QuadraticBezierCurve3(new T.Vector3(-29, 2.2, 10), new T.Vector3((p.x - 29) / 2, 9, (p.z + 10) / 2), new T.Vector3(p.x, 2.4, p.z)); });
    var dotGeo = new T.SphereGeometry(0.28, 10, 10);
    var colors = { grid: 0xdfe9f3, dis: 0x2eadf7, ch: 0x6fdba0 };
    var parts = [];
    Object.keys(curves).forEach(function (k) {
      var mat = new T.MeshBasicMaterial({ color: colors[k] || 0x2eadf7 }), n = k === 'grid' ? 30 : 12;
      for (var i = 0; i < n; i++) { var d = new T.Mesh(dotGeo, mat); d.userData = { k: k, o: i / n }; d.visible = false; scene.add(d); parts.push(d); }
    });
    var rate = {};

    // labels
    var tagLayer = document.createElement('div'); tagLayer.className = 'hx-tags'; stage.appendChild(tagLayer);
    function mk(k, pos) { var e = document.createElement('span'); e.className = 'hx-tag'; e.setAttribute('data-k', k); e.innerHTML = '<i></i><b></b><em></em>'; tagLayer.appendChild(e); return { el: e, pos: pos, w: 0 }; }
    var tags = { sub: mk('sub', new T.Vector3(sx, 7.4, sz)), yard: mk('yard', new T.Vector3(-29, 4.2, 10.5)), homes: mk('homes', new T.Vector3(2, 4.4, 12)) };
    SITES.forEach(function (s) { var p = sites[s.k].pos; tags[s.k] = mk(s.k, new T.Vector3(p.x, s.k === 'water' ? 10.6 : 6, p.z)); });
    function tag(k, a, b, cls) { var g = tags[k]; g.el.children[1].textContent = a; g.el.children[2].textContent = b; g.el.className = 'hx-tag' + (cls ? ' ' + cls : ''); g.w = 0; }
    var pv = new T.Vector3();
    function placeTags() {
      var w = wrap.clientWidth, h = wrap.clientHeight;
      var list = [];
      Object.keys(tags).forEach(function (k) {
        var g = tags[k]; if (g.el.offsetParent === null) return;
        pv.copy(g.pos).project(cam);
        var hw = (g.w || (g.w = g.el.offsetWidth)) / 2 + 6;
        list.push({ g: g, x: clamp((pv.x + 1) / 2 * w, hw, w - hw), y: Math.max(40, (1 - pv.y) / 2 * h), hw: hw, hide: pv.z > 1 });
      });
      // nudge overlapping labels apart, top to bottom
      list.sort(function (a, b) { return a.y - b.y; });
      for (var i = 0; i < list.length; i++) for (var j = 0; j < i; j++) {
        var a = list[i], b = list[j];
        if (Math.abs(a.x - b.x) < a.hw + b.hw - 8 && a.y - b.y < 30) a.y = b.y + 30;
      }
      list.forEach(function (o) { o.g.el.style.opacity = o.hide ? 0 : ''; o.g.el.style.transform = 'translate(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px)'; });
    }

    function themeColors() {
      var th = document.documentElement.getAttribute('data-theme'), lt = th ? th === 'light' : matchMedia('(prefers-color-scheme: light)').matches; if (stage.closest('.mc')) lt = false;
      ground.material.color.set(lt ? 0xdfe6ec : 0x0f171f); roadMat.color.set(lt ? 0xc3ccd4 : 0x222c36); pad.material.color.set(lt ? 0xb4bec8 : 0x3a444e);
      hemi.groundColor.set(lt ? 0xb8c4cf : 0x1a2430);
    }
    themeColors();
    var mo = new MutationObserver(themeColors); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function set(p, r) {
      var h = p.t % 24, dayK = h > 6 && h < 20 ? Math.sin(Math.PI * (h - 6) / 14) : 0;
      var az = Math.PI * ((h - 6) / 14) - Math.PI / 2;
      sun.position.set(Math.sin(az) * 40, 6 + dayK * 50, 25); sun.intensity = 0.15 + dayK * 1.05; hemi.intensity = 0.35 + dayK * 0.5;
      stage.style.setProperty('--day', dayK.toFixed(3));
      var night = 1 - dayK * 0.85, lf = p.load / r.peak;
      homeWin.emissiveIntensity = p.out ? 0 : night * (0.35 + lf * 0.9);
      SITES.forEach(function (s) {
        var on = !p.out || p.critOn, st = sites[s.k];
        st.mat.emissiveIntensity = on ? night * 1.1 + 0.1 : 0;
        st.ring.material.opacity = p.out ? (on ? 0.7 : 0.25) : 0;
        st.ring.material.color.set(on ? 0x2eadf7 : 0xef4f43);
      });
      fault.visible = p.out;
      yard.forEach(function (g) { g.scale.x = Math.max(0.001, p.pct); g.position.x = g.userData.x0 === undefined ? (g.userData.x0 = g.position.x) : g.userData.x0; g.position.x = g.userData.x0 - 1.8 * (1 - p.pct); });
      gaugeMat.color.set(p.pct < 0.15 ? 0xef4f43 : 0x2eadf7);
      rate = { grid: p.out ? 0 : p.grid / r.peak * 3, dis: !p.out ? p.dis / Math.max(0.1, r.P) * 2 : 0, ch: p.ch / Math.max(0.1, r.P) * 2 };
      SITES.forEach(function (s) { rate['c_' + s.k] = p.out && p.critOn ? 1.2 : 0; });
      var mw = function (v) { return f1(v) + ' MW'; };
      tag('sub', t('Substation'), p.out ? t('feeder tripped') : mw(p.grid), p.out ? 'bad' : 'on');
      var flow = p.dis > 0.01 ? ' ↓ ' + mw(p.dis) : p.ch > 0.01 ? ' ↑ ' + mw(p.ch) : '';
      tag('yard', t('Battery yard'), Math.round(p.pct * 100) + '%' + flow, p.pct < 0.15 ? 'bad' : 'on');
      tag('homes', t('Homes and businesses'), p.out ? t('dark') : t('on the grid'), p.out ? 'bad' : 'idle');
      SITES.forEach(function (s) { tag(s.k, t(s.name), p.out ? (p.critOn ? t('on battery') : t('dark')) : t('on the grid'), p.out ? (p.critOn ? 'on' : 'bad') : 'idle'); });
    }
    var clock = 0, last = performance.now(), drag = null, dead = false, raf = 0;
    function render(dt) {
      clock += dt;
      parts.forEach(function (d) {
        var rt = rate[d.userData.k] || 0; d.visible = rt > 0.03; if (!d.visible) return;
        d.position.copy(curves[d.userData.k].getPoint((d.userData.o + clock * (0.05 + Math.min(rt, 3) * 0.04)) % 1));
      });
      fault.material.color.setHex(Math.floor(clock * 2) % 2 ? 0x5a1d1a : 0xef4f43);
      if (!drag && !calm) angle += dt * 0.02;
      cam.position.set(target.x + Math.sin(angle) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(angle) * dist * Math.cos(elev));
      cam.lookAt(target); renderer.render(scene, cam); placeTags();
    }
    function tick(now) { if (dead) return; var dt = clamp((now - last) / 1000, 0, 0.05); last = now; render(calm ? 0 : dt); raf = requestAnimationFrame(tick); }
    function size() { var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = Math.min(52, 30 * Math.max(1, 1.6 / (w / h))); cam.updateProjectionMatrix(); }
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, a: angle, e: elev }; el.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
    el.addEventListener('pointermove', function (e) { if (!drag) return; angle = drag.a - (e.clientX - drag.x) * 0.007; elev = clamp(drag.e + (e.clientY - drag.y) * 0.004, 0.2, 1.2); });
    var end = function () { drag = null; stage.classList.remove('dragging'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    var ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null; if (ro) ro.observe(wrap);
    window.addEventListener('resize', size); size();
    stage.classList.add('has3d');
    raf = requestAnimationFrame(tick);
    return {
      set: set,
      dispose: function () {
        dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', size);
        scene.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(function (x) { x.dispose(); }); });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (el.parentNode) el.parentNode.removeChild(el); if (tagLayer.parentNode) tagLayer.parentNode.removeChild(tagLayer);
        stage.classList.remove('has3d');
      }
    };
  }

  /* ---------- the control room ---------- */
  var st = null, idx = 0, playing = false, speed = 0.15, raf = 0, scene = null, on = false, sig = '';
  var stage = $('.tx-scene', m);
  function clockOf(h) { h = h % 24; var hr = Math.floor(h), mn = Math.round((h % 1) * 60), h12 = hr % 12 === 0 ? 12 : hr % 12; return h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + (hr >= 12 ? 'pm' : 'am'); }
  function stamp(p) { return p.t >= 24 ? t('Midnight') : clockOf(p.t); }

  function events(r, o) {
    var S = r.S, out = [], E = [];
    if (o.scen === 'day') {
      var firstCh = -1, firstDis = -1, lastDis = -1, pk = 0, pkI = 0;
      S.forEach(function (p, i) { if (p.ch > 0.01 && firstCh < 0 && p.t < 12) firstCh = i; if (p.dis > 0.01) { if (firstDis < 0) firstDis = i; lastDis = i; } if (p.load > pk) { pk = p.load; pkI = i; } });
      if (firstCh >= 0) out.push({ i: firstCh, k: 'good', txt: t('Load is at its lowest. The battery yard tops up from the grid.') });
      out.push({ i: 28, k: 'sun', txt: t('Morning ramp. Homes and businesses wake up.') });
      if (firstDis >= 0) out.push({ i: firstDis, k: 'good', txt: t('Load crosses {mw} MW. The battery starts covering the top of the curve.', { mw: f1(r.T) }) });
      out.push({ i: pkI, k: firstDis >= 0 ? 'good' : 'bad', txt: firstDis >= 0 ? t('Peak hour: the town needs {a} MW, the grid only sees {b} MW.', { a: f1(r.peak), b: f1(r.newPeak) }) : t('Peak hour: the full {a} MW lands on the grid.', { a: f1(r.peak) }) });
      if (lastDis >= 0) out.push({ i: lastDis, k: 'set', txt: t('Evening. Load falls below the cap and the battery rests.') });
      out.push({ i: 96, k: 'good', txt: t('Midnight. This kept {cut} MW off the peak, worth about {usd} a year.', { cut: f1(r.peak - r.newPeak), usd: usd(r.save) }) });
    } else {
      out.push({ i: 4, k: 'good', txt: t('Storm watch. The battery yard is held full instead of shaving the peak.') });
      out.push({ i: r.a * 4, k: 'bad', txt: t('The feeder trips. About {n} customers lose power.', { n: r.cust.toLocaleString('en-US') }) });
      out.push({ i: r.a * 4 + 1, k: 'good', txt: t('Hospital, water plant, fire and police, and the shelter island on the battery yard.') });
      if (r.firstOut !== null) out.push({ i: Math.round(r.firstOut * 4), k: 'bad', txt: t('The battery is empty. The critical sites go dark too.') });
      out.push({ i: Math.min(96, r.b * 4), k: 'sun', txt: t('Crews restore the feeder after {n} hours. The town comes back on.', { n: o.storm }) });
      if (r.b < 24) out.push({ i: Math.min(96, r.b * 4 + 2), k: 'good', txt: t('The battery yard recharges, ready for the next one.') });
    }
    return out.sort(function (a, b) { return a.i - b.i; });
  }
  function strip() {
    var S = st.r.S, n = S.length - 1, x = function (i) { return (i / n * 1000).toFixed(1); }, max = st.r.peak * 1.05, h = '';
    S.forEach(function (p, i) { var hh = p.t % 24; if ((hh < 6 || hh >= 20) && i < n) h += '<rect class="n" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; });
    S.forEach(function (p, i) { if (p.out && i < n) h += '<rect class="o" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; });
    var y = function (v) { return (54 - v / max * 48).toFixed(1); };
    var dL = S.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.load); }).join(' ');
    var dG = 'M0 56 ' + S.map(function (p, i) { return 'L' + x(i) + ' ' + y(p.out ? 0 : p.grid); }).join(' ') + ' L1000 56 Z';
    h += '<path class="b" d="' + dG + '"/><path class="l" d="' + dL + '"/>';
    st.ev.forEach(function (e) { if (e.i > 0 && e.i < n) h += '<line class="e e-' + e.k + '" x1="' + x(e.i) + '" x2="' + x(e.i) + '" y1="0" y2="8"/>'; });
    $('.hx-strip', m).innerHTML = h;
  }

  function recompute() {
    var o = read(), r = simulate(o);
    st = { o: o, r: r, ev: events(r, o) };
    strip();
    $('.hx-events', m).innerHTML = st.ev.map(function (e, j) { return '<li><button type="button" class="hx-ev hx-ev-' + e.k + '" data-i="' + e.i + '" data-j="' + j + '"><time>' + stamp(r.S[e.i]) + '</time><span>' + e.txt + '</span></button></li>'; }).join('');
    // tune state
    $$('[data-tx-scen] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === o.scen)); });
    $$('[data-tx-pow] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-v')) === Math.round(o.pct * 100))); });
    $$('[data-tx-dur] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-v')) === o.dur)); });
    $('[data-tx="peak"]', m).textContent = o.peak + ' MW';
    $('[data-tx="storm"]', m).textContent = t('{n} h', { n: o.storm });
    $('.tx-storm-row', m).hidden = o.scen !== 'storm';
    $('[data-tx="batt"]', m).textContent = t('{p} MW for {h} hours = {e} MWh', { p: f1(r.P), h: o.dur, e: f1(r.E) });
    var v = $('.hx-verdict', m);
    if (o.scen === 'day') v.textContent = r.P > 0 ? t('Peak cut from {a} to {b} MW ({pct}%), worth about {usd} a year in peak charges.', { a: f1(r.peak), b: f1(r.newPeak), pct: Math.round((r.peak - r.newPeak) / r.peak * 100), usd: usd(r.save) }) : t('No battery, no cut: the full peak lands on the grid.');
    else v.textContent = r.firstOut === null ? t('Critical sites stay on for the whole {n}-hour outage.', { n: o.storm }) : t('Critical sites run {a} of the {n} hours, then go dark.', { a: f1(r.critHours), n: o.storm });
    $('.app-bar h3', m).textContent = o.scen === 'day' ? t('A summer day on your feeder') : t('A storm takes out your feeder');
    sig = ''; seek(idx);
  }

  function seek(i) {
    if (!st) return;
    var S = st.r.S; idx = clamp(i, 0, S.length - 1);
    var p = S[Math.round(idx)], r = st.r, o = st.o;
    if (scene) scene.set(p, r);
    if (!on) return;
    $('.hx-time', m).textContent = stamp(p);
    $('.hx-hour', m).textContent = o.scen === 'storm' ? (p.out ? t('Hour {h} without the grid', { h: Math.floor(p.t - r.a) + 1 }) : p.t < r.a ? t('Storm arrives at 2 pm') : t('Feeder restored')) : t('Feeder load {mw} MW', { mw: f1(p.load) });
    $('.hx-scrub', m).value = Math.round(idx);
    $('.hx-track', m).style.setProperty('--at', (idx / (S.length - 1) * 100).toFixed(2) + '%');
    // status
    var k, title, line;
    if (p.out && !p.critOn) { k = 'bad'; title = t('Town dark'); line = t('The battery is empty. Everyone waits on the crews.'); }
    else if (p.out) { k = 'base'; title = t('Islanded'); line = t('The feeder is down. The critical sites run on the battery yard.'); }
    else if (p.dis > 0.01) { k = 'mix'; title = t('Shaving the peak'); line = t('The battery covers {mw} MW so the grid never sees the top of the curve.', { mw: f1(p.dis) }); }
    else if (p.ch > 0.01) { k = 'good'; title = t('Recharging'); line = t('Load is low, so the battery yard refills without adding to the peak.'); }
    else { k = 'sun'; title = t('Normal operation'); line = o.scen === 'storm' && p.t < r.a ? t('The battery yard waits, fully charged, for the storm.') : t('The grid carries the town. The battery waits for the peak.'); }
    var se = $('.hx-status', m); se.className = 'hx-status hx-' + k; $('b', se).textContent = title; $('p', se).textContent = line;
    // feeder gauge
    var max = r.peak * 1.05;
    $('.tx-feed-bar s', m).style.width = ((p.out ? 0 : p.grid) / max * 100).toFixed(1) + '%';
    $('.tx-feed-bar u', m).style.left = (p.load / max * 100).toFixed(1) + '%';
    $('.tx-feed-bar em', m).style.left = ((o.scen === 'day' && r.P > 0 ? r.newPeak : r.peak) / max * 100).toFixed(1) + '%';
    $('[data-tx="grid"]', m).textContent = p.out ? t('Tripped') : f1(p.grid) + ' MW';
    $('[data-tx="demand"]', m).textContent = f1(p.load) + ' MW';
    // battery
    $('.hx-batt-v b', m).textContent = Math.round(p.pct * 100) + '%';
    var ring = $('.hx-ring', m); ring.style.strokeDashoffset = String(100 - p.pct * 100); ring.classList.toggle('low', p.pct < 0.15);
    $('[data-hx="kwh"]', m).textContent = t('{a} of {b} MWh', { a: f1(p.soc), b: f1(r.E) });
    $('[data-hx="left"]', m).textContent = p.dis > 0.01 ? t('Giving {mw} MW', { mw: f1(p.dis) }) : p.ch > 0.01 ? t('Taking {mw} MW', { mw: f1(p.ch) }) : p.pct >= 0.999 ? t('Full, standing by') : t('Standing by');
    // flows
    var F = { gt: p.out ? 0 : p.load - p.dis, bt: p.out ? 0 : p.dis, gb: p.ch, bc: p.out ? p.dis : 0, un: p.out ? p.load - p.dis : 0 }, fm = Math.max(1, p.load, p.grid);
    Object.keys(F).forEach(function (f) { var row = $('[data-f="' + f + '"]', m), v = F[f]; row.classList.toggle('zero', v < 0.01); $('s', row).style.width = (v / fm * 100).toFixed(1) + '%'; $('b', row).textContent = v < 0.01 ? '—' : f1(v) + ' MW'; });
    // sites
    var key = p.out + '|' + p.critOn;
    if (key !== sig) {
      sig = key;
      $('.tx-sites', m).innerHTML = SITES.map(function (s) {
        var on2 = !p.out || p.critOn, src = !p.out ? t('Grid') : p.critOn ? t('Battery') : t('Dark');
        return '<li class="' + (p.out ? (on2 ? 'isl' : 'off') : '') + '"><i></i><span>' + t(s.name) + '</span><b>' + src + '</b></li>';
      }).join('') + '<li class="' + (p.out ? 'off' : '') + '"><i></i><span>' + t('{n} homes and businesses', { n: r.cust.toLocaleString('en-US') }) + '</span><b>' + (p.out ? t('Dark') : t('Grid')) + '</b></li>';
    }
    var cur = -1; st.ev.forEach(function (e, j) { if (e.i <= idx) cur = j; });
    $$('.hx-ev', m).forEach(function (b) { var j = Number(b.getAttribute('data-j')); b.classList.toggle('now', j === cur); b.classList.toggle('past', j < cur); });
  }
  function loop() { if (!playing) return; idx += speed; if (idx >= st.r.S.length - 1) idx = 0; seek(idx); raf = requestAnimationFrame(loop); }
  function setPlay(v) {
    playing = v && !calm; cancelAnimationFrame(raf); if (playing) loop();
    var b = $('[data-town-play]', m); b.setAttribute('aria-pressed', String(playing)); b.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
    $('path', b).setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
  }
  function setSpeed(v) { speed = v; $$('[data-speed]', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === v)); }); }
  function setInput(id, val) { var el = $('#' + id, ps); el.value = val; ps.dispatchEvent(new Event('input', { bubbles: true })); }

  m.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-town-play]'))) return setPlay(!playing);
    if ((b = e.target.closest('[data-speed]'))) { setSpeed(Number(b.getAttribute('data-speed'))); if (!playing) setPlay(true); return; }
    if ((b = e.target.closest('.hx-ev'))) { setPlay(false); seek(Number(b.getAttribute('data-i'))); return; }
    if ((b = e.target.closest('[data-tx-scen] button'))) { opt.scen = b.getAttribute('data-v'); idx = opt.scen === 'storm' ? 52 : 52; recompute(); return; }
    if ((b = e.target.closest('[data-tx-pow] button'))) { setInput('ps-pow', b.getAttribute('data-v')); recompute(); return; }
    if ((b = e.target.closest('[data-tx-dur] button'))) { var r = $('input[name="ps-dur"][value="' + b.getAttribute('data-v') + '"]', ps); if (r) { r.checked = true; ps.dispatchEvent(new Event('change', { bubbles: true })); } recompute(); return; }
    if ((b = e.target.closest('[data-tx-peak]'))) { setInput('ps-peak', clamp(Number($('#ps-peak', ps).value) + Number(b.getAttribute('data-tx-peak')), 5, 150)); recompute(); return; }
    if ((b = e.target.closest('[data-tx-storm]'))) { opt.storm = clamp(opt.storm + Number(b.getAttribute('data-tx-storm')), 2, 10); recompute(); }
  });
  $('.hx-scrub', m).addEventListener('input', function (e) { setPlay(false); seek(Number(e.target.value)); });
  document.addEventListener('ova:lang', function () { if (on) recompute(); });

  window.OvaTownApp = {
    open: function (done) {
      window.OvaLoadThree(function (ok) {
        if (!ok || !window.THREE) return done(false);
        try { scene = town3d(stage); } catch (e) { return done(false); }
        on = true; setSpeed(0.15); idx = 24; recompute(); done(true);
        setTimeout(function () { setPlay(true); }, 400);
      });
    },
    close: function () { on = false; setPlay(false); if (scene) { scene.dispose(); scene = null; } },
    scenario: function (s) { opt.scen = s; }
  };
})();

/* Business control room: one working day with an outage at 11 am, played twice at once.
   The 3D site shows the business with Ovanova (solar + NERD units); the counters compare it
   with the same day on the grid alone. Numbers come from the outage-cost calculator. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var kw = function (v) { return Math.round(v) + ' kW'; };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var m = document.getElementById('app-biz'), ex = $('.ex[data-tool="exposure"]');
  if (!m || !ex) return;

  var NERD_KWH = 65, NERD_KW = 50, START = 12;
  function bell(h, c, w) { return Math.exp(-Math.pow((h - c) / w, 2)); }
  var TYPES = {
    restaurant: { name: 'Restaurant', peak: 60, open: [11, 22], solar: 30, step: 10, nerds: 1, dims: [14, 4.6, 10],
      shape: function (h) { return h < 6 ? 0.2 : h < 10 ? 0.2 + (h - 6) * 0.08 : 0.55 + 0.4 * bell(h, 12.5, 1.6) + 0.45 * bell(h, 19, 1.8); },
      loads: [['Walk-in cooler and freezer', 0.22, 1], ['Kitchen line', 0.38, 0], ['Heating and cooling', 0.28, 0], ['Lights, registers and Wi-Fi', 0.12, 1]] },
    cold: { name: 'Cold storage', peak: 160, open: [6, 20], solar: 120, step: 20, nerds: 3, dims: [26, 8, 16],
      shape: function (h) { return 0.72 + 0.28 * bell(h, 15, 4); },
      loads: [['Cold rooms', 0.7, 1], ['Dock doors and lifts', 0.12, 0], ['Office and IT', 0.06, 1], ['Lighting', 0.12, 0]] },
    clinic: { name: 'Clinic', peak: 80, open: [7, 19], solar: 50, step: 10, nerds: 1, dims: [18, 7, 11],
      shape: function (h) { return h < 6 || h >= 21 ? 0.25 : 0.4 + 0.5 * bell(h, 11, 2.5) + 0.45 * bell(h, 15, 2.5); },
      loads: [['Exam rooms and imaging', 0.35, 0], ['Vaccine and lab fridges', 0.15, 1], ['Heating and cooling', 0.35, 0], ['Lights, IT and records', 0.15, 1]] },
    factory: { name: 'Factory', peak: 420, open: [6, 22], solar: 250, step: 50, nerds: 4, dims: [30, 9, 18],
      shape: function (h) { return h < 6 || h >= 22 ? 0.22 : 0.82 + 0.18 * bell(h, 14, 4); },
      loads: [['Production line', 0.6, 0], ['Air compressors', 0.15, 0], ['Controls and safety systems', 0.08, 1], ['Lighting and offices', 0.17, 1]] }
  };
  var ORDER = ['restaurant', 'cold', 'clinic', 'factory'];
  var opt = { type: 'restaurant', nerds: 1, solar: 30 };
  function crit(T) { return T.loads.reduce(function (s, l) { return s + (l[2] ? l[1] : 0); }, 0); }
  function sunAt(kwp, h) { return window.OvaModel ? window.OvaModel.solarAt(kwp, h, 'summer', 'clear') : 0; }
  function readEx() {
    var v = function (id) { return Number($('#' + id, ex).value); };
    return { hour: v('ex-hour'), len: v('ex-len'), restart: v('ex-restart'), spoil: v('ex-spoil'), rate: v('ex-rate'), events: v('ex-events') };
  }
  function shaveCap(net, P, E) {
    var lo = 0, hi = Math.max.apply(null, net);
    for (var it = 0; it < 40; it++) {
      var c = (lo + hi) / 2, ok = true, need = 0;
      net.forEach(function (l) { var x = l - c; if (x > P + 1e-9) ok = false; if (x > 0) need += x * 0.25; });
      if (ok && need <= E) hi = c; else lo = c;
    }
    return hi;
  }

  function simulate() {
    var T = TYPES[opt.type], x = readEx(), len = clamp(x.len, 0.5, 12), end = START + len;
    var P = NERD_KW * opt.nerds, E = NERD_KWH * opt.nerds, cs = crit(T);
    var hours = [], net = [];
    for (var i = 0; i <= 96; i++) { var h = i * 0.25, ld = T.peak * T.shape(h % 24), sn = sunAt(opt.solar, h % 24); hours.push({ load: ld, sun: sn }); net.push(ld - sn); }
    var cap = shaveCap(net, P, E * 0.5); // half the battery shaves the peak, half stays in reserve
    var S = [], soc = E, costA = 0, costB = 0, spoiledB = false, downB = null, upB = null;
    for (var j = 0; j <= 96; j++) {
      var hr = j * 0.25, p = { t: hr, load: hours[j].load, sun: hours[j].sun, out: hr >= START && hr < end, dis: 0, ch: 0, grid: 0, spare: 0 };
      // without a microgrid
      if (p.out) { p.a = 'down'; if (j) costA += x.hour * 0.25 + x.spoil * 0.25 / len; }
      else if (hr >= end && hr < end + x.restart) { p.a = 'restart'; if (j) costA += x.hour * 0.25; }
      else p.a = 'open';
      p.gridA = p.out ? 0 : p.load;
      // with Ovanova
      var need = p.load - p.sun;
      if (!p.out) {
        if (need > cap && soc > E * 0.5) p.dis = Math.min(P, need - cap, (soc - E * 0.5) / 0.25);
        else if (need < cap) p.ch = Math.min(P, cap - need, (E - soc) / 0.9 / 0.25);
        p.grid = Math.max(0, need - p.dis + p.ch); if (need < 0 && p.ch < -need) p.spare = -need - p.ch;
        p.b = upB !== null && hr < upB + x.restart ? 'restart' : p.dis > 0.5 ? 'shave' : 'open';
        if (p.b === 'restart' && j) costB += x.hour * 0.25;
      } else if (downB === null) {
        if (need <= 0) { p.b = 'island'; p.ch = Math.min(P, -need, (E - soc) / 0.9 / 0.25); p.spare = -need - p.ch; }
        else if (need <= P && soc > need * 0.25) { p.b = 'island'; p.dis = need; }
        else {
          var needC = p.load * cs - p.sun;
          if (needC <= 0) { p.b = 'essentials'; p.ch = Math.min(P, -needC, (E - soc) / 0.9 / 0.25); }
          else if (needC <= P && soc > needC * 0.25) { p.b = 'essentials'; p.dis = needC; }
          else { p.b = 'down'; downB = hr; }
        }
        if (p.b === 'essentials' && j) costB += x.hour * 0.25 * 0.5;
        if (p.b === 'down') { costB += x.hour * 0.25; if (!spoiledB) { costB += x.spoil * 0.5; spoiledB = true; } }
      } else { p.b = 'down'; costB += x.hour * 0.25; }
      if (!p.out && downB !== null && upB === null) upB = hr;
      if (j) soc = clamp(soc - p.dis * 0.25 + p.ch * 0.25 * 0.9, 0, E);
      p.soc = soc; p.pct = E ? soc / E : 0; p.costA = costA; p.costB = costB;
      S.push(p);
    }
    var peakA = 0, peakB = 0; S.forEach(function (p) { if (!p.out) { peakA = Math.max(peakA, p.load); peakB = Math.max(peakB, p.grid); } });
    var demandMo = (peakA - peakB) * x.rate;
    return { S: S, T: T, x: x, len: len, end: end, P: P, E: E, cap: cap, costA: costA, costB: costB, peakA: peakA, peakB: peakB, demandMo: demandMo,
      year: x.events * (costA - costB) + demandMo * 12, downB: downB, crit: cs };
  }

  /* ---------- 3D site ---------- */
  function site3d(stage) {
    var T3 = window.THREE, wrap = $('.pl-canvas', stage), coarse = matchMedia('(pointer: coarse)').matches;
    var renderer = new T3.WebGLRenderer({ antialias: !coarse, alpha: true });
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    wrap.appendChild(renderer.domElement);
    var scene = new T3.Scene(), cam = new T3.PerspectiveCamera(30, 1, 0.5, 500);
    var target = new T3.Vector3(0, 2, 0), angle = 0.65, elev = 0.5, dist = 50, distGoal = 50;
    var hemi = new T3.HemisphereLight(0xdfefff, 0x1a2430, 0.5); scene.add(hemi); scene.add(new T3.AmbientLight(0xffffff, 0.24));
    var sun = new T3.DirectionalLight(0xfff1d6, 1); scene.add(sun);
    var M = function (c, o) { return new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0.05 }, o || {})); };
    var ground = new T3.Mesh(new T3.CircleGeometry(110, 96), M(0x0f171f)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var lot = new T3.Mesh(new T3.PlaneGeometry(1, 1), M(0x222c36)); lot.rotation.x = -Math.PI / 2; lot.position.y = 0.02; scene.add(lot);
    var road = new T3.Mesh(new T3.PlaneGeometry(220, 5), M(0x1b242d)); road.rotation.x = -Math.PI / 2; road.position.y = 0.03; scene.add(road);
    var glass = new T3.MeshStandardMaterial({ color: 0x18222c, emissive: 0xffe2b0, emissiveIntensity: 0, roughness: 0.3 });
    var coolMat = new T3.MeshStandardMaterial({ color: 0xe7ebef, emissive: 0x2eadf7, emissiveIntensity: 0, roughness: 0.4 });
    function box(g, w, h, d, mat, x, y, z) { var b = new T3.Mesh(new T3.BoxGeometry(w, h, d), mat.isMaterial ? mat : M(mat)); b.position.set(x || 0, (y === undefined ? h / 2 : y), z || 0); g.add(b); return b; }
    function pane(g, w, h, x, y, z, ry) { var p = new T3.Mesh(new T3.PlaneGeometry(w, h), glass); p.position.set(x, y, z); p.rotation.y = ry || 0; g.add(p); return p; }
    // the sign: OPEN / CLOSED / ESSENTIALS
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 80; var cx = cv.getContext('2d');
    var signTex = new T3.CanvasTexture(cv), signMat = new T3.MeshBasicMaterial({ map: signTex });
    var signTxt = '';
    function sign(txt, col) {
      if (txt === signTxt) return; signTxt = txt;
      cx.fillStyle = '#0b1117'; cx.fillRect(0, 0, 256, 80); cx.strokeStyle = col; cx.lineWidth = 6; cx.strokeRect(5, 5, 246, 70);
      cx.fillStyle = col; cx.font = '600 34px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(txt, 128, 42); signTex.needsUpdate = true;
    }
    var signMesh = new T3.Mesh(new T3.PlaneGeometry(3.2, 1), signMat); scene.add(signMesh);

    var B = {};
    B.restaurant = (function () {
      var g = new T3.Group(), d = TYPES.restaurant.dims;
      box(g, d[0], d[1], d[2], 0x8d7b6a); box(g, d[0] + 0.4, 0.4, d[2] + 0.4, 0x3a434c, 0, d[1] + 0.2);
      pane(g, 9, 2.6, -1.5, 1.6, d[2] / 2 + 0.01); pane(g, 1.6, 2.6, 4.6, 1.4, d[2] / 2 + 0.01);
      var aw = box(g, 11, 0.15, 2.2, 0xc4574e, -1, 3.4, d[2] / 2 + 1); aw.rotation.x = 0.35;
      [[-4, 8.5], [-1, 8.5], [2, 8.5]].forEach(function (p) { var tb = new T3.Mesh(new T3.CylinderGeometry(0.6, 0.6, 0.08, 16), M(0xd9dee3)); tb.position.set(p[0], 0.8, p[1]); g.add(tb); var leg = new T3.Mesh(new T3.CylinderGeometry(0.06, 0.06, 0.8, 6), M(0x5d6a76)); leg.position.set(p[0], 0.4, p[1]); g.add(leg); });
      box(g, 3.2, 2.6, 3, coolMat, -5, undefined, -d[2] / 2 - 1.5);
      g.userData = { sign: [d[0] / 2 - 3, 3.9, d[2] / 2 + 0.02], cool: [-5, 3, -d[2] / 2 - 1.5] };
      return g;
    })();
    B.cold = (function () {
      var g = new T3.Group(), d = TYPES.cold.dims;
      box(g, d[0], d[1], d[2], 0xd7dde2); box(g, d[0] + 0.4, 0.4, d[2] + 0.4, 0x6d7883, 0, d[1] + 0.2);
      [-7, -1, 5].forEach(function (x) { box(g, 3.4, 3.8, 0.2, 0x2a333c, x, 1.9, d[2] / 2 + 0.05); });
      for (var i = 0; i < 4; i++) { var c = box(g, 2.2, 1.2, 2.2, coolMat, -9 + i * 6, d[1] + 1, -3); c.userData.cool = true; }
      var trailer = box(g, 2.6, 3, 9, 0xeef1f4, -1, 2, d[2] / 2 + 6); var cab = box(g, 2.6, 2.6, 2.4, 0x2eadf7, -1, 1.5, d[2] / 2 + 11.8);
      pane(g, 3, 1.4, 10, 3, d[2] / 2 + 0.01);
      g.userData = { sign: [10, 5.2, d[2] / 2 + 0.02], cool: [-3, d[1] + 2.2, -3] };
      return g;
    })();
    B.clinic = (function () {
      var g = new T3.Group(), d = TYPES.clinic.dims;
      box(g, d[0], d[1], d[2], 0xe3e8ec); box(g, d[0] + 0.4, 0.3, d[2] + 0.4, 0x8c9aa6, 0, d[1] + 0.15);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 6; c++) pane(g, 1.6, 1.3, -7 + c * 2.8, 2 + r * 3, d[2] / 2 + 0.01);
      box(g, 6, 0.3, 3, 0x9aa5af, 0, 3.2, d[2] / 2 + 1.5);
      var c1 = new T3.Mesh(new T3.BoxGeometry(2, 0.5, 0.15), new T3.MeshBasicMaterial({ color: 0x2eadf7 })); c1.position.set(d[0] / 2 - 2, d[1] - 1.2, d[2] / 2 + 0.1); g.add(c1);
      var c2 = c1.clone(); c2.rotation.z = Math.PI / 2; g.add(c2);
      box(g, 2.4, 2.2, 5, 0xf2f4f6, 6, 1.4, d[2] / 2 + 6);
      box(g, 2.6, 1.8, 2.4, coolMat, -d[0] / 2 + 2, d[1] + 1.2, -2);
      g.userData = { sign: [-4, d[1] - 1.2, d[2] / 2 + 0.02], cool: [-d[0] / 2 + 2, d[1] + 2.6, -2] };
      return g;
    })();
    B.factory = (function () {
      var g = new T3.Group(), d = TYPES.factory.dims;
      box(g, d[0], d[1], d[2], 0x9aa5af);
      for (var i = 0; i < 5; i++) { var s = new T3.Mesh(new T3.BoxGeometry(d[0] / 5, 0.25, d[2] / 2.2), M(0x5d6a76)); s.position.set(-d[0] / 2 + d[0] / 10 + i * d[0] / 5, d[1] + 1, 0); s.rotation.x = 0.5; g.add(s); }
      var stack = new T3.Mesh(new T3.CylinderGeometry(0.7, 0.9, 16, 16), M(0x7c8791)); stack.position.set(d[0] / 2 - 3, 8, -d[2] / 2 + 3); g.add(stack);
      [-1, 1].forEach(function (k) { var silo = new T3.Mesh(new T3.CylinderGeometry(2, 2, 10, 20), M(0xc8d2db, { metalness: 0.3, roughness: 0.5 })); silo.position.set(-d[0] / 2 - 3, 5, k * 3); g.add(silo); });
      for (var w = 0; w < 7; w++) pane(g, 2.6, 1.4, -12 + w * 4, 5.6, d[2] / 2 + 0.01);
      box(g, 5, 4.5, 0.2, 0x2a333c, 6, 2.25, d[2] / 2 + 0.05);
      box(g, 3, 2.2, 2.5, coolMat, -8, undefined, d[2] / 2 + 2);
      g.userData = { sign: [-6, 3.2, d[2] / 2 + 0.02], cool: [-8, 3, d[2] / 2 + 2] };
      return g;
    })();
    ORDER.forEach(function (k) { B[k].visible = false; scene.add(B[k]); });

    // solar on the roof
    var panelMat = new T3.MeshStandardMaterial({ color: 0x0c1d33, metalness: 0.4, roughness: 0.25, emissive: 0x2eadf7, emissiveIntensity: 0 });
    var panelGeo = new T3.BoxGeometry(1.6, 0.08, 1);
    var solar = new T3.Group(); scene.add(solar);
    // NERD units
    var nerds = new T3.Group(), nerdProto = null, nerdLights = []; scene.add(nerds);
    var nerdGlow = new T3.MeshBasicMaterial({ color: 0x2eadf7 });
    function nerdUnit() {
      var g = new T3.Group();
      if (nerdProto) g.add(nerdProto.clone()); else box(g, 1.2, 2.2, 1.2, M(0xe7ebef, { roughness: 0.4 }));
      var bar = new T3.Mesh(new T3.PlaneGeometry(0.12, 1.2), nerdGlow); bar.position.set(0, 1.2, 0.75); g.add(bar); nerdLights.push(bar);
      return g;
    }
    // utility pole
    var poleMat = M(0x5b4a3b), pole = new T3.Group(); scene.add(pole);
    box(pole, 0.3, 9, 0.3, poleMat); box(pole, 2.6, 0.18, 0.18, poleMat, 0, 8.4);
    var fault = new T3.Mesh(new T3.SphereGeometry(0.22, 12, 12), new T3.MeshBasicMaterial({ color: 0xef4f43 })); fault.position.set(0.5, 7.6, 0.3); pole.add(fault);
    var xf = new T3.Mesh(new T3.CylinderGeometry(0.4, 0.4, 1, 14), M(0x7c8791, { metalness: 0.4 })); xf.position.set(0.45, 7, 0); pole.add(xf);
    var wires = new T3.Group(); scene.add(wires);
    var lineMat = new T3.LineBasicMaterial({ color: 0x5d6a76 });
    function wire(a, b, sag) { var mid = a.clone().lerp(b, 0.5); mid.y -= sag; wires.add(new T3.Line(new T3.BufferGeometry().setFromPoints(new T3.QuadraticBezierCurve3(a, mid, b).getPoints(20)), lineMat)); }

    // particles
    var curves = {}, parts = [], rate = {};
    var dotGeo = new T3.SphereGeometry(0.16, 10, 10);
    var COL = { grid: 0xdfe9f3, sun: 0xf4c64e, dis: 0x2eadf7, ch: 0x6fdba0 };
    Object.keys(COL).forEach(function (k) { var mat = new T3.MeshBasicMaterial({ color: COL[k] }); for (var i = 0; i < 16; i++) { var d = new T3.Mesh(dotGeo, mat); d.userData = { k: k, o: i / 16 }; d.visible = false; scene.add(d); parts.push(d); } });

    // labels
    var tagLayer = document.createElement('div'); tagLayer.className = 'hx-tags'; stage.appendChild(tagLayer);
    function mk(k) { var e = document.createElement('span'); e.className = 'hx-tag'; e.setAttribute('data-k', k); e.innerHTML = '<i></i><b></b><em></em>'; tagLayer.appendChild(e); return { el: e, pos: new T3.Vector3(), w: 0 }; }
    var tags = { grid: mk('grid'), nerd: mk('nerd'), solar: mk('solar'), biz: mk('biz'), cool: mk('cool') };
    function tag(k, a, b, cls) { var g = tags[k]; g.el.children[1].textContent = a; g.el.children[2].textContent = b; g.el.className = 'hx-tag' + (cls ? ' ' + cls : ''); g.w = 0; }
    var pv = new T3.Vector3();
    function placeTags() {
      var w = wrap.clientWidth, h = wrap.clientHeight, list = [];
      Object.keys(tags).forEach(function (k) {
        var g = tags[k]; if (g.el.offsetParent === null) return; pv.copy(g.pos).project(cam);
        var hw = (g.w || (g.w = g.el.offsetWidth)) / 2 + 6;
        list.push({ g: g, x: clamp((pv.x + 1) / 2 * w, hw, w - hw), y: Math.max(w > 560 ? 96 : 40, (1 - pv.y) / 2 * h), hw: hw, hide: pv.z > 1 });
      });
      list.sort(function (a, b) { return a.y - b.y; });
      for (var i = 0; i < list.length; i++) for (var j = 0; j < i; j++) { var a = list[i], b = list[j]; if (Math.abs(a.x - b.x) < a.hw + b.hw - 8 && a.y - b.y < 30) a.y = b.y + 30; }
      list.forEach(function (o) { o.g.el.style.opacity = o.hide ? 0 : ''; o.g.el.style.transform = 'translate(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px)'; });
    }

    var cur = { type: null, n: -1, kw: -1 };
    function layout(type, n, kwp) {
      var d = TYPES[type].dims, W = d[0], H = d[1], D = d[2];
      if (type !== cur.type) {
        ORDER.forEach(function (k) { B[k].visible = k === type; });
        var u = B[type].userData; signMesh.position.set(u.sign[0], u.sign[1], u.sign[2]);
        tags.cool.pos.set(u.cool[0], u.cool[1] + 1.4, u.cool[2]);
        lot.scale.set(W + 16, 14, 1); lot.position.set(0, 0.02, D / 2 + 7);
        road.position.z = D / 2 + 16.5;
        pole.position.set(-W / 2 - 7, 0, D / 2 + 13.5);
        target.set(0, H * 0.35, 3); distGoal = (Math.max(W, D) * 2.6 + 18) * (wrap.clientWidth / Math.max(1, wrap.clientHeight) < 1.4 ? 0.62 : 1);
        tags.biz.pos.set(0, H + 3.4, 0);
        tags.grid.pos.set(-W / 2 - 7, 10.8, D / 2 + 13.5);
      }
      if (type !== cur.type || n !== cur.n) {
        while (nerds.children.length) nerds.remove(nerds.children[0]);
        nerdLights = [];
        for (var i = 0; i < n; i++) { var u2 = nerdUnit(); u2.position.set(W / 2 + 2.6 + (i % 2) * 1.9, 0, -D / 4 + Math.floor(i / 2) * 2.1); nerds.add(u2); }
        tags.nerd.pos.set(W / 2 + 3.4, 4.4, -D / 4);
      }
      if (type !== cur.type || kwp !== cur.kw) {
        while (solar.children.length) solar.remove(solar.children[0]);
        var cols = Math.max(1, Math.floor((W - 2) / 1.8)), rows = Math.max(1, Math.floor((D - 3) / 1.25)), nP = Math.min(cols * rows, Math.round(kwp / 0.4));
        var top = type === 'factory' ? H + 0.3 : H + 0.5;
        for (var p = 0; p < nP; p++) { var pm = new T3.Mesh(panelGeo, panelMat); pm.position.set(-W / 2 + 1.8 + (p % cols) * 1.8, top, -D / 2 + 1.8 + Math.floor(p / cols) * 1.25); pm.rotation.x = -0.18; solar.add(pm); }
        tags.solar.pos.set(-W / 4, top + 2.6, -D / 4); tags.solar.el.hidden = nP === 0;
      }
      if (type !== cur.type) {
        while (wires.children.length) wires.remove(wires.children[0]);
        var pTop = new T3.Vector3(-W / 2 - 7, 8.5, D / 2 + 13.5);
        wire(pTop, new T3.Vector3(-W / 2, H - 0.8, D / 2 - 1), 0.8);
        wire(new T3.Vector3(pTop.x - 1.2, 8.5, pTop.z), new T3.Vector3(-W / 2 - 120, 8.5, D / 2 + 13), 1.4);
        wire(new T3.Vector3(pTop.x + 1.2, 8.5, pTop.z), new T3.Vector3(W / 2 + 120, 8.5, D / 2 + 13), 1.4);
        curves.grid = new T3.QuadraticBezierCurve3(new T3.Vector3(pTop.x + 0.4, 7.4, pTop.z), new T3.Vector3(-W / 2 - 2, H + 2, D / 2 + 4), new T3.Vector3(-W / 4, H * 0.5, D / 2 + 0.3));
        curves.sun = new T3.QuadraticBezierCurve3(new T3.Vector3(-W / 4, H + 1, -D / 4), new T3.Vector3(-W / 8, H + 3, D / 4), new T3.Vector3(0, H * 0.5, D / 2 + 0.3));
        curves.dis = new T3.QuadraticBezierCurve3(new T3.Vector3(W / 2 + 2.6, 1.6, -D / 4), new T3.Vector3(W / 2 + 2, 3.5, D / 4), new T3.Vector3(W / 4, H * 0.5, D / 2 + 0.3));
        curves.ch = new T3.QuadraticBezierCurve3(new T3.Vector3(W / 4, H + 1, -D / 4), new T3.Vector3(W / 2 + 3, H + 2, -D / 4), new T3.Vector3(W / 2 + 2.6, 2.3, -D / 4));
      }
      cur = { type: type, n: n, kw: kwp };
    }

    function themeColors() {
      var th = document.documentElement.getAttribute('data-theme'), lt = th ? th === 'light' : matchMedia('(prefers-color-scheme: light)').matches; if (stage.closest('.mc')) lt = false;
      ground.material.color.set(lt ? 0xdfe6ec : 0x0f171f); lot.material.color.set(lt ? 0xc3ccd4 : 0x222c36); road.material.color.set(lt ? 0xaeb8c2 : 0x1b242d);
      hemi.groundColor.set(lt ? 0xb8c4cf : 0x1a2430);
    }
    themeColors();
    var mo = new MutationObserver(themeColors); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function set(p, r) {
      layout(opt.type, opt.nerds, opt.solar);
      var h = p.t % 24, dayK = h > 6 && h < 20 ? Math.sin(Math.PI * (h - 6) / 14) : 0, az = Math.PI * ((h - 6) / 14) - Math.PI / 2;
      sun.position.set(Math.sin(az) * 40, 6 + dayK * 50, 25); sun.intensity = 0.15 + dayK * 1.05; hemi.intensity = 0.35 + dayK * 0.5;
      stage.style.setProperty('--day', dayK.toFixed(3));
      var Tt = r.T, openH = h >= Tt.open[0] && h < Tt.open[1], running = p.b !== 'down';
      glass.emissiveIntensity = running ? (p.b === 'essentials' ? 0.25 : (openH ? 1 : 0.3)) * (1 - dayK * 0.6) : 0;
      coolMat.emissiveIntensity = running ? 0.5 : 0;
      panelMat.emissiveIntensity = p.sun > 0.5 ? clamp(p.sun / r.T.peak, 0.08, 0.6) : 0;
      nerdGlow.color.set(p.pct < 0.15 ? 0xef4f43 : 0x2eadf7);
      nerdLights.forEach(function (b) { b.scale.y = Math.max(0.02, p.pct); b.position.y = 0.6 + 0.6 * p.pct; });
      fault.visible = p.out;
      if (p.b === 'down') sign(t('CLOSED'), '#ef4f43'); else if (p.b === 'essentials') sign(t('ESSENTIALS'), '#f4c64e'); else if (p.b === 'restart') sign(t('RESTARTING'), '#f4c64e'); else sign(openH ? t('OPEN') : t('CLOSED FOR THE NIGHT'), openH ? '#6fdba0' : '#8a97a3');
      var direct = Math.min(p.sun, p.load);
      rate = { grid: p.grid / r.T.peak * 3, sun: direct / r.T.peak * 3, dis: p.dis / r.T.peak * 3, ch: p.ch / r.T.peak * 3 };
      tag('grid', t('Utility'), p.out ? t('down') : kw(p.grid), p.out ? 'bad' : 'idle');
      var flow = p.dis > 0.5 ? ' ↓ ' + kw(p.dis) : p.ch > 0.5 ? ' ↑ ' + kw(p.ch) : '';
      tag('nerd', opt.nerds > 1 ? t('{n} NERDs', { n: opt.nerds }) : 'NERD', Math.round(p.pct * 100) + '%' + flow, p.pct < 0.15 ? 'bad' : 'on');
      tag('solar', t('Solar'), p.sun > 0.5 ? kw(p.sun) : t('night'), p.sun > 0.5 ? 'sun' : 'idle');
      var st = { open: openH ? t('open') : t('after hours'), shave: t('open, shaving the peak'), island: t('open on its own power'), essentials: t('essentials only'), restart: t('restarting'), down: t('closed') }[p.b];
      tag('biz', t(Tt.name), st, p.b === 'down' ? 'bad' : p.b === 'essentials' || p.b === 'restart' ? 'sun' : 'on');
      tag('cool', t(Tt.loads.filter(function (l) { return l[2]; })[0][0]), running ? t('protected') : t('warming up'), running ? 'on' : 'bad');
    }
    var clock = 0, last = performance.now(), drag = null, dead = false, raf = 0;
    function render(dt) {
      clock += dt; dist += (distGoal - dist) * Math.min(1, dt * 3 + (calm ? 1 : 0));
      parts.forEach(function (d) { var rt = rate[d.userData.k] || 0, c = curves[d.userData.k]; d.visible = rt > 0.03 && !!c; if (!d.visible) return; d.position.copy(c.getPoint((d.userData.o + clock * (0.1 + Math.min(rt, 3) * 0.08)) % 1)); });
      fault.material.color.setHex(Math.floor(clock * 2) % 2 ? 0x5a1d1a : 0xef4f43);
      if (!drag && !calm) angle += dt * 0.025;
      cam.position.set(target.x + Math.sin(angle) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(angle) * dist * Math.cos(elev));
      cam.lookAt(target); renderer.render(scene, cam); placeTags();
    }
    function tick(now) { if (dead) return; var dt = clamp((now - last) / 1000, 0, 0.05); last = now; render(calm ? 0 : dt); raf = requestAnimationFrame(tick); }
    function size() { var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = Math.min(52, 30 * Math.max(1, 1.6 / (w / h))); cam.updateProjectionMatrix(); }
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, a: angle, e: elev }; el.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
    el.addEventListener('pointermove', function (e) { if (!drag) return; angle = drag.a - (e.clientX - drag.x) * 0.007; elev = clamp(drag.e + (e.clientY - drag.y) * 0.004, 0.15, 1.2); });
    var endD = function () { drag = null; stage.classList.remove('dragging'); };
    el.addEventListener('pointerup', endD); el.addEventListener('pointercancel', endD);
    var ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null; if (ro) ro.observe(wrap);
    window.addEventListener('resize', size); size();
    stage.classList.add('has3d');
    raf = requestAnimationFrame(tick);
    return {
      set: set,
      useNerd: function (proto) { nerdProto = proto; cur.n = -1; },
      dispose: function () {
        dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', size);
        scene.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); }); });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (el.parentNode) el.parentNode.removeChild(el); if (tagLayer.parentNode) tagLayer.parentNode.removeChild(tagLayer);
        stage.classList.remove('has3d');
      }
    };
  }

  /* ---------- the control room ---------- */
  var st = null, idx = 0, playing = false, speed = 0.15, raf = 0, scene = null, on = false, sig = '';
  var stage = $('.bx-scene', m);
  function clockOf(h) { if (h >= 24) return t('Midnight'); var hr = Math.floor(h), mn = Math.round((h % 1) * 60), h12 = hr % 12 === 0 ? 12 : hr % 12; return h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + (hr >= 12 ? 'pm' : 'am'); }
  function events(r) {
    var S = r.S, out = [], T = r.T, x = r.x;
    out.push({ i: T.open[0] * 4, k: 'sun', txt: t('Doors open. The day starts on the grid and the sun.') });
    var sh = -1; S.forEach(function (p, i) { if (sh < 0 && p.dis > 0.5 && !p.out) sh = i; });
    if (sh >= 0 && sh < START * 4) out.push({ i: sh, k: 'good', txt: t('Load climbs past {kw}. The NERD covers the top so the utility never bills that peak.', { kw: kw(r.cap) }) });
    out.push({ i: START * 4, k: 'bad', txt: t('Noon. The grid goes down in the middle of the day.') });
    var first = S[START * 4 + 1];
    if (first.b === 'island') out.push({ i: START * 4 + 1, k: 'good', txt: t('With Ovanova, the NERD picks up the whole business in milliseconds. Customers don’t notice.') });
    else if (first.b === 'essentials') out.push({ i: START * 4 + 1, k: 'sun', txt: t('With Ovanova, the NERD can’t carry everything, so it keeps the essentials running.') });
    out.push({ i: START * 4, k: 'bad', txt: t('Without a microgrid, the doors close. Every hour costs {usd}.', { usd: usd(x.hour) }) });
    if (r.downB !== null) out.push({ i: Math.round(r.downB * 4), k: 'bad', txt: t('With Ovanova, the battery runs out and the business closes too.') });
    S.forEach(function (p, i) { if (i && p.b === 'essentials' && S[i - 1].b === 'island') out.push({ i: i, k: 'sun', txt: t('Load passes what the NERD can carry. It sheds the big loads and keeps the essentials on.') }); });
    out.push({ i: Math.min(96, Math.round(r.end * 4)), k: 'sun', txt: t('Power returns after {h} hours.', { h: f1(r.len) }) });
    if (x.restart > 0) out.push({ i: Math.min(96, Math.round((r.end + x.restart) * 4)), k: 'set', txt: t('Without a microgrid, it takes until now to get back to full speed.') });
    out.push({ i: T.open[1] * 4 > 96 ? 96 : T.open[1] * 4, k: 'set', txt: t('Closing time.') });
    out.push({ i: 96, k: r.costA > r.costB ? 'good' : 'bad', txt: t('End of the day: {a} lost without a microgrid, {b} with Ovanova.', { a: usd(r.costA), b: usd(r.costB) }) });
    return out.sort(function (a, b) { return a.i - b.i; });
  }
  function strip() {
    var S = st.r.S, n = S.length - 1, x = function (i) { return (i / n * 1000).toFixed(1); }, max = st.r.T.peak * 1.05, h = '';
    S.forEach(function (p, i) { var hh = p.t % 24; if ((hh < 6 || hh >= 20) && i < n) h += '<rect class="n" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; if (p.out && i < n) h += '<rect class="o" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; });
    var y = function (v) { return (54 - v / max * 48).toFixed(1); };
    h += '<path class="b" d="M0 56 ' + S.map(function (p, i) { return 'L' + x(i) + ' ' + y(p.out ? 0 : p.grid); }).join(' ') + ' L1000 56 Z"/>';
    h += '<path class="l" d="' + S.map(function (p, i) { return (i ? 'L' : 'M') + x(i) + ' ' + y(p.load); }).join(' ') + '"/>';
    st.ev.forEach(function (e) { if (e.i > 0 && e.i < n) h += '<line class="e e-' + e.k + '" x1="' + x(e.i) + '" x2="' + x(e.i) + '" y1="0" y2="8"/>'; });
    $('.hx-strip', m).innerHTML = h;
  }
  function recompute() {
    var r = simulate(); st = { r: r, ev: events(r) };
    strip();
    $('.hx-events', m).innerHTML = st.ev.map(function (e, j) { return '<li><button type="button" class="hx-ev hx-ev-' + e.k + '" data-i="' + e.i + '" data-j="' + j + '"><time>' + clockOf(e.i / 4) + '</time><span>' + e.txt + '</span></button></li>'; }).join('');
    $$('[data-bx-type] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === opt.type)); });
    $('[data-bx="nerds"]', m).textContent = opt.nerds;
    $('[data-bx="nerds-note"]', m).textContent = t('{e} kWh, {p} kW', { e: r.E, p: r.P });
    $('[data-bx="solar"]', m).textContent = kw(opt.solar);
    $('[data-bx="len"]', m).textContent = t('{n} h', { n: f1(r.len) });
    $('[data-bx="inputs"]', m).textContent = t('From your calculator: {h} per hour down, {s} spoilage, {r} h to get back to full speed, {d}/kW demand charge.', { h: usd(r.x.hour), s: usd(r.x.spoil), r: f1(r.x.restart), d: usd(r.x.rate) });
    var v = $('.hx-verdict', m);
    v.textContent = r.year > 0 ? t('Over {n} outages a year plus the demand savings, that is about {usd} a year.', { n: r.x.events, usd: usd(r.year) }) : t('Add NERDs or solar to see the difference.');
    $('.app-bar h3', m).textContent = t('An outage at your {type}', { type: t(TYPES[opt.type].name).toLowerCase() });
    $('[data-bx="peakA"]', m).textContent = kw(r.peakA); $('[data-bx="peakB"]', m).textContent = kw(r.peakB);
    $('[data-bx="demand"]', m).textContent = t('{usd} a month', { usd: usd(r.demandMo) });
    sig = ''; seek(idx);
  }
  function seek(i) {
    if (!st) return;
    var S = st.r.S, r = st.r; idx = clamp(i, 0, S.length - 1);
    var p = S[Math.round(idx)];
    if (scene) scene.set(p, r);
    if (!on) return;
    $('.hx-time', m).textContent = clockOf(p.t);
    $('.hx-hour', m).textContent = p.out ? t('Grid down for {h}', { h: f1(p.t - START + 0.25) + ' h' }) : t('Using {kw}', { kw: kw(p.load) });
    $('.hx-scrub', m).value = Math.round(idx);
    $('.hx-track', m).style.setProperty('--at', (idx / (S.length - 1) * 100).toFixed(2) + '%');
    // the two days side by side
    var A = { open: t('Open'), restart: t('Restarting'), down: t('Closed') }[p.a], Bs = { open: t('Open'), shave: t('Open'), island: t('Open on its own power'), essentials: t('Essentials only'), restart: t('Restarting'), down: t('Closed') }[p.b];
    $('[data-bx="costA"]', m).textContent = usd(p.costA); $('[data-bx="costB"]', m).textContent = usd(p.costB);
    $('[data-bx="stA"]', m).textContent = A; $('[data-bx="stB"]', m).textContent = Bs;
    $('.bx-vs-a', m).className = 'bx-vs-a bx-' + p.a; $('.bx-vs-b', m).className = 'bx-vs-b bx-' + p.b;
    $('[data-bx="tA"]', m).textContent = usd(p.costA); $('[data-bx="tB"]', m).textContent = usd(p.costB);
    // status
    var k, title, line, Tt = r.T, hh = p.t % 24, openH = hh >= Tt.open[0] && hh < Tt.open[1];
    if (p.b === 'down') { k = 'bad'; title = t('Closed'); line = t('The battery is empty. The business waits for the grid.'); }
    else if (p.b === 'island') { k = 'base'; title = t('Open on its own power'); line = t('The grid is down. Solar and the NERD run the whole business.'); }
    else if (p.b === 'essentials') { k = 'mix'; title = t('Essentials only'); line = t('The grid is down. The NERD keeps the critical loads on and sheds the rest.'); }
    else if (p.b === 'restart') { k = 'mix'; title = t('Restarting'); line = t('Power is back. Getting back to full speed.'); }
    else if (p.b === 'shave') { k = 'mix'; title = t('Shaving the peak'); line = t('The NERD covers {kw} so the utility never bills that peak.', { kw: kw(p.dis) }); }
    else if (p.sun >= p.load) { k = 'sun'; title = t('Running on sunshine'); line = t('Solar covers the whole business right now.'); }
    else { k = 'sun'; title = openH ? t('Open, on the grid and sun') : t('After hours'); line = p.ch > 0.5 ? t('Load is low, so the NERD refills.') : t('The NERD waits, ready for an outage or a peak.'); }
    var se = $('.hx-status', m); se.className = 'hx-status hx-' + k; $('b', se).textContent = title; $('p', se).textContent = line;
    // battery
    $('.hx-batt-v b', m).textContent = Math.round(p.pct * 100) + '%';
    var ring = $('.hx-ring', m); ring.style.strokeDashoffset = String(100 - p.pct * 100); ring.classList.toggle('low', p.pct < 0.15);
    $('[data-hx="kwh"]', m).textContent = t('{a} of {b} kWh', { a: Math.round(p.soc), b: r.E });
    $('[data-hx="left"]', m).textContent = p.dis > 0.5 ? t('Giving {kw}', { kw: kw(p.dis) }) : p.ch > 0.5 ? t('Taking {kw}', { kw: kw(p.ch) }) : t('Standing by');
    // flows
    var direct = Math.min(p.sun, p.load), F = { gb: p.out ? 0 : Math.max(0, p.load - direct - p.dis), sb: direct, nb: p.dis, sn: Math.min(p.ch, Math.max(0, p.sun - p.load)), gn: Math.max(0, p.ch - Math.max(0, p.sun - p.load)) };
    var fm = Math.max(1, p.load, p.sun);
    Object.keys(F).forEach(function (f) { var row = $('[data-f="' + f + '"]', m), v = F[f]; row.classList.toggle('zero', v < 0.5); $('s', row).style.width = (v / fm * 100).toFixed(1) + '%'; $('b', row).textContent = v < 0.5 ? '—' : kw(v); });
    // loads
    var key = p.b + '|' + Math.floor(hh);
    if (key !== sig) {
      sig = key;
      $('.hx-loads', m).innerHTML = Tt.loads.map(function (l) {
        var v = p.load * l[1], off = p.b === 'down' || (p.b === 'essentials' && !l[2]);
        return '<li class="' + (off ? 'off' : '') + '"><span>' + t(l[0]) + (l[2] ? ' <em>' + t('Critical') + '</em>' : '') + '</span><i><s style="width:' + (off ? 0 : l[1] / 0.7 * 100).toFixed(0) + '%"></s></i><b>' + (off ? (p.b === 'down' ? t('No power') : t('Shed')) : kw(v)) + '</b></li>';
      }).join('');
    }
    var cur = -1; st.ev.forEach(function (e, j) { if (e.i <= idx) cur = j; });
    $$('.hx-ev', m).forEach(function (b) { var j = Number(b.getAttribute('data-j')); b.classList.toggle('now', j === cur); b.classList.toggle('past', j < cur); });
  }
  function loop() { if (!playing) return; idx += speed; if (idx >= st.r.S.length - 1) idx = 0; seek(idx); raf = requestAnimationFrame(loop); }
  function setPlay(v) {
    playing = v && !calm; cancelAnimationFrame(raf); if (playing) loop();
    var b = $('[data-biz-play]', m); b.setAttribute('aria-pressed', String(playing)); b.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
    $('path', b).setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
  }
  function setSpeed(v) { speed = v; $$('[data-speed]', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === v)); }); }
  function setType(k, fromPage) {
    opt.type = k; var T = TYPES[k]; opt.nerds = T.nerds; opt.solar = T.solar;
    if (!fromPage) { var btn = $$('.presets button', ex)[ORDER.indexOf(k)]; if (btn) btn.click(); }
  }

  m.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-biz-play]'))) return setPlay(!playing);
    if ((b = e.target.closest('[data-speed]'))) { setSpeed(Number(b.getAttribute('data-speed'))); if (!playing) setPlay(true); return; }
    if ((b = e.target.closest('.hx-ev'))) { setPlay(false); seek(Number(b.getAttribute('data-i'))); return; }
    if ((b = e.target.closest('[data-bx-type] button'))) { setType(b.getAttribute('data-v')); recompute(); return; }
    if ((b = e.target.closest('[data-bx-nerds]'))) { opt.nerds = clamp(opt.nerds + Number(b.getAttribute('data-bx-nerds')), 1, 6); recompute(); return; }
    if ((b = e.target.closest('[data-bx-solar]'))) { var T = TYPES[opt.type]; opt.solar = clamp(opt.solar + Number(b.getAttribute('data-bx-solar')) * T.step, 0, T.step * 16); recompute(); return; }
    if ((b = e.target.closest('[data-bx-len]'))) { var el = $('#ex-len', ex); el.value = clamp(Number(el.value) + Number(b.getAttribute('data-bx-len')), 0.5, 12); ex.dispatchEvent(new Event('input', { bubbles: true })); recompute(); }
  });
  $('.hx-scrub', m).addEventListener('input', function (e) { setPlay(false); seek(Number(e.target.value)); });
  document.addEventListener('ova:lang', function () { if (on) recompute(); });

  window.OvaBizApp = {
    open: function (step, done, type) {
      if (type) setType(type, false);
      window.OvaLoadThree(function (ok) {
        if (!ok || !window.THREE) return done(false);
        try { scene = site3d(stage); } catch (err) { return done(false); }
        step(t('Bringing in the NERD'), 0.8);
        var go = function () { on = true; setSpeed(0.15); idx = 34; recompute(); done(true); setTimeout(function () { setPlay(true); }, 400); };
        if (window.OvaScenes && window.OvaScenes.model) window.OvaScenes.model('nerd', 2.3, function (proto) { if (proto && scene) scene.useNerd(proto); go(); });
        else go();
      });
    },
    close: function () { on = false; setPlay(false); if (scene) { scene.dispose(); scene = null; } }
  };
})();

/* Field control room: a PET deployed for 72 hours. Loads come from the sizer on the page,
   so the window and the sizer always agree. The 3D camp is built from what you power. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('en-US'); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var kw = function (v) { return f1(v) + ' kW'; };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var m = document.getElementById('app-pet'), pz = $('.pz[data-tool="pet"]');
  if (!m || !pz) return;

  // same figures as the sizer
  var FIELD = {
    med: { name: 'Medical tent', avg: 1.5, peak: 2.5, pri: 1 }, comms: { name: 'Command center IT and radios', avg: 1, peak: 1.5, pri: 2 },
    fridge: { name: 'Refrigeration unit', avg: 0.8, peak: 1.6, pri: 3 }, pump: { name: 'Water pump', avg: 0.75, peak: 1.5, pri: 4 },
    light: { name: 'Shelter lights and fans', avg: 0.5, peak: 0.8, pri: 5 }, charge: { name: 'Phone charging station', avg: 0.3, peak: 0.5, pri: 6 },
    kitchen: { name: 'Field kitchen', avg: 2.5, peak: 6, pri: 7 }, hvac: { name: 'HVAC unit', avg: 2, peak: 4, pri: 8 }, tools: { name: 'Power tools', avg: 0.8, peak: 3.5, pri: 9 }
  };
  var KEYS = Object.keys(FIELD).sort(function (a, b) { return FIELD[a].pri - FIELD[b].pri; });
  var PETS = { ember: { name: 'Ember', batt: 64, out: 22.8, solar: 3.06, gen: 9 }, flame: { name: 'Flame', batt: 64, out: 22.8, solar: 4.59, gen: 26 }, blaze: { name: 'Blaze', batt: 114.4, out: 62.4, solar: 0, gen: 0 } };
  var SUN_SCALE = 4.5 / 5.6, START = 18; // the sizer counts 4.5 sun-hours a day; deployments start at 6 pm
  var opt = { pet: null, sky: 'clear' };

  function counts() { var c = {}; $$('[data-field]', pz).forEach(function (r) { c[r.getAttribute('data-field')] = Number($('output', r).textContent); }); return c; }
  function hours() { return Number($('#pz-hours', pz).value); }
  function pick(c) {
    var peak = 0; Object.keys(c).forEach(function (k) { peak += FIELD[k].peak * c[k]; });
    return peak <= 22.8 ? 'ember' : 'blaze';
  }

  function simulate() {
    var c = counts(), H = hours(), P = PETS[opt.pet], dt = 0.25;
    // shed the lowest-priority loads until start-up surges fit the PET's output
    var on = {}, peak = 0, shed = [];
    KEYS.forEach(function (k) { if (!c[k]) return; if (peak + FIELD[k].peak * c[k] <= P.out) { on[k] = c[k]; peak += FIELD[k].peak * c[k]; } else shed.push(k); });
    var S = [], soc = P.batt, genOn = false, genH = 0, firstOut = null, solarKWh = 0, useKWh = 0;
    for (var i = 0; i <= 288; i++) {
      var tm = i * dt, clock = START + tm, h = clock % 24, opn = H >= 24 || (h >= 7 && h < 7 + H);
      var load = 0; Object.keys(on).forEach(function (k) { if (opn) load += FIELD[k].avg * on[k]; });
      var sun = P.solar && window.OvaModel ? window.OvaModel.solarAt(P.solar, h, 'summer', opt.sky) * SUN_SCALE : 0;
      if (P.gen) { if (soc < P.batt * 0.2) genOn = true; if (soc >= P.batt * 0.9) genOn = false; }
      var gen = genOn ? Math.min(P.gen, Math.max(0, load - sun) + Math.min(P.out, (P.batt - soc) / 0.95 / dt)) : 0;
      var net = sun + gen - load, p = { t: tm, clock: clock, load: load, sun: sun, gen: gen, opn: opn, dis: 0, ch: 0, dark: false };
      if (net >= 0) p.ch = Math.min(net, (P.batt - soc) / 0.95 / dt);
      else if (soc > -net * dt) p.dis = -net;
      else { p.dis = soc / dt; p.dark = load > 0; if (firstOut === null && p.dark) firstOut = tm; }
      if (i) { soc = clamp(soc + p.ch * dt * 0.95 - p.dis * dt, 0, P.batt); if (gen > 0) genH += dt; solarKWh += Math.min(sun, load + p.ch) * dt; if (!p.dark) useKWh += load * dt; }
      p.soc = soc; p.pct = soc / P.batt; p.genOn = gen > 0;
      S.push(p);
    }
    return { S: S, c: c, on: on, shed: shed, peak: peak, P: P, H: H, genH: genH, firstOut: firstOut, solarShare: useKWh ? solarKWh / useKWh : 0 };
  }

  /* ---------- 3D camp ---------- */
  function camp3d(stage) {
    var T3 = window.THREE, wrap = $('.pl-canvas', stage), coarse = matchMedia('(pointer: coarse)').matches;
    var renderer = new T3.WebGLRenderer({ antialias: !coarse, alpha: true });
    renderer.setPixelRatio(Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1));
    wrap.appendChild(renderer.domElement);
    var scene = new T3.Scene(), cam = new T3.PerspectiveCamera(30, 1, 0.5, 400);
    var target = new T3.Vector3(0, 1.5, 4), angle = 0.5, elev = 0.5, dist = 46;
    var hemi = new T3.HemisphereLight(0xdfefff, 0x1a2420, 0.5); scene.add(hemi); scene.add(new T3.AmbientLight(0xffffff, 0.22));
    var sun = new T3.DirectionalLight(0xfff1d6, 1); scene.add(sun);
    var M = function (c, o) { return new T3.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9, metalness: 0.02 }, o || {})); };
    var ground = new T3.Mesh(new T3.CircleGeometry(90, 72), M(0x161d19)); ground.rotation.x = -Math.PI / 2; scene.add(ground);
    var pad = new T3.Mesh(new T3.CircleGeometry(19, 64), M(0x232b27)); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, 5); scene.add(pad);
    var glow = new T3.MeshStandardMaterial({ color: 0x18222c, emissive: 0xffe2b0, emissiveIntensity: 0 });
    var cool = new T3.MeshStandardMaterial({ color: 0xe7ebef, emissive: 0x2eadf7, emissiveIntensity: 0, roughness: 0.4 });
    var lamp = new T3.MeshBasicMaterial({ color: 0x2a333c });
    function box(g, w, h, d, mat, x, y, z) { var b = new T3.Mesh(new T3.BoxGeometry(w, h, d), mat.isMaterial ? mat : M(mat)); b.position.set(x || 0, y === undefined ? h / 2 : y, z || 0); g.add(b); return b; }
    function tent(g, w, d, col) {
      box(g, w, 1.6, d, col);
      var R = w / 1.732, roof = new T3.Mesh(new T3.CylinderGeometry(R, R, d, 3, 1), M(col)); roof.rotation.set(-Math.PI / 2, 0, 0); roof.scale.set(1, 1, 0.6); roof.position.y = 1.6 + 0.5 * R * 0.6; g.add(roof);
      var door = new T3.Mesh(new T3.PlaneGeometry(1, 1.4), glow); door.position.set(0, 0.8, d / 2 + 0.01); g.add(door);
    }
    var BUILD = {
      med: function (g) { tent(g, 4, 5, 0xe9edf0); var c1 = new T3.Mesh(new T3.BoxGeometry(0.9, 0.28, 0.05), new T3.MeshBasicMaterial({ color: 0xef4f43 })); c1.position.set(1.3, 1.05, 2.53); g.add(c1); var c2 = c1.clone(); c2.rotation.z = Math.PI / 2; g.add(c2); },
      comms: function (g) { var mast = new T3.Mesh(new T3.CylinderGeometry(0.08, 0.12, 7, 8), M(0x9aa5af, { metalness: 0.5 })); mast.position.y = 3.5; g.add(mast); var dish = new T3.Mesh(new T3.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), M(0xdfe6ec)); dish.position.set(0, 5.5, 0.3); dish.rotation.x = 1.1; g.add(dish); box(g, 1.6, 1.2, 1.2, 0x5d6a76); var bl = new T3.Mesh(new T3.SphereGeometry(0.12, 10, 10), new T3.MeshBasicMaterial({ color: 0xef4f43 })); bl.position.y = 7.1; bl.userData.blink = true; g.add(bl); },
      fridge: function (g) { box(g, 1.8, 1.9, 1.3, cool); },
      pump: function (g) { var tank = new T3.Mesh(new T3.CylinderGeometry(1, 1, 2.2, 20), M(0x2f6f9a)); tank.position.y = 1.1; g.add(tank); box(g, 0.8, 0.7, 0.8, 0x7c8791, 1.4); },
      light: function (g) { var pole = new T3.Mesh(new T3.CylinderGeometry(0.07, 0.07, 4.4, 6), M(0x7c8791)); pole.position.y = 2.2; g.add(pole); var head = new T3.Mesh(new T3.BoxGeometry(1.2, 0.35, 0.5), lamp); head.position.set(0, 4.5, 0); g.add(head); box(g, 1.2, 0.5, 1.2, 0xc8a24a); },
      charge: function (g) { box(g, 2.2, 0.9, 0.9, 0x8d7b6a); var sc = new T3.Mesh(new T3.PlaneGeometry(1.6, 0.6), glow); sc.position.set(0, 1.3, 0.1); g.add(sc); },
      kitchen: function (g) { tent(g, 4, 4, 0xc78d3e); var pipe = new T3.Mesh(new T3.CylinderGeometry(0.12, 0.12, 1.4, 8), M(0x5d6a76)); pipe.position.set(1.2, 3.2, -1); g.add(pipe); },
      hvac: function (g) { box(g, 1.6, 1.2, 1.2, 0xc8d2db); var fan = new T3.Mesh(new T3.CylinderGeometry(0.45, 0.45, 0.05, 20), M(0x2a333c)); fan.position.y = 1.23; g.add(fan); },
      tools: function (g) { box(g, 2.6, 0.9, 1, 0x8d7b6a); box(g, 0.6, 0.4, 0.4, 0xe2b23a, -0.6, 1.1); box(g, 0.9, 0.15, 0.3, 0x7c8791, 0.6, 0.98); }
    };
    var SLOTS = [[-10, 6], [10, 6], [-6, 12], [6, 12], [0, 15], [-14, 12], [14, 12], [-12, 1], [12, 1], [-3, 19], [3, 19], [-9, 17], [9, 17], [-15, 6], [15, 6], [-17, 15], [17, 15], [0, 10]];
    var items = new T3.Group(), cables = new T3.Group(); scene.add(items); scene.add(cables);
    var groups = {}, curves = [], parts = [];
    var dotGeo = new T3.SphereGeometry(0.13, 8, 8), dotMat = new T3.MeshBasicMaterial({ color: 0x2eadf7 }), cableMat = new T3.LineBasicMaterial({ color: 0x3d4a56 });
    for (var d = 0; d < 90; d++) { var dot = new T3.Mesh(dotGeo, dotMat); dot.visible = false; scene.add(dot); parts.push(dot); }
    // PET unit (real model when it arrives)
    var pet = new T3.Group(); scene.add(pet);
    var petStand = box(pet, 5.2, 2.4, 2.2, M(0xe7ebef, { roughness: 0.45 }));
    var petBar = new T3.Mesh(new T3.PlaneGeometry(2.4, 0.16), new T3.MeshBasicMaterial({ color: 0x2eadf7 })); petBar.position.set(0, 3.1, 1.3); scene.add(petBar);
    var genPuff = new T3.Mesh(new T3.SphereGeometry(0.5, 12, 12), new T3.MeshBasicMaterial({ color: 0xbfc8d0, transparent: true, opacity: 0 })); genPuff.position.set(-2.4, 3, -0.6); scene.add(genPuff);
    function usePet(proto) { if (!proto) return; pet.remove(petStand); proto.rotation.y = 0; pet.add(proto); }

    var tagLayer = document.createElement('div'); tagLayer.className = 'hx-tags'; stage.appendChild(tagLayer);
    var tags = {};
    function mk(k) { var e = document.createElement('span'); e.className = 'hx-tag'; e.setAttribute('data-k', k); e.innerHTML = '<i></i><b></b><em></em>'; tagLayer.appendChild(e); return { el: e, pos: new T3.Vector3(), w: 0 }; }
    tags.pet = mk('pet'); tags.pet.pos.set(0, 4.3, 0);
    function tag(k, a, b, cls) { var g = tags[k]; if (!g) return; g.el.children[1].textContent = a; g.el.children[2].textContent = b; g.el.className = 'hx-tag' + (cls ? ' ' + cls : ''); g.w = 0; }
    var pv = new T3.Vector3();
    function placeTags() {
      var w = wrap.clientWidth, h = wrap.clientHeight, list = [];
      Object.keys(tags).forEach(function (k) {
        var g = tags[k]; if (g.el.hidden || g.el.offsetParent === null) return; pv.copy(g.pos).project(cam);
        var hw = (g.w || (g.w = g.el.offsetWidth)) / 2 + 6;
        list.push({ g: g, x: clamp((pv.x + 1) / 2 * w, hw, w - hw), y: Math.max(40, (1 - pv.y) / 2 * h), hw: hw, hide: pv.z > 1 });
      });
      list.sort(function (a, b) { return a.y - b.y; });
      for (var i = 0; i < list.length; i++) for (var j = 0; j < i; j++) { var a = list[i], b = list[j]; if (Math.abs(a.x - b.x) < a.hw + b.hw - 8 && a.y - b.y < 30) a.y = b.y + 30; }
      list.forEach(function (o) { o.g.el.style.opacity = o.hide ? 0 : ''; o.g.el.style.transform = 'translate(' + o.x.toFixed(1) + 'px,' + o.y.toFixed(1) + 'px)'; });
    }

    var sigC = '';
    function layout(c) {
      var key = JSON.stringify(c); if (key === sigC) return; sigC = key;
      while (items.children.length) items.remove(items.children[0]);
      while (cables.children.length) cables.remove(cables.children[0]);
      Object.keys(tags).forEach(function (k) { if (k !== 'pet') { tagLayer.removeChild(tags[k].el); delete tags[k]; } });
      groups = {}; curves = [];
      var slot = 0;
      KEYS.forEach(function (k) {
        var n = Math.min(c[k] || 0, k === 'light' ? 4 : 2); if (!n) return;
        groups[k] = [];
        for (var i = 0; i < n && slot < SLOTS.length; i++, slot++) {
          var g = new T3.Group(); BUILD[k](g); var s = SLOTS[slot]; g.position.set(s[0], 0, s[1]); g.lookAt(0, 0, 0); g.rotation.x = 0; g.rotation.z = 0;
          items.add(g); groups[k].push(g);
          var a = new T3.Vector3(0, 0.1, 1.2), b = new T3.Vector3(s[0], 0.1, s[1]), mid = a.clone().lerp(b, 0.5);
          var cv = new T3.QuadraticBezierCurve3(a, mid, b); curves.push({ k: k, c: cv });
          cables.add(new T3.Line(new T3.BufferGeometry().setFromPoints(cv.getPoints(16)), cableMat));
          if (i === 0) { tags[k] = mk(k); tags[k].pos.set(s[0], k === 'comms' ? 8 : k === 'light' ? 5.6 : 3.8, s[1]); }
        }
      });
    }

    function themeColors() {
      var th = document.documentElement.getAttribute('data-theme'), lt = th ? th === 'light' : matchMedia('(prefers-color-scheme: light)').matches; if (stage.closest('.mc')) lt = false;
      ground.material.color.set(lt ? 0xd6ddd2 : 0x161d19); pad.material.color.set(lt ? 0xc3cabe : 0x232b27); cableMat.color.set(lt ? 0x75838f : 0x3d4a56);
      hemi.groundColor.set(lt ? 0xb8c4b8 : 0x1a2420);
    }
    themeColors();
    var mo = new MutationObserver(themeColors); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    var flowOn = {};
    function set(p, r) {
      layout(r.c);
      var h = p.clock % 24, dayK = h > 6 && h < 20 ? Math.sin(Math.PI * (h - 6) / 14) : 0, az = Math.PI * ((h - 6) / 14) - Math.PI / 2;
      sun.position.set(Math.sin(az) * 40, 6 + dayK * 50, 25); sun.intensity = 0.15 + dayK * 1.05; hemi.intensity = 0.35 + dayK * 0.5;
      stage.style.setProperty('--day', dayK.toFixed(3));
      var live = !p.dark && p.opn;
      glow.emissiveIntensity = live ? 0.4 + (1 - dayK) * 0.9 : 0;
      cool.emissiveIntensity = live ? 0.16 : 0;
      lamp.color.set(live && dayK < 0.25 ? 0xfff1c4 : 0x2a333c);
      petBar.scale.x = Math.max(0.01, p.pct); petBar.position.x = -1.2 * (1 - p.pct); petBar.material.color.set(p.pct < 0.15 ? 0xef4f43 : 0x2eadf7);
      genPuff.material.opacity = p.genOn ? 0.55 : 0;
      flowOn = {}; Object.keys(groups).forEach(function (k) { flowOn[k] = live && !!r.on[k]; });
      var flow = p.dis > 0.05 ? ' ↓ ' + kw(p.dis) : p.ch > 0.05 ? ' ↑ ' + kw(p.ch) : '';
      tag('pet', 'PET ' + r.P.name, Math.round(p.pct * 100) + '%' + flow + (p.genOn ? ' · ' + t('generator on') : ''), p.pct < 0.15 ? 'bad' : 'on');
      Object.keys(groups).forEach(function (k) {
        var n = r.c[k], st = !r.on[k] ? t('too big to start') : p.dark ? t('no power') : !p.opn ? t('off for the night') : t('on');
        tag(k, t(FIELD[k].name) + (n > 1 ? ' ×' + n : ''), st, !r.on[k] || p.dark ? 'bad' : p.opn ? 'on' : 'idle');
      });
    }
    var clock = 0, last = performance.now(), drag = null, dead = false, raf = 0;
    function render(dt) {
      clock += dt;
      var live = curves.filter(function (c) { return flowOn[c.k]; }), per = live.length ? Math.floor(parts.length / live.length) : 0;
      parts.forEach(function (d, i) {
        var ci = per ? Math.floor(i / per) : -1; if (ci < 0 || ci >= live.length || i % per > 5) { d.visible = false; return; }
        d.visible = true; d.position.copy(live[ci].c.getPoint(((i % per) / 6 + clock * 0.25) % 1)); d.position.y = 0.25;
      });
      items.traverse(function (n) { if (n.userData.blink) n.visible = Math.floor(clock * 2) % 2 === 0; });
      genPuff.scale.setScalar(1 + (clock % 1) * 0.6); genPuff.position.y = 3 + (clock % 1) * 0.8;
      if (!drag && !calm) angle += dt * 0.025;
      cam.position.set(target.x + Math.sin(angle) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(angle) * dist * Math.cos(elev));
      cam.lookAt(target); renderer.render(scene, cam); placeTags();
    }
    function tick(now) { if (dead) return; var dt = clamp((now - last) / 1000, 0, 0.05); last = now; render(calm ? 0 : dt); raf = requestAnimationFrame(tick); }
    function size() { var w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.fov = Math.min(52, 30 * Math.max(1, 1.6 / (w / h))); dist = w / h < 1.4 ? 34 : 46; cam.updateProjectionMatrix(); }
    var el = renderer.domElement;
    el.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, a: angle, e: elev }; el.setPointerCapture(e.pointerId); stage.classList.add('dragging'); });
    el.addEventListener('pointermove', function (e) { if (!drag) return; angle = drag.a - (e.clientX - drag.x) * 0.007; elev = clamp(drag.e + (e.clientY - drag.y) * 0.004, 0.15, 1.2); });
    var endD = function () { drag = null; stage.classList.remove('dragging'); };
    el.addEventListener('pointerup', endD); el.addEventListener('pointercancel', endD);
    var ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null; if (ro) ro.observe(wrap);
    window.addEventListener('resize', size); size();
    stage.classList.add('has3d');
    raf = requestAnimationFrame(tick);
    return {
      set: set, usePet: usePet,
      dispose: function () {
        dead = true; cancelAnimationFrame(raf); if (ro) ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', size);
        scene.traverse(function (n) { if (n.geometry) n.geometry.dispose(); if (n.material) [].concat(n.material).forEach(function (x) { if (x.map) x.map.dispose(); x.dispose(); }); });
        renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss();
        if (el.parentNode) el.parentNode.removeChild(el); if (tagLayer.parentNode) tagLayer.parentNode.removeChild(tagLayer);
        stage.classList.remove('has3d');
      }
    };
  }

  /* ---------- the control room ---------- */
  var st = null, idx = 0, playing = false, speed = 0.3, raf = 0, scene = null, on = false, sig = '';
  var stage = $('.px-scene', m);
  function stamp(p) {
    var h = p.clock % 24, hr = Math.floor(h), mn = Math.round((h % 1) * 60), h12 = hr % 12 === 0 ? 12 : hr % 12;
    return t('Day {d} · {time}', { d: Math.floor((p.t + START) / 24) + 1, time: h12 + ':' + (mn < 10 ? '0' : '') + mn + ' ' + (hr >= 12 ? 'pm' : 'am') });
  }
  function events(r) {
    var S = r.S, out = [{ i: 0, k: 'good', txt: t('The PET rolls in and powers up. No fuel deliveries, no noise.') }];
    if (r.shed.length) out.push({ i: 0, k: 'bad', txt: t('Too much starts at once for PET {name}: {list} stay off.', { name: r.P.name, list: r.shed.map(function (k) { return t(FIELD[k].name).toLowerCase(); }).join(', ') }) });
    var sunWas = S[0].sun > 0.05, genWas = false, darkWas = false, low = null;
    for (var i = 1; i < S.length; i++) {
      var p = S[i], sn = p.sun > 0.05;
      if (!sn && (!low || p.pct < low.pct)) low = { i: i, pct: p.pct };
      if (sn && !sunWas) { if (low && low.pct > 0 && low.pct < 0.95) out.push({ i: low.i, k: 'low', txt: t('Lowest charge overnight: {n}%.', { n: Math.round(low.pct * 100) }) }); out.push({ i: i, k: 'sun', txt: t('Sunrise. The PET’s own panels start recharging it.') }); low = null; }
      if (p.genOn && !genWas) out.push({ i: i, k: 'sun', txt: t('Charge drops to 20%. The built-in generator starts.') });
      if (!p.genOn && genWas) out.push({ i: i, k: 'good', txt: t('Battery back to 90%. The generator shuts off.') });
      if (p.dark && !darkWas) out.push({ i: i, k: 'bad', txt: t('Battery empty. The camp goes dark.') });
      if (!p.dark && darkWas) out.push({ i: i, k: 'sun', txt: t('The sun brings the camp back.') });
      sunWas = sn; genWas = p.genOn; darkWas = p.dark;
    }
    var last = S[S.length - 1];
    out.push({ i: S.length - 1, k: last.dark ? 'bad' : 'good', txt: last.dark ? t('Hour 72: the camp is waiting on a recharge.') : t('Hour 72: still running, with {n}% in the battery.', { n: Math.round(last.pct * 100) }) });
    return out.sort(function (a, b) { return a.i - b.i; }).slice(0, 14);
  }
  function strip() {
    var S = st.r.S, n = S.length - 1, x = function (i) { return (i / n * 1000).toFixed(1); }, h = '';
    S.forEach(function (p, i) { if (p.sun <= 0.05 && i < n) h += '<rect class="n" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; if (p.dark && i < n) h += '<rect class="o" x="' + x(i) + '" y="0" width="' + (1000 / n + 0.5).toFixed(1) + '" height="56"/>'; if (p.genOn && i < n) h += '<rect class="g" x="' + x(i) + '" y="50" width="' + (1000 / n + 0.5).toFixed(1) + '" height="6"/>'; });
    h += '<path class="b" d="M0 56 ' + S.map(function (p, i) { return 'L' + x(i) + ' ' + (54 - p.pct * 48).toFixed(1); }).join(' ') + ' L1000 56 Z"/>';
    st.ev.forEach(function (e) { if (e.i > 0 && e.i < n) h += '<line class="e e-' + e.k + '" x1="' + x(e.i) + '" x2="' + x(e.i) + '" y1="0" y2="8"/>'; });
    $('.hx-strip', m).innerHTML = h;
  }
  function recompute() {
    if (!opt.pet) {
      // open on the smallest unit that fits the surges and lasts the 72 hours; else the one that lasts longest
      var best = null;
      ['ember', 'flame', 'blaze'].forEach(function (k) {
        opt.pet = k; var r0 = simulate(), fits = !r0.shed.length, life = r0.firstOut === null ? 999 : r0.firstOut;
        if (fits && life === 999 && (!best || best.life < 999)) { if (!best || best.life < 999) best = { k: k, life: life }; }
        else if (!best || (best.life < 999 && fits && life > best.life)) best = { k: k, life: life };
      });
      opt.pet = best ? best.k : 'ember';
    }
    var r = simulate(); st = { r: r, ev: events(r) };
    strip();
    $('.hx-events', m).innerHTML = st.ev.map(function (e, j) { return '<li><button type="button" class="hx-ev hx-ev-' + e.k + '" data-i="' + e.i + '" data-j="' + j + '"><time>' + stamp(r.S[e.i]) + '</time><span>' + e.txt + '</span></button></li>'; }).join('');
    $$('[data-px-pet] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === opt.pet)); });
    $$('[data-px-sky] button', m).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === opt.sky)); });
    $('[data-px="spec"]', m).textContent = t('{b} kWh battery, {o} kW output', { b: f1(r.P.batt), o: f1(r.P.out) }) + (r.P.solar ? t(', {s} kW of panels', { s: f1(r.P.solar) }) : '') + (r.P.gen ? t(', {g} kW generator', { g: r.P.gen }) : '');
    $('[data-px="hours"]', m).textContent = t('{n} h/day', { n: r.H });
    var v = $('.hx-verdict', m), any = Object.keys(r.on).length;
    if (!any) v.textContent = t('Add loads in the sizer on the page to see a deployment.');
    else if (r.firstOut === null) v.textContent = r.P.gen ? t('PET {name} runs the camp for all 72 hours. The generator runs {h} hours in total, not all day.', { name: r.P.name, h: f1(r.genH) }) : t('PET {name} runs the camp for all 72 hours. Solar covers {pct}% of it.', { name: r.P.name, pct: Math.round(r.solarShare * 100) });
    else v.textContent = t('PET {name} runs {h} hours, then the camp goes dark.', { name: r.P.name, h: Math.round(r.firstOut) });
    sig = ''; seek(idx);
  }
  function seek(i) {
    if (!st) return;
    var S = st.r.S, r = st.r; idx = clamp(i, 0, S.length - 1);
    var p = S[Math.round(idx)];
    if (scene) scene.set(p, r);
    if (!on) return;
    $('.hx-time', m).textContent = stamp(p);
    $('.hx-hour', m).textContent = t('Hour {h} of the deployment', { h: Math.floor(p.t) });
    $('.hx-scrub', m).value = Math.round(idx);
    $('.hx-track', m).style.setProperty('--at', (idx / (S.length - 1) * 100).toFixed(2) + '%');
    var k, title, line;
    if (p.dark) { k = 'bad'; title = t('Camp dark'); line = t('The battery is empty. Power returns with the sun.'); }
    else if (!p.opn) { k = 'base'; title = t('Standing by'); line = t('Operations are closed for the night. The PET holds its charge.'); }
    else if (p.genOn) { k = 'mix'; title = t('Generator assisting'); line = t('The generator carries the camp and refills the battery, then shuts off.'); }
    else if (p.sun >= p.load) { k = 'sun'; title = t('Running on sunshine'); line = t('The PET’s panels cover the whole camp right now.'); }
    else if (p.sun > 0.05) { k = 'mix'; title = t('Sun plus battery'); line = t('Solar covers {n}% of the camp. The battery covers the rest.', { n: Math.round(p.sun / p.load * 100) }); }
    else { k = 'base'; title = t('Running on the battery'); line = t('Silent, no fumes. The camp runs on stored power.'); }
    var se = $('.hx-status', m); se.className = 'hx-status hx-' + k; $('b', se).textContent = title; $('p', se).textContent = line;
    $('.hx-batt-v b', m).textContent = Math.round(p.pct * 100) + '%';
    var ring = $('.hx-ring', m); ring.style.strokeDashoffset = String(100 - p.pct * 100); ring.classList.toggle('low', p.pct < 0.15);
    $('[data-hx="kwh"]', m).textContent = t('{a} of {b} kWh', { a: f1(p.soc), b: f1(r.P.batt) });
    var net = p.load - p.sun - p.gen;
    $('[data-hx="left"]', m).textContent = p.dark ? t('Empty') : net > 0.05 ? (p.soc / net >= 48 ? t('2 days or more') : t('About {n} h at this rate', { n: Math.max(1, Math.round(p.soc / net)) })) : p.pct >= 0.999 ? t('Full') : t('Charging +{kw}', { kw: kw(-net) });
    var direct = Math.min(p.sun, p.load), gl = Math.min(p.gen, Math.max(0, p.load - direct));
    var F = { sl: p.dark ? 0 : direct, bl: p.dark ? 0 : p.dis, gl: gl, sb: Math.min(p.ch, Math.max(0, p.sun - p.load)), gb: Math.max(0, p.ch - Math.max(0, p.sun - p.load)), un: p.dark ? p.load - p.sun : 0 }, fm = Math.max(1, p.load, p.sun + p.gen);
    Object.keys(F).forEach(function (f) { var row = $('[data-f="' + f + '"]', m), v = F[f]; row.hidden = (f === 'gl' || f === 'gb') && !r.P.gen; row.classList.toggle('zero', v < 0.05); $('s', row).style.width = (v / fm * 100).toFixed(1) + '%'; $('b', row).textContent = v < 0.05 ? '—' : kw(v); });
    var key = p.dark + '|' + p.opn;
    if (key !== sig) {
      sig = key;
      var rows = KEYS.filter(function (k2) { return r.c[k2]; });
      $('.hx-loads', m).innerHTML = rows.length ? rows.map(function (k2) {
        var n = r.c[k2], ok = !!r.on[k2], v2 = FIELD[k2].avg * n, cls = !ok || p.dark ? 'off' : !p.opn ? 'idle' : '';
        var val = !ok ? t('Too big to start') : p.dark ? t('No power') : !p.opn ? t('Off for the night') : kw(v2);
        return '<li class="' + cls + '"><span>' + t(FIELD[k2].name) + (n > 1 ? ' ×' + n : '') + '</span><i><s style="width:' + (cls ? 0 : Math.min(100, v2 / 6 * 100)).toFixed(0) + '%"></s></i><b>' + val + '</b></li>';
      }).join('') : '<li class="idle"><span>' + t('Nothing selected') + '</span></li>';
    }
    var cur = -1; st.ev.forEach(function (e, j) { if (e.i <= idx) cur = j; });
    $$('.hx-ev', m).forEach(function (b) { var j = Number(b.getAttribute('data-j')); b.classList.toggle('now', j === cur); b.classList.toggle('past', j < cur); });
  }
  function loop() { if (!playing) return; idx += speed; if (idx >= st.r.S.length - 1) idx = 0; seek(idx); raf = requestAnimationFrame(loop); }
  function setPlay(v) {
    playing = v && !calm; cancelAnimationFrame(raf); if (playing) loop();
    var b = $('[data-pet-play]', m); b.setAttribute('aria-pressed', String(playing)); b.setAttribute('aria-label', playing ? t('Pause') : t('Play'));
    $('path', b).setAttribute('d', playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M8 5v14l11-7z');
  }
  function setSpeed(v) { speed = v; $$('[data-speed]', m).forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === v)); }); }

  m.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-pet-play]'))) return setPlay(!playing);
    if ((b = e.target.closest('[data-speed]'))) { setSpeed(Number(b.getAttribute('data-speed'))); if (!playing) setPlay(true); return; }
    if ((b = e.target.closest('.hx-ev'))) { setPlay(false); seek(Number(b.getAttribute('data-i'))); return; }
    if ((b = e.target.closest('[data-px-pet] button'))) { opt.pet = b.getAttribute('data-v'); recompute(); return; }
    if ((b = e.target.closest('[data-px-sky] button'))) { opt.sky = b.getAttribute('data-v'); recompute(); return; }
    if ((b = e.target.closest('[data-px-preset]'))) { var src = $$('.presets button', pz)[Number(b.getAttribute('data-px-preset'))]; if (src) src.click(); opt.pet = null; setTimeout(recompute, 30); }
  });
  $('.hx-scrub', m).addEventListener('input', function (e) { setPlay(false); seek(Number(e.target.value)); });
  document.addEventListener('ova:lang', function () { if (on) recompute(); });

  window.OvaPetApp = {
    open: function (step, done) {
      window.OvaLoadThree(function (ok) {
        if (!ok || !window.THREE) return done(false);
        try { scene = camp3d(stage); } catch (err) { return done(false); }
        step(t('Bringing in the PET'), 0.8);
        var go = function () { on = true; opt.pet = null; setSpeed(0.3); idx = 0; recompute(); done(true); setTimeout(function () { setPlay(true); }, 400); };
        if (window.OvaScenes && window.OvaScenes.model) window.OvaScenes.model('pet', 3.2, function (proto) { if (proto && scene) scene.usePet(proto); go(); });
        else go();
      });
    },
    close: function () { on = false; setPlay(false); if (scene) { scene.dispose(); scene = null; } }
  };
})();

/* App windows: heavy simulators open on demand, show a loading screen while the 3D engine and
   models arrive, and shut down completely when closed, so the page itself stays light. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var html = document.documentElement;

  // the planner's 3D stage lives in its app window
  var plStage = $('.planner .pl-scene'), houseSlot = $('#app-house .app-slot');
  if (plStage && houseSlot) houseSlot.appendChild(plStage);
  // windows sit at the top level so page transforms never clip them
  $$('.app-modal').forEach(function (m) { document.body.appendChild(m); });

  var APPS = {
    sandbox: {
      open: function (m, step, done) {
        step(tk('Loading the 3D engine'), 0.2);
        window.OvaScenes.preload([], function (ok) {
          if (!ok) return done(false);
          step(tk('Loading the house, NERD, solar and EV models'), 0.45);
          window.OvaScenes.preload(['house', 'nerd', 'solar', 'ev'], function () {
            step(tk('Building your system'), 0.85);
            window.OvaScenes.microgrid($('[data-scene="microgrid"]', m), function (sc) {
              m._sc = sc;
              if (!sc) return done(false);
              setTimeout(function () { done(true); if (window.OvaSandbox) window.OvaSandbox.play(true); }, 250);
            });
          });
        });
      },
      close: function (m) {
        if (window.OvaSandbox) window.OvaSandbox.play(false);
        if (m._sc) { m._sc.dispose(); m._sc = null; }
        window.OvaSystemScene = null;
      }
    },
    pet: {
      open: function (m, step, done) {
        if (!window.OvaPetApp) return done(false);
        step(tk('Loading the 3D engine'), 0.3);
        setTimeout(function () { step(tk('Setting up the camp'), 0.6); window.OvaPetApp.open(step, done); }, 60);
      },
      close: function () { if (window.OvaPetApp) window.OvaPetApp.close(); }
    },
    biz: {
      open: function (m, step, done, from) {
        if (!window.OvaBizApp) return done(false);
        step(tk('Loading the 3D engine'), 0.3);
        var type = from && from.getAttribute('data-biz');
        setTimeout(function () { step(tk('Building your business'), 0.6); window.OvaBizApp.open(step, done, type); }, 60);
      },
      close: function () { if (window.OvaBizApp) window.OvaBizApp.close(); }
    },
    town: {
      open: function (m, step, done, from) {
        if (!window.OvaTownApp) return done(false);
        window.OvaTownApp.scenario(from && from.getAttribute('data-scen') === 'storm' ? 'storm' : 'day');
        step(tk('Loading the 3D engine'), 0.3);
        setTimeout(function () { step(tk('Building your town'), 0.75); window.OvaTownApp.open(done); }, 60);
      },
      close: function () { if (window.OvaTownApp) window.OvaTownApp.close(); }
    },
    house: {
      open: function (m, step, done) {
        var pl = $('.planner'); if (!pl || !pl._planner) return done(false);
        step(tk('Loading the 3D engine'), 0.3);
        setTimeout(function () {
          step(tk('Building your house'), 0.75);
          pl._planner.open3d(function (ok) {
            if (ok && window.OvaHouseApp) window.OvaHouseApp.start();
            done(ok);
            if (ok) setTimeout(function () { pl._planner.setPlay(true); }, 400);
          });
        }, 60);
      },
      close: function (m) { var pl = $('.planner'); if (window.OvaHouseApp) window.OvaHouseApp.stop(); if (pl && pl._planner) { pl._planner.setPlay(false); pl._planner.close3d(); } }
    }
  };
  var current = null, opener = null;
  function open(name, from) {
    var m = document.getElementById('app-' + name), app = APPS[name];
    if (!m || !app || current) return;
    current = { m: m, app: app }; opener = from || document.activeElement;
    m.hidden = false; html.classList.add('app-open');
    m.classList.remove('ready', 'failed'); m.classList.add('loading');
    var bar = $('.app-progress i', m), label = $('.app-step', m);
    var step = function (text, k) { label.textContent = t(text); bar.style.width = Math.round(k * 100) + '%'; };
    requestAnimationFrame(function () { m.classList.add('in'); $('.app-close', m).focus(); });
    app.open(m, step, function (ok) {
      if (!current || current.m !== m) return;
      step(ok ? tk('Ready') : tk('3D is not available in this browser. The numbers below still work.'), 1);
      setTimeout(function () { m.classList.remove('loading'); m.classList.add(ok ? 'ready' : 'failed'); window.dispatchEvent(new Event('resize')); if (ok) document.dispatchEvent(new CustomEvent('ova:appready', { detail: { name: name, m: m } })); }, ok ? 200 : 0);
    }, from);
  }
  function close() {
    if (!current) return;
    var m = current.m, app = current.app; current = null;
    document.dispatchEvent(new CustomEvent('ova:appclose', { detail: { m: m } }));
    app.close(m);
    m.classList.remove('in');
    html.classList.remove('app-open');
    setTimeout(function () { m.hidden = true; m.classList.remove('ready', 'loading', 'failed'); }, 280);
    if (opener && opener.focus) opener.focus();
  }
  document.addEventListener('click', function (e) {
    var o = e.target.closest('[data-app-open]');
    if (o) { e.preventDefault(); open(o.getAttribute('data-app-open'), o); return; }
    if (e.target.closest('.app-close')) { close(); return; }
    if (current && e.target === current.m) close();
  });
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      // keep focus inside the window
      var f = $$('button, [href], input, select, [tabindex]:not([tabindex="-1"])', current.m).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('hashchange', function () { if (current) close(); });
  window.OvaApps = { open: open, close: close };
})();

/* File downloads (the PET spec guide). Inside the Claude artifact viewer, plain download links are
   blocked, so the file goes through the viewer's save prompt; everywhere else the link works as is. */
(function () {
  'use strict';
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[download]');
    if (!a || !window.claude || typeof window.claude.use !== 'function') return;
    e.preventDefault();
    var href = a.getAttribute('href'), name = href.split('/').pop();
    window.claude.use('downloads').then(function (dl) {
      if (!dl) { window.open(href, '_blank', 'noopener'); return; }
      return fetch(href).then(function (r) { if (!r.ok) throw new Error('fetch'); return r.blob(); })
        .then(function (blob) { return dl.save({ filename: name, data: blob }); })
        .catch(function (err) { if (err && err.code === 'declined') return; if (!err || !err.code) window.open(href, '_blank', 'noopener'); });
    });
  });
})();

/* Mission Control: toolbar, guided first run, share card, book-from-inside and sound for every simulator window. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var I = {
    sound: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w1" d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path class="w2" d="M18 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
    help: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/></svg>',
    panel: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
    chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>'
  };
  var TOPIC = { sandbox: 'Home microgrid', house: 'Home microgrid', biz: 'Commercial microgrid', town: 'Power Towns', pet: 'PET' };
  var SIM = { sandbox: tk('microgrid simulator'), house: tk('outage control room'), biz: tk('business simulator'), town: tk('town control room'), pet: tk('deployment simulator') };

  /* ---------- toolbar ---------- */
  $$('.app-modal').forEach(function (m) {
    m.classList.add('mc');
    var name = m.id.replace('app-', ''), bar = $('.app-bar', m), close = $('.app-close', bar);
    var hx = !!$('.hx-side', m);
    var tools = document.createElement('div'); tools.className = 'mc-tools';
    tools.innerHTML =
      '<span class="mc-live" aria-hidden="true"><i></i>' + t('Live') + '</span>' +
      '<button type="button" class="mc-tool icon" data-mc="sound" aria-pressed="false" aria-label="' + t('Sound') + '">' + I.mute + '</button>' +
      '<button type="button" class="mc-tool icon" data-mc="tour" aria-label="' + t('How to use this') + '">' + I.help + '</button>' +
      (hx ? '<button type="button" class="mc-tool icon mc-panel-btn" data-mc="panel" aria-pressed="true" aria-label="' + t('Show or hide the side panel') + '">' + I.panel + '</button>' : '') +
      '<button type="button" class="mc-tool" data-mc="share">' + I.share + '<span>' + t('Share result') + '</span></button>' +
      '<button type="button" class="mc-tool primary" data-mc="book">' + I.chat + '<span>' + t('Talk to us about this setup') + '</span></button>';
    bar.insertBefore(tools, close);
    tools.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mc]'); if (!b) return;
      var k = b.getAttribute('data-mc');
      if (k === 'sound') setSound(!soundOn);
      if (k === 'tour') tour(m, true);
      if (k === 'panel') { var off = m.classList.toggle('mc-collapsed'); b.setAttribute('aria-pressed', String(!off)); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 460); }
      if (k === 'share') share(m, name);
      if (k === 'book') book(m, name);
    });
  });

  /* ---------- reading a window's current result ---------- */
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function readout(m, name) {
    var r = { title: clean(($('.app-bar h3', m) || {}).textContent), verdict: '', status: '', stats: [], settings: [] };
    if (name === 'sandbox') {
      r.verdict = clean(($('.sbx-verdict', m) || {}).textContent);
      r.status = clean(($('.sbx-sub', m) || {}).textContent);
      $$('.sbx-parts > li', m).forEach(function (li) {
        var l = $('.sbx-part b', li), o = $('output', li), tg = $('.sbx-toggle', li), rd = $('input:checked', li);
        var v = o ? clean(o.textContent) : tg ? (tg.getAttribute('aria-pressed') === 'true' ? t('On') : t('Off')) : rd ? clean(rd.nextElementSibling.textContent) : '';
        if (l && v) { r.settings.push([clean(l.textContent), v]); if (r.stats.length < 4) r.stats.push([clean(l.textContent), v]); }
      });
    } else {
      r.verdict = clean(($('.hx-verdict', m) || {}).textContent);
      var st = $('.hx-status b', m); r.status = st ? clean(st.textContent) + ' · ' + clean(($('.hx-time', m) || {}).textContent) : '';
      if (name === 'biz') { r.stats.push([t('Without a microgrid'), clean($('[data-bx="costA"]', m).textContent)]); r.stats.push([t('With Ovanova'), clean($('[data-bx="costB"]', m).textContent)]); }
      var bv = $('.hx-batt-v b', m); if (bv) r.stats.push([clean($('.hx-batt-v span', m).textContent) + ' ' + t('now'), clean(bv.textContent)]);
      $$('.hx-row', m).forEach(function (row) {
        var l = row.firstElementChild, v = $('button[aria-pressed="true"], b', row);
        if (l && v && !row.closest('[hidden]')) r.settings.push([clean(l.textContent), clean(v.textContent)]);
      });
      r.settings.forEach(function (s) { if (r.stats.length < 4 && !r.stats.some(function (x) { return x[0] === s[0]; })) r.stats.push(s); });
    }
    return r;
  }

  /* ---------- book from inside: settings travel into the contact form ---------- */
  function book(m, name) {
    var r = readout(m, name), lines = [t('My setup from the Ovanova {tool}:', { tool: t(SIM[name]) })];
    if (r.title) lines.push(r.title);
    if (r.verdict) lines.push(r.verdict);
    r.stats.concat(r.settings).forEach(function (s, i, a) { if (a.findIndex(function (x) { return x[0] === s[0]; }) === i) lines.push('- ' + s[0] + ': ' + s[1]); });
    var brief = { topic: TOPIC[name] || '', text: lines.join('\n'), from: t(SIM[name]) };
    if (window.OvaBrief) window.OvaBrief.store(brief);
    if (window.OvaApps) window.OvaApps.close();
    setTimeout(function () {
      if (document.documentElement.hasAttribute('data-spa')) { if (window.OvaBrief) window.OvaBrief.fill(); location.hash = 'contact-form'; }
      else location.href = 'contact.html#contact-form';
    }, 320);
  }

  /* ---------- share card ---------- */
  function wrap(ctx, text, max) { var words = text.split(' '), lines = [], cur = ''; words.forEach(function (w) { var tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > max && cur) { lines.push(cur); cur = w; } else cur = tst; }); if (cur) lines.push(cur); return lines; }
  function card(m, name) {
    var r = readout(m, name), W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#04070c'); g.addColorStop(1, '#0a1a2c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    var rg = x.createRadialGradient(W * 0.85, -40, 10, W * 0.85, -40, 620); rg.addColorStop(0, 'rgba(46,173,247,0.45)'); rg.addColorStop(1, 'rgba(46,173,247,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    // grab the live 3D frame if the browser allows it
    var cv = $('canvas', m);
    if (cv) { try { x.save(); x.globalAlpha = 0.5; var cw = 520, ch = cw * cv.height / Math.max(1, cv.width); x.beginPath(); x.rect(W - cw - 60, 120, cw, Math.min(ch, 330)); x.clip(); x.drawImage(cv, W - cw - 60, 120, cw, ch); x.restore(); } catch (e) {} }
    x.fillStyle = '#eef3f7'; x.font = '300 30px Michroma, Arial'; x.fillText('OVANOVA', 64, 86);
    x.fillStyle = '#5cc3ff'; x.font = '400 18px Michroma, Arial'; x.fillText(t(SIM[name]).toUpperCase(), 64, 140);
    x.fillStyle = '#ffffff'; x.font = '300 46px Sora, Arial'; var y = 206;
    wrap(x, r.title || '', 620).slice(0, 2).forEach(function (l) { x.fillText(l, 64, y); y += 56; });
    x.fillStyle = '#9eabb8'; x.font = '400 24px Manrope, Arial'; y += 8;
    wrap(x, r.verdict || r.status || '', 600).slice(0, 4).forEach(function (l) { x.fillText(l, 64, y); y += 34; });
    var sx = 64; r.stats.slice(0, 4).forEach(function (s) {
      x.font = '400 14px Michroma, Arial'; var lw = Math.max(x.measureText(s[0].toUpperCase()).width, 120); x.font = '300 34px Sora, Arial'; var vw = x.measureText(s[1]).width; var w = Math.min(Math.max(lw, vw) + 44, 300);
      if (sx + w > W - 40) return;
      x.fillStyle = 'rgba(140,200,255,0.08)'; x.strokeStyle = 'rgba(140,200,255,0.25)'; x.lineWidth = 1.5;
      if (x.roundRect) { x.beginPath(); x.roundRect(sx, 478, w, 96, 18); x.fill(); x.stroke(); } else { x.fillRect(sx, 478, w, 96); }
      x.fillStyle = '#8fd3ff'; x.font = '400 13px Michroma, Arial'; x.fillText(s[0].toUpperCase().slice(0, 24), sx + 22, 510);
      x.fillStyle = '#ffffff'; x.font = '300 32px Sora, Arial'; x.fillText(s[1].slice(0, 16), sx + 22, 555);
      sx += w + 14;
    });
    x.fillStyle = '#6b7a88'; x.font = '400 18px Manrope, Arial'; x.fillText(t('Run your own scenario at ovanova.co'), W - 400, H - 34);
    return c;
  }
  function share(m, name) {
    var c = card(m, name), frame = $('.app-frame', m), old = $('.mc-share', frame); if (old) old.remove();
    var url = c.toDataURL('image/png');
    var ov = document.createElement('div'); ov.className = 'mc-share';
    ov.innerHTML = '<div class="mc-share-box mc-glass" role="dialog" aria-label="' + t('Share result') + '"><img alt="' + t('Your result card') + '"><div class="mc-share-row"><span class="note">' + t('A picture of your result, ready to send.') + '</span><button type="button" class="mc-tool" data-s="close">' + t('Close') + '</button><button type="button" class="mc-tool primary" data-s="go">' + I.share + '<span>' + t('Share or save') + '</span></button></div></div>';
    $('img', ov).src = url; frame.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b && e.target !== ov) return;
      if (!b || b.getAttribute('data-s') === 'close') { ov.remove(); return; }
      c.toBlob(function (blob) {
        var file = new File([blob], 'ovanova-' + name + '-result.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Ovanova', text: t('My result from the Ovanova {tool}', { tool: t(SIM[name]) }) }).catch(function () {}); return; }
        var fallback = function () { var a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
        if (window.claude && window.claude.use) window.claude.use('downloads').then(function (dl) { if (!dl) return fallback(); dl.save({ filename: file.name, data: blob }).catch(function () {}); }); else fallback();
      }, 'image/png');
    });
  }

  /* ---------- guided first run ---------- */
  var STEPS = [
    { sel: '.app-slot, .sbx-stage .s3', k: tk('Look around'), h: tk('Drag to look around'), p: tk('Turn the scene with a finger or the mouse. Every label shows what that part is doing right now.') },
    { sel: '.hx-transport, .sbx-clock', k: tk('Run the clock'), h: tk('Press play, or drag the timeline'), p: tk('Watch the day unfold, or jump straight to the moment the grid goes down.') },
    { sel: '.hx-tune, .sbx > .glass:last-child, .sbx-parts', k: tk('Make it yours'), h: tk('Try a change'), p: tk('Add a battery, more solar or a longer outage. Everything updates instantly.') }
  ];
  function tour(m, force) {
    var key = 'ova-mc-tour';
    if (!force && store.get(key)) return;
    store.set(key, '1');
    var frame = $('.app-frame', m), old = $('.mc-tour', frame); if (old) old.remove();
    var ov = document.createElement('div'); ov.className = 'mc-tour';
    ov.innerHTML = '<div class="mc-ring"></div><div class="mc-tip mc-glass" role="dialog" aria-live="polite"><span class="label"></span><h4></h4><p></p><div class="mc-tip-row"><span class="mc-dots">' + STEPS.map(function () { return '<i></i>'; }).join('') + '</span><button type="button" data-t="skip">' + t('Skip') + '</button><button type="button" class="go" data-t="next"></button></div></div>';
    frame.appendChild(ov);
    var i = 0, ring = $('.mc-ring', ov), tip = $('.mc-tip', ov);
    function show() {
      var s = STEPS[i], target = $(s.sel, m);
      $('.label', tip).textContent = t(s.k); $('h4', tip).textContent = t(s.h); $('p', tip).textContent = t(s.p);
      $('[data-t="next"]', tip).textContent = i < STEPS.length - 1 ? t('Next') : t('Got it');
      $$('.mc-dots i', tip).forEach(function (d, j) { d.classList.toggle('on', j === i); });
      var fr = frame.getBoundingClientRect(), r = target && target.offsetParent ? target.getBoundingClientRect() : { left: fr.left + fr.width * 0.3, top: fr.top + fr.height * 0.3, width: fr.width * 0.4, height: fr.height * 0.3 };
      var L = Math.max(8, r.left - fr.left - 6), T = Math.max(8, r.top - fr.top - 6), W = Math.min(fr.width - L - 8, r.width + 12), H = Math.min(fr.height - T - 8, r.height + 12);
      if (i === 0) { L += W * 0.25; T += H * 0.2; W *= 0.5; H *= 0.5; }
      ring.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + W + 'px;height:' + H + 'px';
      var tw = tip.offsetWidth || 340, th = tip.offsetHeight || 180;
      var tl = Math.min(fr.width - tw - 16, Math.max(16, L + W / 2 - tw / 2));
      var tt = T + H + 14 + th < fr.height ? T + H + 14 : Math.max(16, T - th - 14);
      tip.style.left = tl + 'px'; tip.style.top = tt + 'px';
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      if (b.getAttribute('data-t') === 'skip' || i === STEPS.length - 1) { ov.remove(); return; }
      i++; show();
    });
    requestAnimationFrame(show);
  }

  /* ---------- sound: synthesized, quiet, off until asked ---------- */
  var soundOn = store.get('ova-mc-sound') === '1', ac = null, hum = null, openM = null;
  function ctx() { if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); } if (ac.state === 'suspended') ac.resume(); return ac; }
  function env(node, a, peak, d) { var g = ac.createGain(), n = ac.currentTime; g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(peak, n + a); g.gain.exponentialRampToValueAtTime(0.0001, n + a + d); node.connect(g); g.connect(ac.destination); return g; }
  function tone(f1, f2, dur, type, peak) { if (!soundOn || !ctx()) return; var o = ac.createOscillator(), n = ac.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f1, n); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + dur); env(o, 0.02, peak || 0.08, dur); o.start(n); o.stop(n + dur + 0.1); }
  var SFX = {
    down: function () { tone(220, 38, 1.1, 'sawtooth', 0.05); tone(110, 30, 1.3, 'sine', 0.12); },
    up: function () { tone(523, 0, 0.9, 'sine', 0.06); setTimeout(function () { tone(784, 0, 1.1, 'sine', 0.05); }, 130); },
    tick: function () { tone(1200, 900, 0.08, 'triangle', 0.025); }
  };
  function startHum() {
    if (!soundOn || !ctx() || hum) return;
    var o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.frequency.value = 60; o2.frequency.value = 120; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.0001;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o1.start(); o2.start();
    g.gain.exponentialRampToValueAtTime(0.018, ac.currentTime + 1.2);
    hum = { g: g, stop: function () { g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4); setTimeout(function () { o1.stop(); o2.stop(); }, 500); } };
  }
  function stopHum() { if (hum) { hum.stop(); hum = null; } }
  function setSound(on) {
    soundOn = on; store.set('ova-mc-sound', on ? '1' : '0');
    $$('[data-mc="sound"]').forEach(function (b) { b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? I.sound : I.mute; b.setAttribute('aria-label', on ? t('Sound on') : t('Sound off')); });
    if (on && openM) { startHum(); SFX.tick(); } else stopHum();
  }
  setSound(soundOn);
  // react to what happens in the scene
  var mood = function (m) {
    var s = $('.hx-status', m); if (s) return /hx-bad/.test(s.className) ? 'bad' : /hx-sun/.test(s.className) ? 'sun' : 'ok';
    var sb = $('.sbx', m); if (sb) return sb.classList.contains('is-dark') ? 'bad' : 'ok';
    return 'ok';
  };
  $$('.app-modal').forEach(function (m) {
    var last = null;
    new MutationObserver(function () {
      if (openM !== m) return;
      var now = mood(m); if (now === last) return;
      if (last !== null) { if (now === 'bad') SFX.down(); else if (last === 'bad' || now === 'sun') SFX.up(); }
      last = now;
    }).observe(m, { attributes: true, attributeFilter: ['class'], subtree: true });
  });

  document.addEventListener('ova:appready', function (e) {
    openM = e.detail.m; if (soundOn) startHum();
    setTimeout(function () { if (openM) tour(openM, false); }, 700);
  });
  document.addEventListener('ova:appclose', function () { openM = null; stopHum(); });
  window.OvaMC = { tour: tour, readout: readout };
})();

/* Energy layer: faint grid and glows behind the page, a thin spine that fills as you scroll,
   a node for every section, numbered section dividers, and one-time light pulses.
   Everything is driven by scroll position with transforms only. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var bg = document.createElement('div'); bg.className = 'bgfx'; bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = '<i class="bg-grid"></i><i class="bg-glow a"></i><i class="bg-glow b"></i>';
  document.body.insertBefore(bg, document.body.firstChild);
  var rail = document.createElement('div'); rail.className = 'rail'; rail.setAttribute('aria-hidden', 'true');
  rail.innerHTML = '<i class="rail-track"></i><i class="rail-fill"></i><i class="rail-head"></i>';
  document.body.appendChild(rail);

  var page = null, nodes = [], max = 1, railH = 1, lastY = -1, queued = false;
  var lit = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('lit'); lit.unobserve(e.target); } });
  }, { threshold: 0.6, rootMargin: '0px 0px -6% 0px' }) : null;

  function skipBand(s) {
    if (s.style.paddingTop || s.classList.contains('pband-sec')) return true;
    var w = $(':scope > .wrap', s), f = w && w.firstElementChild;
    return !w || !f || f.classList.contains('pband') || f.classList.contains('team-strip') || f.classList.contains('sdiv');
  }
  function build(pg) {
    page = pg; nodes.forEach(function (n) { n.el.remove(); }); nodes = [];
    $$('.sdiv', pg).forEach(function (d) { d.remove(); });
    var secs = $$(':scope > section', pg), n = 0;
    secs.forEach(function (s) {
      if (s.classList.contains('band') && !skipBand(s)) {
        n++;
        var d = document.createElement('div'); d.className = 'sdiv'; d.setAttribute('aria-hidden', 'true');
        d.innerHTML = '<span class="sn">' + (n < 10 ? '0' : '') + n + '</span><i class="sl"></i>';
        $(':scope > .wrap', s).insertBefore(d, $(':scope > .wrap', s).firstChild);
        if (lit && !calm) lit.observe(d); else d.classList.add('lit');
      }
      var el = document.createElement('i'); el.className = 'rail-node'; rail.appendChild(el);
      nodes.push({ sec: s, el: el, p: 0, on: false });
    });
    $$('.cards .card', pg).forEach(function (c) { if (lit && !calm) lit.observe(c); else c.classList.add('lit'); });
    measure();
  }
  function measure() {
    queued = false; if (!page) return;
    var vh = window.innerHeight; max = Math.max(1, document.documentElement.scrollHeight - vh); railH = rail.clientHeight || 1;
    var y = window.scrollY;
    nodes.forEach(function (n) {
      var top = n.sec.getBoundingClientRect().top + y;
      n.p = clamp((top - vh * 0.4) / max, 0, 1); n.el.style.top = (n.p * railH).toFixed(1) + 'px'; n.on = null;
    });
    lastY = -1; tick(y, max);
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(measure); } }
  function tick(y, m) {
    if (!page) return;
    if (m) max = m;
    if (y === lastY) return; lastY = y;
    var p = clamp(y / max, 0, 1);
    rail.style.setProperty('--rp', p.toFixed(4));
    rail.style.setProperty('--rh', (p * railH).toFixed(1) + 'px');
    bg.style.setProperty('--bgp', p.toFixed(4));
    for (var i = 0; i < nodes.length; i++) { var on = p >= nodes[i].p - 0.0005; if (on !== nodes[i].on) { nodes[i].on = on; nodes[i].el.classList.toggle('on', on); } }
  }

  window.OvaRail = { page: build, tick: tick, measure: schedule };
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  document.addEventListener('ova:lang', function () { setTimeout(schedule, 60); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(schedule); ro.observe(document.body); }
  var first = $('.page:not([hidden])') || $('.page');
  if (first) build(first);
})();
