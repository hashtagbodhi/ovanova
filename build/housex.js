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
