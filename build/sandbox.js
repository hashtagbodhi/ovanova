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
