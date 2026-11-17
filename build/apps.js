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
