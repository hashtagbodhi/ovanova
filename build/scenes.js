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
