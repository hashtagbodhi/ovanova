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
