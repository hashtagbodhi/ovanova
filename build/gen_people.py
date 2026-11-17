"""Human layer: real field photos, the team's faces, and photo bands with honest captions."""
import os, re, html
HERE = os.path.dirname(os.path.abspath(__file__))
e = html.escape
TEAM = [
    ('john-carey', 'John Carey', 'CEO and COO'),
    ('lester-crafton', 'Lester Crafton', 'Chief Revenue Officer'),
    ('christopher-snodgrass', 'Christopher Snodgrass', 'Chief Hardware Engineer'),
    ('peter-kariuki', 'Peter Kariuki', 'Chief Technology Officer'),
    ('sugar-tagarao', 'Sugar Tagarao', 'Office and Project Manager'),
    ('vincent-clet', 'Vincent Clet', 'Engineer and Plant Doctor'),
    ('daniel-morton', 'Daniel Morton', 'Site Manager and Microgrid Technician'),
    ('kaila-nicole', 'Kaila Nicole', 'Compliance Specialist'),
]

def team_strip(keys=None, title='The people you’ll work with', link=True):
    people = [t for t in TEAM if not keys or t[0] in keys]
    cards = ''.join('<li><img src="img/team-%s.jpg" alt="%s" loading="lazy"><b>%s</b><span>%s</span></li>' % (k, e(n), e(n), e(r).rsplit(' ', 1)[0] + '\u00a0' + e(r).rsplit(' ', 1)[-1] if ' ' in r else e(r)) for k, n, r in people)
    more = '<a class="tl" href="@about">Meet the whole team <span class="arrow" aria-hidden="true">→</span></a>' if link else ''
    return '<div class="team-strip" data-rise><div class="ts-head"><span class="label sun">%s</span>%s</div><ul>%s</ul></div>' % (e(title), more, cards)

def avatars(text='Real people design, install and monitor every system.'):
    faces = ''.join('<img src="img/team-%s.jpg" alt="" loading="lazy">' % k for k, _, _ in TEAM[:5])
    return '<div class="close-people wrap"><span class="cp-faces">%s</span><span class="cp-text">%s</span></div>' % (faces, e(text))

def band(img, label, text, pos='50% 50%', ratio='21 / 9'):
    return '''<section class="band pband-sec">
  <div class="wrap">
    <figure class="pband" data-rise style="--ratio:%s"><img src="img/field/%s" alt="%s" loading="lazy" style="object-position:%s"><figcaption><span class="label">%s</span><span>%s</span></figcaption></figure>
  </div>
</section>
''' % (ratio, img, e(text), pos, e(label), e(text))

def field():
    tiles = [
        ('a', 'img/field/crew-wiring.jpg', 'On site', 'Our crew wiring a mobile microgrid, cable by cable.', '50% 40%'),
        ('b', 'img/voices/mcdaniel-1.jpg', 'Customer', 'Jesse McDaniel and crew, MBReps, Nashville, GA', '50% 35%'),
        ('c', 'img/voices/thompson-2.jpg', 'Install day', 'Commissioning the battery wall at 3T Farms, Bolivar, TN', '50% 50%'),
        ('d', 'img/field/crew-canopy.jpg', 'Build', 'Raising a solar canopy over a battery yard.', '50% 50%'),
        ('e', 'img/voices/howle-1.jpg', 'Customer', 'Jerry Howle and team, Howle Farms, Hartsville, SC', '50% 40%'),
        ('f', 'img/field/pet-fleet.jpg', 'Ready to roll', 'A row of PETs, staged and charged.', '50% 60%'),
    ]
    figs = ''.join('<figure class="fm fm-%s"><img src="%s" alt="%s" loading="lazy" style="object-position:%s"><figcaption><span class="label">%s</span><span>%s</span></figcaption></figure>' % (k, s, e(t), p, e(l), e(t)) for k, s, l, t, p in tiles)
    return '''<section class="band field" id="home-field">
  <div class="wrap">
    <div class="head" data-rise>
      <span class="label sun">Real people, real places</span>
      <h2>Behind every number, a crew and a customer.</h2>
      <p class="lead">No stock photos here. These are our crews on site and the farms, shops and families who run on what we built.</p>
    </div>
    <div class="fmosaic" data-rise>''' + figs + '''</div>
    ''' + team_strip() + '''
  </div>
</section>
'''

def pet_gallery():
    tiles = [('pet-person.jpg', 'Plugged in and working, minutes after arrival.', '50% 50%'),
             ('pet-barn.jpg', 'Docked at a shop to shave its peak.', '50% 55%'),
             ('pet-dome.jpg', 'Powering an off-grid site, no lines in sight.', '50% 60%'),
             ('pet-fleet.jpg', 'Staged and charged for the next call-out.', '50% 60%')]
    figs = ''.join('<figure class="pg"><img src="img/field/%s" alt="%s" loading="lazy" style="object-position:%s"><figcaption>%s</figcaption></figure>' % (f, e(t), p, e(t)) for f, t, p in tiles)
    return '''<section class="band">
  <div class="wrap">
    <div class="head" data-rise><span class="label sun">In the field</span><h2>PETs on the job.</h2></div>
    <div class="pgallery" data-rise>''' + figs + '''</div>
  </div>
</section>
'''

INSERTS = {
    # page: list of (anchor text to insert BEFORE, html)
    'home': [('<section class="band clip" id="home-why">', field())],
    'residential': [('<section class="band sunk">\n  <div class="wrap">\n    <div class="head" data-rise>\n      <span class="label sun">The process</span>',
                     band('crew-site.jpg', 'Our crews', 'Every system is installed and commissioned by people who stay with it for 20 years.', '62% 50%', '21 / 8'))],
    'commercial': [('<section class="band grants">', band('crew-dusk.jpg', 'Build to finish', 'Commercial builds run until the job is right, not until the light runs out.', '50% 38%', '21 / 9'))],
    'power-towns': [('<section class="band sunk">', band('farm-array.jpg', 'Rural resilience', 'Solar and battery cabinets on a working farm: the building block of a Power Town.', '50% 55%', '21 / 9'))],
    'pet': [('<section class="close clip">', pet_gallery())],
    'invest': [('<section class="band" id="inv-why">', '<section class="band" style="padding-top:0"><div class="wrap">' + team_strip(['john-carey', 'lester-crafton', 'christopher-snodgrass', 'peter-kariuki'], 'Leadership') + '</div></section>\n')],
    'contact': [('<section class="band sunk" id="contact-form">', '<section class="band" style="padding-top:0"><div class="wrap">' + team_strip(title='The team behind the inbox') + '</div></section>\n')],
}

def apply(slug, html_):
    for anchor, block in INSERTS.get(slug, []):
        if anchor in html_:
            html_ = html_.replace(anchor, block + anchor, 1)
        else:
            raise SystemExit('people: anchor not found on %s: %r' % (slug, anchor[:60]))
    # faces above the closing call to action, on every page that has one
    html_ = re.sub(r'(<section class="close clip">.*?)(\n\s*<div class="btn-row wrap">)', lambda m: m.group(1) + '\n  ' + avatars() + m.group(2), html_, count=1, flags=re.S)
    return html_
