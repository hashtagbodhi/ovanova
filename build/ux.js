/* Ovanova tool UX: presets, result handoff to the contact form, plain-language explainers, planner dock. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var SPA = document.documentElement.hasAttribute('data-spa');

  /* ---------- Presets: one tap to a realistic starting point ---------- */
  function clearPressed(group) { $$('[data-set],[data-loads]', group).forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); }
  $$('.presets').forEach(function (group) {
    var tool = group.closest('[data-tool]');
    var target = $('.pl-controls', tool) || tool;
    $$('button', group).forEach(function (btn) {
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', function () {
        if (btn.dataset.loads) {
          var want = btn.dataset.loads.split(' ');
          $$('input[name="pl-load"]', tool).forEach(function (i) { i.checked = want.indexOf(i.value) > -1; });
        }
        if (btn.dataset.set) {
          var set = JSON.parse(btn.dataset.set);
          Object.keys(set).forEach(function (k) {
            var el = tool.querySelector('#' + k);
            if (el) { if (el.type === 'radio' || el.type === 'checkbox') el.checked = !!set[k]; else el.value = set[k]; return; }
            var radio = tool.querySelector('input[type="radio"][name="' + k + '"][value="' + set[k] + '"]');
            if (radio) { radio.checked = true; return; }
            var out = tool.querySelector('[data-field="' + k + '"] output');
            if (out) out.textContent = set[k];
          });
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        clearPressed(group); btn.setAttribute('aria-pressed', 'true');
      });
    });
    // a manual change means the preset no longer describes what is on screen
    tool.addEventListener('input', function (e) { if (e.isTrusted) clearPressed(group); });
    tool.addEventListener('click', function (e) { if (e.isTrusted && e.target.closest('.step-ctl')) clearPressed(group); });
  });

  /* ---------- Send results to Ovanova ---------- */
  var NAMES = { planner: tk('outage planner'), exposure: tk('outage cost calculator'), peak: tk('peak shaving tool'), pet: tk('PET sizer') };
  var TOPIC = { planner: 'Home microgrid', exposure: 'Commercial microgrid', peak: 'Power Towns', reliability: 'Power Towns', pet: 'PET', 'nerd-run': 'NERD' };
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  // text of an element without explainer buttons or small captions
  function txt(el) { if (!el) return ''; var c = el.cloneNode(true); $$('.tipq, small', c).forEach(function (x) { x.parentNode.removeChild(x); }); return clean(c.textContent); }
  function brief(tool) {
    var kind = tool.getAttribute('data-tool');
    var sec = tool.closest('section');
    var name = t(NAMES[kind] || '');
    var lines = [t('My results from the Ovanova {tool}:', { tool: name })];
    var verdict = $('.pl-verdict', tool);
    if (verdict && clean(verdict.textContent)) lines.push(clean(verdict.textContent));
    var tip = $('.pl-tip', tool); if (tip && clean(tip.textContent)) lines.push(clean(tip.textContent));
    if (kind === 'exposure') lines.push(txt($('.ex-total', tool).previousElementSibling) + ': ' + clean($('.ex-total', tool).textContent));
    if (kind === 'peak') lines.push(txt($('.ps-save', tool).previousElementSibling) + ': ' + clean($('.ps-save', tool).textContent));
    $$('.kv-row .kv', tool).forEach(function (kv) {
      var l = $('.label', kv), v = $('b', kv);
      if (l && v) lines.push('- ' + txt(l) + ': ' + clean(v.textContent));
    });
    var inputs = [];
    var loads = $$('input[name="pl-load"]:checked', tool).map(function (i) { return clean(i.nextElementSibling.firstChild.textContent); });
    if (loads.length) inputs.push(t('Must stay on') + ': ' + loads.join(', '));
    $$('.segs input:checked', tool).forEach(function (i) {
      var fs = i.closest('fieldset'); var lg = fs && $('legend', fs);
      if (lg && !i.closest('.viz-switch')) inputs.push(txt(lg) + ': ' + txt(i.nextElementSibling));
    });
    $$('.ctl', tool).forEach(function (c) {
      var l = $('label span, .ctl-top > span', c), o = $('output', c);
      if (l && o) inputs.push(txt(l) + ': ' + clean(o.textContent));
    });
    $$('[data-field]', tool).forEach(function (r) {
      var n = Number($('output', r).textContent);
      if (n > 0) inputs.push(clean(r.firstElementChild.firstChild.textContent) + ' × ' + n);
    });
    if (inputs.length) { lines.push(''); lines.push(t('What I entered') + ':'); inputs.forEach(function (x) { lines.push('- ' + x); }); }
    return { topic: TOPIC[kind] || '', text: lines.join('\n'), from: name };
  }
  function store(b) {
    window.__ovaBrief = b;
    try { sessionStorage.setItem('ova-brief', JSON.stringify(b)); } catch (e) {}
  }
  function take() {
    var b = window.__ovaBrief;
    if (!b) { try { b = JSON.parse(sessionStorage.getItem('ova-brief') || 'null'); } catch (e) { b = null; } }
    return b;
  }
  function fillContact() {
    var b = take(); if (!b) return;
    var msg = $('#ct-msg'), topic = $('#ct-topic'), note = $('.brief-note');
    if (!msg) return;
    msg.value = b.text + '\n\n' + (msg.value || '');
    msg.style.minHeight = Math.min(420, 60 + b.text.split('\n').length * 22) + 'px';
    if (topic && b.topic) topic.value = b.topic;
    if (note) { $('.brief-from', note).textContent = b.from; note.hidden = false; }
    window.__ovaBrief = null;
    try { sessionStorage.removeItem('ova-brief'); } catch (e) {}
  }
  $$('[data-send]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      store(brief(btn.closest('[data-tool]')));
      if (SPA) { fillContact(); location.hash = 'contact-form'; }
      else location.href = 'contact.html#contact-form';
    });
  });
  if (!SPA) fillContact();
  window.OvaBrief = { store: store, fill: fillContact };

  /* ---------- Plain-language explainers ---------- */
  var GLOSS = {
    kwh: tk('kW is power: how much is being used right now. kWh is energy: power over time. A 1 kW heater running for 3 hours uses 3 kWh.'),
    peak: tk('Peak demand is the most power drawn at a single moment, for example when the AC, well pump and oven all start together. Batteries and inverters must be sized for it.'),
    demand: tk('A demand charge is a monthly fee for each kW of your single highest peak, on top of the energy you use. Shaving that one peak lowers the whole charge.'),
    island: tk('Islanding means the microgrid disconnects from the utility during an outage and keeps running on its own sources, then reconnects when the grid is back.'),
    saidi: tk('Standard utility reliability scores (IEEE 1366). SAIFI: how often the average customer loses power. SAIDI: total minutes out per year. CAIDI: how long each outage lasts.'),
    duration: tk('Duration is how many hours the battery can deliver its full power. A 4 MW battery with 4 hours of duration stores 16 MWh.')
  };
  var open = null;
  function closeTip() { if (open) { open.btn.setAttribute('aria-expanded', 'false'); open.pop.remove(); open = null; } }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.tipq');
    if (!b) { if (open && !e.target.closest('.tip-pop')) closeTip(); return; }
    e.preventDefault(); e.stopPropagation();
    if (open && open.btn === b) { closeTip(); return; }
    closeTip();
    var pop = document.createElement('div');
    pop.className = 'tip-pop'; pop.setAttribute('role', 'tooltip'); pop.id = 'tip-' + b.dataset.tip;
    pop.textContent = t(GLOSS[b.dataset.tip] || '');
    document.body.appendChild(pop);
    var r = b.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 32);
    pop.style.width = w + 'px';
    var left = Math.max(16, Math.min(window.innerWidth - w - 16, r.left + r.width / 2 - w / 2));
    var top = r.bottom + 10 + window.scrollY;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-describedby', pop.id);
    open = { btn: b, pop: pop };
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTip(); });
  window.addEventListener('scroll', function () { if (open && Math.abs(open.btn.getBoundingClientRect().top) > window.innerHeight) closeTip(); }, { passive: true });

  /* ---------- Planner: live answer docked on phones while adjusting ---------- */
  $$('[data-tool="planner"]').forEach(function (tool) {
    var dock = $('.pl-dock', tool), form = $('.pl-controls', tool), verdict = $('.pl-verdict', tool), result = $('.pl-result', tool);
    if (!dock || !('IntersectionObserver' in window)) return;
    var sync = function () {
      $('.pl-dock-v', dock).textContent = clean(verdict.textContent);
      var dark = /lights go out|se apagan/i.test(verdict.textContent);
      dock.classList.toggle('bad', dark);
    };
    new MutationObserver(sync).observe(verdict, { childList: true, characterData: true, subtree: true });
    sync();
    var queued = false;
    var upd = function () {
      queued = false;
      var vh = window.innerHeight, f = form.getBoundingClientRect(), r = result.getBoundingClientRect();
      var on = f.top < vh * 0.75 && f.bottom > vh * 0.35 && r.top > vh * 0.85;
      dock.classList.toggle('show', on);
    };
    var q = function () { if (!queued) { queued = true; requestAnimationFrame(upd); } };
    window.addEventListener('scroll', q, { passive: true }); window.addEventListener('resize', q); upd();
    dock.addEventListener('click', function () { result.scrollIntoView({ behavior: 'auto', block: 'start' }); });
  });
})();
