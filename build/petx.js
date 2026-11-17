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
