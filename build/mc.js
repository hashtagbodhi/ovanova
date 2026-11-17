/* Mission Control: toolbar, guided first run, share card, book-from-inside and sound for every simulator window. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var t = function (s, v) { return window.OvaT ? window.OvaT(s, v) : s; };
  var tk = function (s) { return s; };
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var I = {
    sound: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="w1" d="M15.5 9a4.5 4.5 0 0 1 0 6"/><path class="w2" d="M18 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>',
    help: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/></svg>',
    panel: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
    chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>'
  };
  var TOPIC = { sandbox: 'Home microgrid', house: 'Home microgrid', biz: 'Commercial microgrid', town: 'Power Towns', pet: 'PET' };
  var SIM = { sandbox: tk('microgrid simulator'), house: tk('outage control room'), biz: tk('business simulator'), town: tk('town control room'), pet: tk('deployment simulator') };

  /* ---------- toolbar ---------- */
  $$('.app-modal').forEach(function (m) {
    m.classList.add('mc');
    var name = m.id.replace('app-', ''), bar = $('.app-bar', m), close = $('.app-close', bar);
    var hx = !!$('.hx-side', m);
    var tools = document.createElement('div'); tools.className = 'mc-tools';
    tools.innerHTML =
      '<span class="mc-live" aria-hidden="true"><i></i>' + t('Live') + '</span>' +
      '<button type="button" class="mc-tool icon" data-mc="sound" aria-pressed="false" aria-label="' + t('Sound') + '">' + I.mute + '</button>' +
      '<button type="button" class="mc-tool icon" data-mc="tour" aria-label="' + t('How to use this') + '">' + I.help + '</button>' +
      (hx ? '<button type="button" class="mc-tool icon mc-panel-btn" data-mc="panel" aria-pressed="true" aria-label="' + t('Show or hide the side panel') + '">' + I.panel + '</button>' : '') +
      '<button type="button" class="mc-tool" data-mc="share">' + I.share + '<span>' + t('Share result') + '</span></button>' +
      '<button type="button" class="mc-tool primary" data-mc="book">' + I.chat + '<span>' + t('Talk to us about this setup') + '</span></button>';
    bar.insertBefore(tools, close);
    tools.addEventListener('click', function (e) {
      var b = e.target.closest('[data-mc]'); if (!b) return;
      var k = b.getAttribute('data-mc');
      if (k === 'sound') setSound(!soundOn);
      if (k === 'tour') tour(m, true);
      if (k === 'panel') { var off = m.classList.toggle('mc-collapsed'); b.setAttribute('aria-pressed', String(!off)); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 460); }
      if (k === 'share') share(m, name);
      if (k === 'book') book(m, name);
    });
  });

  /* ---------- reading a window's current result ---------- */
  function clean(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
  function readout(m, name) {
    var r = { title: clean(($('.app-bar h3', m) || {}).textContent), verdict: '', status: '', stats: [], settings: [] };
    if (name === 'sandbox') {
      r.verdict = clean(($('.sbx-verdict', m) || {}).textContent);
      r.status = clean(($('.sbx-sub', m) || {}).textContent);
      $$('.sbx-parts > li', m).forEach(function (li) {
        var l = $('.sbx-part b', li), o = $('output', li), tg = $('.sbx-toggle', li), rd = $('input:checked', li);
        var v = o ? clean(o.textContent) : tg ? (tg.getAttribute('aria-pressed') === 'true' ? t('On') : t('Off')) : rd ? clean(rd.nextElementSibling.textContent) : '';
        if (l && v) { r.settings.push([clean(l.textContent), v]); if (r.stats.length < 4) r.stats.push([clean(l.textContent), v]); }
      });
    } else {
      r.verdict = clean(($('.hx-verdict', m) || {}).textContent);
      var st = $('.hx-status b', m); r.status = st ? clean(st.textContent) + ' · ' + clean(($('.hx-time', m) || {}).textContent) : '';
      if (name === 'biz') { r.stats.push([t('Without a microgrid'), clean($('[data-bx="costA"]', m).textContent)]); r.stats.push([t('With Ovanova'), clean($('[data-bx="costB"]', m).textContent)]); }
      var bv = $('.hx-batt-v b', m); if (bv) r.stats.push([clean($('.hx-batt-v span', m).textContent) + ' ' + t('now'), clean(bv.textContent)]);
      $$('.hx-row', m).forEach(function (row) {
        var l = row.firstElementChild, v = $('button[aria-pressed="true"], b', row);
        if (l && v && !row.closest('[hidden]')) r.settings.push([clean(l.textContent), clean(v.textContent)]);
      });
      r.settings.forEach(function (s) { if (r.stats.length < 4 && !r.stats.some(function (x) { return x[0] === s[0]; })) r.stats.push(s); });
    }
    return r;
  }

  /* ---------- book from inside: settings travel into the contact form ---------- */
  function book(m, name) {
    var r = readout(m, name), lines = [t('My setup from the Ovanova {tool}:', { tool: t(SIM[name]) })];
    if (r.title) lines.push(r.title);
    if (r.verdict) lines.push(r.verdict);
    r.stats.concat(r.settings).forEach(function (s, i, a) { if (a.findIndex(function (x) { return x[0] === s[0]; }) === i) lines.push('- ' + s[0] + ': ' + s[1]); });
    var brief = { topic: TOPIC[name] || '', text: lines.join('\n'), from: t(SIM[name]) };
    if (window.OvaBrief) window.OvaBrief.store(brief);
    if (window.OvaApps) window.OvaApps.close();
    setTimeout(function () {
      if (document.documentElement.hasAttribute('data-spa')) { if (window.OvaBrief) window.OvaBrief.fill(); location.hash = 'contact-form'; }
      else location.href = 'contact.html#contact-form';
    }, 320);
  }

  /* ---------- share card ---------- */
  function wrap(ctx, text, max) { var words = text.split(' '), lines = [], cur = ''; words.forEach(function (w) { var tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > max && cur) { lines.push(cur); cur = w; } else cur = tst; }); if (cur) lines.push(cur); return lines; }
  function card(m, name) {
    var r = readout(m, name), W = 1200, H = 630, c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#04070c'); g.addColorStop(1, '#0a1a2c'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    var rg = x.createRadialGradient(W * 0.85, -40, 10, W * 0.85, -40, 620); rg.addColorStop(0, 'rgba(46,173,247,0.45)'); rg.addColorStop(1, 'rgba(46,173,247,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
    // grab the live 3D frame if the browser allows it
    var cv = $('canvas', m);
    if (cv) { try { x.save(); x.globalAlpha = 0.5; var cw = 520, ch = cw * cv.height / Math.max(1, cv.width); x.beginPath(); x.rect(W - cw - 60, 120, cw, Math.min(ch, 330)); x.clip(); x.drawImage(cv, W - cw - 60, 120, cw, ch); x.restore(); } catch (e) {} }
    x.fillStyle = '#eef3f7'; x.font = '300 30px Michroma, Arial'; x.fillText('OVANOVA', 64, 86);
    x.fillStyle = '#5cc3ff'; x.font = '400 18px Michroma, Arial'; x.fillText(t(SIM[name]).toUpperCase(), 64, 140);
    x.fillStyle = '#ffffff'; x.font = '300 46px Sora, Arial'; var y = 206;
    wrap(x, r.title || '', 620).slice(0, 2).forEach(function (l) { x.fillText(l, 64, y); y += 56; });
    x.fillStyle = '#9eabb8'; x.font = '400 24px Manrope, Arial'; y += 8;
    wrap(x, r.verdict || r.status || '', 600).slice(0, 4).forEach(function (l) { x.fillText(l, 64, y); y += 34; });
    var sx = 64; r.stats.slice(0, 4).forEach(function (s) {
      x.font = '400 14px Michroma, Arial'; var lw = Math.max(x.measureText(s[0].toUpperCase()).width, 120); x.font = '300 34px Sora, Arial'; var vw = x.measureText(s[1]).width; var w = Math.min(Math.max(lw, vw) + 44, 300);
      if (sx + w > W - 40) return;
      x.fillStyle = 'rgba(140,200,255,0.08)'; x.strokeStyle = 'rgba(140,200,255,0.25)'; x.lineWidth = 1.5;
      if (x.roundRect) { x.beginPath(); x.roundRect(sx, 478, w, 96, 18); x.fill(); x.stroke(); } else { x.fillRect(sx, 478, w, 96); }
      x.fillStyle = '#8fd3ff'; x.font = '400 13px Michroma, Arial'; x.fillText(s[0].toUpperCase().slice(0, 24), sx + 22, 510);
      x.fillStyle = '#ffffff'; x.font = '300 32px Sora, Arial'; x.fillText(s[1].slice(0, 16), sx + 22, 555);
      sx += w + 14;
    });
    x.fillStyle = '#6b7a88'; x.font = '400 18px Manrope, Arial'; x.fillText(t('Run your own scenario at ovanova.co'), W - 400, H - 34);
    return c;
  }
  function share(m, name) {
    var c = card(m, name), frame = $('.app-frame', m), old = $('.mc-share', frame); if (old) old.remove();
    var url = c.toDataURL('image/png');
    var ov = document.createElement('div'); ov.className = 'mc-share';
    ov.innerHTML = '<div class="mc-share-box mc-glass" role="dialog" aria-label="' + t('Share result') + '"><img alt="' + t('Your result card') + '"><div class="mc-share-row"><span class="note">' + t('A picture of your result, ready to send.') + '</span><button type="button" class="mc-tool" data-s="close">' + t('Close') + '</button><button type="button" class="mc-tool primary" data-s="go">' + I.share + '<span>' + t('Share or save') + '</span></button></div></div>';
    $('img', ov).src = url; frame.appendChild(ov);
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b && e.target !== ov) return;
      if (!b || b.getAttribute('data-s') === 'close') { ov.remove(); return; }
      c.toBlob(function (blob) {
        var file = new File([blob], 'ovanova-' + name + '-result.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'Ovanova', text: t('My result from the Ovanova {tool}', { tool: t(SIM[name]) }) }).catch(function () {}); return; }
        var fallback = function () { var a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); };
        if (window.claude && window.claude.use) window.claude.use('downloads').then(function (dl) { if (!dl) return fallback(); dl.save({ filename: file.name, data: blob }).catch(function () {}); }); else fallback();
      }, 'image/png');
    });
  }

  /* ---------- guided first run ---------- */
  var STEPS = [
    { sel: '.app-slot, .sbx-stage .s3', k: tk('Look around'), h: tk('Drag to look around'), p: tk('Turn the scene with a finger or the mouse. Every label shows what that part is doing right now.') },
    { sel: '.hx-transport, .sbx-clock', k: tk('Run the clock'), h: tk('Press play, or drag the timeline'), p: tk('Watch the day unfold, or jump straight to the moment the grid goes down.') },
    { sel: '.hx-tune, .sbx > .glass:last-child, .sbx-parts', k: tk('Make it yours'), h: tk('Try a change'), p: tk('Add a battery, more solar or a longer outage. Everything updates instantly.') }
  ];
  function tour(m, force) {
    var key = 'ova-mc-tour';
    if (!force && store.get(key)) return;
    store.set(key, '1');
    var frame = $('.app-frame', m), old = $('.mc-tour', frame); if (old) old.remove();
    var ov = document.createElement('div'); ov.className = 'mc-tour';
    ov.innerHTML = '<div class="mc-ring"></div><div class="mc-tip mc-glass" role="dialog" aria-live="polite"><span class="label"></span><h4></h4><p></p><div class="mc-tip-row"><span class="mc-dots">' + STEPS.map(function () { return '<i></i>'; }).join('') + '</span><button type="button" data-t="skip">' + t('Skip') + '</button><button type="button" class="go" data-t="next"></button></div></div>';
    frame.appendChild(ov);
    var i = 0, ring = $('.mc-ring', ov), tip = $('.mc-tip', ov);
    function show() {
      var s = STEPS[i], target = $(s.sel, m);
      $('.label', tip).textContent = t(s.k); $('h4', tip).textContent = t(s.h); $('p', tip).textContent = t(s.p);
      $('[data-t="next"]', tip).textContent = i < STEPS.length - 1 ? t('Next') : t('Got it');
      $$('.mc-dots i', tip).forEach(function (d, j) { d.classList.toggle('on', j === i); });
      var fr = frame.getBoundingClientRect(), r = target && target.offsetParent ? target.getBoundingClientRect() : { left: fr.left + fr.width * 0.3, top: fr.top + fr.height * 0.3, width: fr.width * 0.4, height: fr.height * 0.3 };
      var L = Math.max(8, r.left - fr.left - 6), T = Math.max(8, r.top - fr.top - 6), W = Math.min(fr.width - L - 8, r.width + 12), H = Math.min(fr.height - T - 8, r.height + 12);
      if (i === 0) { L += W * 0.25; T += H * 0.2; W *= 0.5; H *= 0.5; }
      ring.style.cssText = 'left:' + L + 'px;top:' + T + 'px;width:' + W + 'px;height:' + H + 'px';
      var tw = tip.offsetWidth || 340, th = tip.offsetHeight || 180;
      var tl = Math.min(fr.width - tw - 16, Math.max(16, L + W / 2 - tw / 2));
      var tt = T + H + 14 + th < fr.height ? T + H + 14 : Math.max(16, T - th - 14);
      tip.style.left = tl + 'px'; tip.style.top = tt + 'px';
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      if (b.getAttribute('data-t') === 'skip' || i === STEPS.length - 1) { ov.remove(); return; }
      i++; show();
    });
    requestAnimationFrame(show);
  }

  /* ---------- sound: synthesized, quiet, off until asked ---------- */
  var soundOn = store.get('ova-mc-sound') === '1', ac = null, hum = null, openM = null;
  function ctx() { if (!ac) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ac = new A(); } if (ac.state === 'suspended') ac.resume(); return ac; }
  function env(node, a, peak, d) { var g = ac.createGain(), n = ac.currentTime; g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(peak, n + a); g.gain.exponentialRampToValueAtTime(0.0001, n + a + d); node.connect(g); g.connect(ac.destination); return g; }
  function tone(f1, f2, dur, type, peak) { if (!soundOn || !ctx()) return; var o = ac.createOscillator(), n = ac.currentTime; o.type = type || 'sine'; o.frequency.setValueAtTime(f1, n); if (f2) o.frequency.exponentialRampToValueAtTime(f2, n + dur); env(o, 0.02, peak || 0.08, dur); o.start(n); o.stop(n + dur + 0.1); }
  var SFX = {
    down: function () { tone(220, 38, 1.1, 'sawtooth', 0.05); tone(110, 30, 1.3, 'sine', 0.12); },
    up: function () { tone(523, 0, 0.9, 'sine', 0.06); setTimeout(function () { tone(784, 0, 1.1, 'sine', 0.05); }, 130); },
    tick: function () { tone(1200, 900, 0.08, 'triangle', 0.025); }
  };
  function startHum() {
    if (!soundOn || !ctx() || hum) return;
    var o1 = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o1.frequency.value = 60; o2.frequency.value = 120; o2.type = 'triangle'; f.type = 'lowpass'; f.frequency.value = 260; g.gain.value = 0.0001;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o1.start(); o2.start();
    g.gain.exponentialRampToValueAtTime(0.018, ac.currentTime + 1.2);
    hum = { g: g, stop: function () { g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4); setTimeout(function () { o1.stop(); o2.stop(); }, 500); } };
  }
  function stopHum() { if (hum) { hum.stop(); hum = null; } }
  function setSound(on) {
    soundOn = on; store.set('ova-mc-sound', on ? '1' : '0');
    $$('[data-mc="sound"]').forEach(function (b) { b.setAttribute('aria-pressed', String(on)); b.innerHTML = on ? I.sound : I.mute; b.setAttribute('aria-label', on ? t('Sound on') : t('Sound off')); });
    if (on && openM) { startHum(); SFX.tick(); } else stopHum();
  }
  setSound(soundOn);
  // react to what happens in the scene
  var mood = function (m) {
    var s = $('.hx-status', m); if (s) return /hx-bad/.test(s.className) ? 'bad' : /hx-sun/.test(s.className) ? 'sun' : 'ok';
    var sb = $('.sbx', m); if (sb) return sb.classList.contains('is-dark') ? 'bad' : 'ok';
    return 'ok';
  };
  $$('.app-modal').forEach(function (m) {
    var last = null;
    new MutationObserver(function () {
      if (openM !== m) return;
      var now = mood(m); if (now === last) return;
      if (last !== null) { if (now === 'bad') SFX.down(); else if (last === 'bad' || now === 'sun') SFX.up(); }
      last = now;
    }).observe(m, { attributes: true, attributeFilter: ['class'], subtree: true });
  });

  document.addEventListener('ova:appready', function (e) {
    openM = e.detail.m; if (soundOn) startHum();
    setTimeout(function () { if (openM) tour(openM, false); }, 700);
  });
  document.addEventListener('ova:appclose', function () { openM = null; stopHum(); });
  window.OvaMC = { tour: tour, readout: readout };
})();
