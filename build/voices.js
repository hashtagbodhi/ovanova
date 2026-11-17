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
