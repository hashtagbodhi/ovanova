#!/usr/bin/env python3
"""Builds the Ovanova site two ways from the same sources:
  site/<page>.html   one file per page, for hosting anywhere
  site/ovanova.html  every page in one file with hash routing, for the Claude artifact
Run: python3 build/build.py
"""
import os, re, json
import i18n, icons, gen_voices, gen_people
gen_voices.write()

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'site')

PAGES = [
    # slug, file name, title, description
    ('home', 'index.html', 'Ovanova Energy', 'Turnkey microgrids for homes, businesses and communities. Solar, storage and intelligent controls that keep running when the grid does not.'),
    ('residential', 'residential.html', 'Home Microgrids | Ovanova', 'A residential microgrid keeps your home powered through outages and lowers your energy costs every day.'),
    ('commercial', 'commercial.html', 'Commercial Microgrids | Ovanova', 'Clean, continuous, self-managed power that keeps your business running when the grid does not.'),
    ('power-towns', 'power-towns.html', 'Power Towns | Ovanova', 'A turnkey program that helps towns and utilities deploy solar, storage and grid-resilient infrastructure.'),
    ('pet', 'pet.html', 'PET Portable Microgrids | Ovanova', 'Portable Energy Technology: mobile microgrids for emergencies, job sites and events.'),
    ('nerd', 'nerd.html', 'NERD | Ovanova', 'The National Energy Resilience Device. One big battery with the brains and connections to run your property.'),
    ('gridguardian', 'gridguardian.html', 'GridGuardian AI | Ovanova', 'Real-time intelligence for distributed energy: forecasting, fleet orchestration and zero-trust security.'),
    ('about', 'about.html', 'About | Ovanova', 'Ovanova is a full-stack microgrid company building resilient power for homes, businesses and communities.'),
    ('invest', 'invest.html', 'Invest | Ovanova', 'Invest in the future of resilient power: hardware, deployable microgrids and intelligent controls.'),
    ('contractors', 'contractors.html', 'Contractor Partners | Ovanova', 'Join a national contractor network building microgrids, solar systems and portable power.'),
    ('contact', 'contact.html', 'Contact | Ovanova', 'Reach the Ovanova team for support, projects, partnerships and investment.'),
]
FILE = {slug: f for slug, f, _, _ in PAGES}

CALENDLY = 'https://calendly.com/ovanova/build-your-personal-microgrid-design-workshop'
FONTS = 'https://fonts.googleapis.com/css2?family=Sora:wght@200;300;400;500&family=Manrope:wght@400;500;600&family=Michroma&display=swap'
MARK = 'url("data:image/png;base64,' + open(os.path.join(ROOT, 'media', 'mark.b64')).read().strip() + '")'

CHEV = '<svg class="chev" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5"/></svg>'
ARROW = '<span class="arrow" aria-hidden="true">→</span>'

def item(slug, name, desc):
    return f'<a class="item" href="@{slug}" data-nav="{slug}"><b>{name} {ARROW}</b><span>{desc}</span></a>'

def feature(slug, img, label, title):
    return (f'<a class="feature" href="@{slug}"><img src="img/{img}" alt="" loading="lazy">'
            f'<div><span class="label">{label}</span><b>{title}</b></div></a>')

