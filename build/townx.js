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
