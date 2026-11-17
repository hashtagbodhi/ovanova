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