NAV = f'''<a class="skip" href="#main">Skip to content</a>
<div class="nav-shell">
  <div class="nav glass">
    <a class="brand" href="@home" data-nav="home" aria-label="Ovanova home"><span class="mark" aria-hidden="true"></span><span class="wordmark">OVANOVA</span></a>
    <nav class="nav-links" aria-label="Main">
      <button type="button" data-mega aria-expanded="false" aria-controls="mega-sol">Solutions {CHEV}</button>
      <button type="button" data-mega aria-expanded="false" aria-controls="mega-pro">Products {CHEV}</button>
      <button type="button" data-mega aria-expanded="false" aria-controls="mega-co">Company {CHEV}</button>
      <a href="@contact" data-nav="contact">Contact</a>
    </nav>
    <div class="nav-side">
      <div class="lang" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="true" aria-label="English">EN</button><button type="button" data-lang="es" aria-pressed="false" aria-label="Español">ES</button></div>
      <button class="round" id="theme-btn" type="button" aria-label="Switch between light and dark">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/></svg>
      </button>
      <a class="btn btn-solid" href="{CALENDLY}" target="_blank" rel="noopener">Book a workshop</a>
      <button class="round" id="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="sheet">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>
      </button>
    </div>
    <span class="progress" aria-hidden="true"></span>
  </div>
  <div class="mega glass" id="mega-sol" hidden>
    {item('residential', 'Residential', 'Backup and lower bills for your home.')}
    {item('commercial', 'Commercial', 'Continuous power for operations that cannot stop.')}
    {feature('power-towns', 'aerial.jpg', 'Community scale', 'Power Towns: resilience for whole towns and utilities')}
    {item('power-towns', 'Power Towns', 'A turnkey program for towns, co-ops and small utilities.')}
  </div>
  <div class="mega glass" id="mega-pro" hidden>
    {item('pet', 'PET', 'Portable microgrids for emergencies and job sites.')}
    {item('nerd', 'NERD', 'The battery and brains for your property.')}
    {feature('nerd', 'nerd-render.jpg', 'Pre-order reservations open', 'Hey, NERD.')}
    {item('gridguardian', 'GridGuardian AI', 'Software that runs many sites as one fleet.')}
  </div>
  <div class="mega glass" id="mega-co" hidden>
    {item('about', 'About', 'Our story, our values and the team.')}
    {item('invest', 'Invest', 'Back America’s microgrid infrastructure.')}
    {feature('about', 'v-10.5.jpg', 'Since 2015', 'America’s energy team')}
    {item('contractors', 'Contractors', 'Join our national installer network.')}
  </div>
  <nav class="sheet glass" id="sheet" aria-label="Main" hidden>
    <span class="label">Solutions</span>
    <a href="@residential" data-nav="residential">Residential</a>
    <a href="@commercial" data-nav="commercial">Commercial</a>
    <a href="@power-towns" data-nav="power-towns">Power Towns</a>
    <span class="label">Products</span>
    <a href="@pet" data-nav="pet">PET</a>
    <a href="@nerd" data-nav="nerd">NERD</a>
    <a href="@gridguardian" data-nav="gridguardian">GridGuardian AI</a>
    <span class="label">Company</span>
    <a href="@about" data-nav="about">About</a>
    <a href="@invest" data-nav="invest">Invest</a>
    <a href="@contractors" data-nav="contractors">Contractors</a>
    <a href="@contact" data-nav="contact">Contact</a>
    <a class="btn btn-solid" href="{CALENDLY}" target="_blank" rel="noopener">Book a design workshop</a>
    <button class="btn btn-line theme-row" type="button" data-theme-toggle>Switch light and dark</button>
  </nav>
</div>'''

ICON = {
    'fb': '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.5-1 .9-1H17V2.2L14.1 2C10.9 2 10.2 4.4 10.2 6v2.5H8V12h2.2v10H14V12h2.7l.4-3.5z"/></svg>',
    'ig': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor"/></svg>',
    'li': '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.5 8.8h3.2V20H4.5zM6.1 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM10 8.8h3v1.6c.5-.9 1.6-1.9 3.4-1.9 3.4 0 4 2.2 4 5.1V20h-3.2v-5.6c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V20H10z"/></svg>',
    'yt': '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1c.3-1.2.4-2.5.4-3.8s-.1-2.6-.4-3.8zM10 15V9l5.2 3z"/></svg>',
}

NAV = icons.decorate(NAV)

FOOTER = f'''<footer>
  <div class="wrap">
    <div class="foot">
      <div class="about">
        <a class="brand" href="@home" aria-label="Ovanova home"><span class="mark" aria-hidden="true"></span><span class="wordmark">OVANOVA</span></a>
        <p>Design, deploy and maximize resilient energy.</p>
        <p class="small">607 Sawmill Rd W, Cedar Grove, NC 27231, United States</p>
        <div class="socials">
          <a href="https://www.facebook.com/ovanovamicrogrid/" target="_blank" rel="noopener" aria-label="Facebook">{ICON['fb']}</a>
          <a href="https://www.instagram.com/ovanova.co/" target="_blank" rel="noopener" aria-label="Instagram">{ICON['ig']}</a>
          <a href="https://www.linkedin.com/company/ovanova/" target="_blank" rel="noopener" aria-label="LinkedIn">{ICON['li']}</a>
          <a href="https://www.youtube.com/@ovanovamicrogrid" target="_blank" rel="noopener" aria-label="YouTube">{ICON['yt']}</a>
        </div>
      </div>
      <nav aria-label="Solutions"><span class="label">Solutions</span>
        <a href="@residential">Residential</a><a href="@commercial">Commercial</a><a href="@power-towns">Power Towns</a></nav>
      <nav aria-label="Products"><span class="label">Products</span>
        <a href="@pet">PET</a><a href="@nerd">NERD</a><a href="@gridguardian">GridGuardian AI</a><a href="https://ovanova-nerd.vercel.app/" target="_blank" rel="noopener">NERD site ↗</a></nav>
      <nav aria-label="Company"><span class="label">Company</span>
        <a href="@about">About</a><a href="@invest">Invest</a><a href="@contractors">Contractors</a><a href="@contact">Contact</a></nav>
    </div>
    <div class="foot-note"><span>© 2026 Ovanova, Inc.</span><span><span>ovanova@ovanova.co</span><span>+1 910-250-9973</span></span></div>
  </div>
  <svg class="giant" viewBox="0 0 1000 124" aria-hidden="true" focusable="false">
    <defs><linearGradient id="giant-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--giant-a)"/><stop offset="1" style="stop-color:var(--giant-b)"/></linearGradient></defs>
    <text x="500" y="114" text-anchor="middle" textLength="1000" lengthAdjust="spacingAndGlyphs" fill="url(#giant-fill)">OVANOVA</text>
  </svg>
</footer>'''

