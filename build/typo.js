/* Typography: no single-word last lines, and help buttons never wrap alone.
   Joins the last two words of short text blocks with a no-break space. Works in every browser
   (CSS text-wrap: pretty is not everywhere yet) and runs again after a language switch.
   Every join is measured afterwards and undone if it would push text past its box or the screen. */
(function () {
  'use strict';
  var NB = ' ';
  var SEL = 'h1, h2, h3, h4, p, li, figcaption, blockquote, .label, .lead, .small, .tool-note, .btn, .hx-ev span, .app-points li, dd, dt, legend, label > span:not(:has(small))';
  function lastText(el) {
    // the last non-empty text node that is part of the flowing text (not inside an svg or a help button)
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_SKIP;
      var p = n.parentNode;
      while (p && p !== el) { if (p.nodeName === 'svg' || (p.classList && (p.classList.contains('tipq') || p.classList.contains('arrow') || p.classList.contains('w')))) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
      return NodeFilter.FILTER_ACCEPT;
    } });
    var last = null, n; while ((n = w.nextNode())) last = n; return last;
  }
  function fix(el, done) {
    // hero headlines already have their line breaks set by hand
    if (el.closest('.statement, .hx-tags, .s3-labels, .app-loading, svg, .giant, h1.lines')) return;
    var n = lastText(el); if (!n) return;
    // "3-day", "20-year", "72-hour": a number and its unit never split at the hyphen
    if (/\d-[A-Za-z\u00c0-\u017f]/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/(\d)-(?=[A-Za-z\u00c0-\u017f])/g, '$1\u2011');
    var v = n.nodeValue, m = v.match(/^([\s\S]*\S)[ \t\n]+(\S+)(\s*)$/);
    if (!m) return;
    var words = el.textContent.trim().split(/\s+/).length;
    var prev = (m[1].match(/(\S+)$/) || ['', ''])[1];
    if (words < 3 || m[2].length + prev.length > 28) return;
    n.nodeValue = m[1] + NB + m[2] + m[3];
    done.push({ el: el, n: n, old: v });
  }
  function glueHelp(q, done) {
    // a no-break space before the help button keeps it on the line with the word before it
    var t = q.previousSibling;
    if (t && t.nodeType === 3 && /[ \t\n]$/.test(t.nodeValue)) { var old = t.nodeValue, v = old.replace(/\s+$/, ''); if (v) { t.nodeValue = v + NB; done.push({ el: q.parentNode, n: t, old: old }); } }
  }
  function verify(done) {
    if (!done.length) return;
    // one layout pass: read every changed block, then undo the joins that overflow
    var vw = document.documentElement.clientWidth;
    var bad = done.filter(function (d) {
      var el = d.el; if (!el.isConnected || !el.offsetParent) return false;
      // measure the block and its own container (cards in a swipe row are allowed to sit off screen)
      var par = el.parentNode;
      return el.getBoundingClientRect().width > vw || el.scrollWidth > el.clientWidth + 1 || (par && par.scrollWidth > par.clientWidth + 1);
    });
    bad.forEach(function (d) { if (d.n.isConnected) d.n.nodeValue = d.old; });
  }
  function run(root) {
    root = root || document; var done = [];
    Array.prototype.forEach.call(root.querySelectorAll(SEL), function (el) { fix(el, done); });
    Array.prototype.forEach.call(root.querySelectorAll('.tipq'), function (q) { glueHelp(q, done); });
    verify(done);
  }
  run();
  document.addEventListener('ova:lang', function () { setTimeout(run, 30); });
  // tools rewrite verdicts, tips and timelines as you change inputs: tidy those too
  if ('MutationObserver' in window) {
    var queue = [], pending = false;
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var t = ms[i].target; if (t.nodeType !== 1 || t.closest('.hx-tags, .s3-labels, svg, .statement')) continue;
        queue.push(t);
      }
      if (!pending && queue.length) { pending = true; requestAnimationFrame(function () {
        pending = false; var q = queue.splice(0), done = [];
        q.forEach(function (t) { if (t.matches(SEL)) fix(t, done); else if (t.children.length) Array.prototype.forEach.call(t.querySelectorAll(SEL), function (el) { fix(el, done); }); });
        verify(done);
      }); }
    }).observe(document.body, { childList: true, subtree: true });
  }
  window.OvaTypo = run;
})();
