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