def head(title, desc, extra=''):
    return f'''<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#070a0d">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>:root{{--mark:{MARK}}}</style>{extra}'''

def links(html, spa):
    # href="@slug" links to a page; href="@slug/anchor" links to a section on that page
    def rep(m):
        slug, anchor = m.group(1), m.group(2)
        if spa:
            return 'href="#' + (anchor or slug) + '"'
        return 'href="' + FILE[slug] + ('#' + anchor if anchor else '') + '"'
    return re.sub(r'href="@([a-z-]+)(?:/([a-z0-9-]+))?"', rep, html)

def page_body(slug):
    html = open(os.path.join(HERE, 'pages', slug + '.html'), encoding='utf-8').read()
    def inc(m):
        return open(os.path.join(HERE, 'partials', m.group(1) + '.html'), encoding='utf-8').read()
    return icons.decorate(gen_people.apply(slug, re.sub(r'<!--include:([a-z-]+)-->', inc, html)))

def ascii_safe(html):
    """The artifact host adds its own head, so escape non-ASCII: entities in markup, \\u escapes in scripts."""
    def esc_js(t):
        return ''.join(c if ord(c) < 128 else '\\u%04x' % ord(c) for c in t)
    def esc_html(t):
        return ''.join(c if ord(c) < 128 else '&#%d;' % ord(c) for c in t)
    out, pos = [], 0
    for m in re.finditer(r'<script>.*?</script>', html, flags=re.S):
        out.append(esc_html(html[pos:m.start()])); out.append(esc_js(m.group(0))); pos = m.end()
    out.append(esc_html(html[pos:]))
    return ''.join(out)

def build():
    css = open(os.path.join(HERE, 'site.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'tools.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'scenes.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'polish.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'ux.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'apps.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'light.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'mc.css'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'rail.css'), encoding='utf-8').read()
    js = open(os.path.join(HERE, 'site.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'tools.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'sandbox.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'scenes.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'ux.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'voices.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'typo.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'housex.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'townx.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'bizx.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'petx.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'apps.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'mc.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'rail.js'), encoding='utf-8').read()
    common = {}
    for slug, fname, title, desc in PAGES:
        body = f'<main id="main" class="page" data-page="{slug}" data-title="{title}">\n{page_body(slug)}\n</main>'
        html = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
                + head(title, desc, '\n<link rel="stylesheet" href="site.css">') + '\n</head>\n<body>\n'
                + NAV + '\n' + body + '\n' + FOOTER + '\n<script src="i18n.js"></script>\n<script src="site.js"></script>\n</body>\n</html>\n')
        open(os.path.join(OUT, fname), 'w', encoding='utf-8').write(links(html, False))
    # translations: report missing strings, embed what exists
    htmls = [NAV, FOOTER] + [page_body(s) for s, _, _, _ in PAGES] + [t for _, _, t, _ in PAGES]
    keys = i18n.collect(htmls, [js])
    open(os.path.join(HERE, 'i18n', 'keys.json'), 'w', encoding='utf-8').write(json.dumps(keys, ensure_ascii=False, indent=0))
    es = i18n.load('es')
    missing = [k for k in keys if k not in es]
    print('i18n: %d strings, %d missing in es' % (len(keys), len(missing)))
    dict_js = 'window.OVA_I18N=' + json.dumps({'es': {k: v for k, v in es.items() if k in set(keys)}}, ensure_ascii=False) + ';'
    open(os.path.join(OUT, 'i18n.js'), 'w', encoding='utf-8').write(dict_js)
    open(os.path.join(OUT, 'site.css'), 'w', encoding='utf-8').write(css)
    open(os.path.join(OUT, 'site.js'), 'w', encoding='utf-8').write(js)
    # single file for the artifact: no doctype/head wrapper (the host adds one)
    pages = []
    for slug, fname, title, desc in PAGES:
        hid = '' if slug == 'home' else ' hidden'
        pages.append(f'<div class="page" data-page="{slug}" data-title="{title}"{hid}>\n{page_body(slug)}\n</div>')
    spa = (head('Ovanova Redesign', PAGES[0][3]) + '\n<style>\n' + css + '\n</style>\n'
           + '<script>document.documentElement.setAttribute("data-spa","");window.OVA_MODEL_EXT=".glb.wasm";</script>\n'
           + NAV + '\n<main id="main">\n' + '\n'.join(pages) + '\n</main>\n' + FOOTER
           + '\n<script>\n' + dict_js + '\n</script>\n<script>\n' + js + '\n</script>\n')
    spa = ascii_safe(links(spa, True))
    open(os.path.join(OUT, 'ovanova.html'), 'w', encoding='utf-8').write(spa)
    print('built', len(PAGES), 'pages')

if __name__ == '__main__':
    build()
