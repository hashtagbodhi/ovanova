"""Builds the customer-stories section (one partial per page variant) from voices_data."""
import os, html
from voices_data import V, SEG
import icons
HERE = os.path.dirname(os.path.abspath(__file__))
e = html.escape
STAR = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>'
PIN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>'
SWAP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h13l-3-3M20 15H7l3 3"/></svg>'
CHECK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
STATES = sorted(set(v['place'].split(', ')[-1] for v in V if v['place']))

def story(v):
    where = ' · '.join(x for x in [v['org'], v['place']] if x)
    alt = 'Photo from ' + v['name'] + '’s project' + (', ' + v['place'] if v['place'] else '')
    gal = '<img class="vx-main" src="img/voices/%s-1.jpg" alt="%s" loading="lazy">' % (v['k'], e(alt))
    if v['photos'] > 1:
        gal += '<button class="vx-alt" type="button" aria-label="Show the other photo"><img src="img/voices/%s-2.jpg" alt="" loading="lazy"><span class="vx-swap">%s</span></button>' % (v['k'], SWAP)
    full = ''.join('<p>%s</p>' % e(p) for p in v['body'])
    return f'''      <article class="vx-story" data-k="{v['k']}" data-seg="{v['seg']}" hidden>
        <div class="vx-gallery">{gal}</div>
        <div class="vx-body">
          <div class="vx-meta"><span class="vx-stars" role="img" aria-label="5 out of 5 stars">{STAR * 5}</span><span class="vx-seg">{SEG[v['seg']]}</span></div>
          <h3>{e(v['name'])}</h3>
          <p class="vx-where">{PIN}<span>{e(where)}</span></p>
          <blockquote>
            <p class="vx-head">“{e(v['head'])}”</p>
            {('<div class="vx-full">' + full + '</div>') if full else ''}
          </blockquote>
          {'<button class="vx-more" type="button" aria-expanded="false">Read the full story</button>' if full else ''}
          <ul class="vx-tags">{''.join('<li>' + CHECK + '<span>' + e(t) + '</span></li>' for t in v['tags'])}</ul>
          <p class="vx-src">{e(v.get('source', 'Ovanova customer review'))}</p>
        </div>
      </article>'''

def person(v):
    sub = v['place'] or v['org']
    return f'''        <button type="button" class="vx-person" data-k="{v['k']}" data-seg="{v['seg']}" aria-pressed="false"><img src="img/voices/{v['k']}-1.jpg" alt="" loading="lazy"><span><b>{e(v['name'])}</b><small>{e(sub)}</small></span></button>'''

def section(first, filt, label='Customer stories', title='From the people who run on it.'):
    counts = {s: sum(1 for v in V if v['seg'] == s) for s in SEG}
    flt = [('all', 'All', len(V)), ('home', 'Homes', counts['home']), ('farm', 'Farms', counts['farm']), ('biz', 'Businesses', counts['biz'])]
    return f'''<section class="band vx" aria-label="Customer stories" data-voices data-first="{first}" data-filter="{filt}">
  <div class="wrap">
    <div class="vx-head-row" data-rise>
      <div>
        <span class="label sun">{label}</span>
        <h2>{title}</h2>
      </div>
      <div class="vx-score">
        <span class="vx-stars big" role="img" aria-label="5 out of 5 stars">{STAR * 5}</span>
        <p><b>5.0</b> from {len(V)} customer reviews</p>
        <small>Homes, farms and businesses in {len(STATES)} states</small>
      </div>
    </div>
    <div class="vx-filter" role="group" aria-label="Show stories from">
{chr(10).join('      <button type="button" data-vf="%s" aria-pressed="false">%s <span>%d</span></button>' % f for f in flt)}
    </div>
    <div class="vx-stage glass" data-rise>
{chr(10).join(story(v) for v in V)}
    </div>
    <div class="vx-nav">
      <button class="round vx-prev" type="button" aria-label="Previous story"><span aria-hidden="true">←</span></button>
      <div class="vx-people" role="group" aria-label="Choose a customer">
{chr(10).join(person(v) for v in V)}
      </div>
      <button class="round vx-next" type="button" aria-label="Next story"><span aria-hidden="true">→</span></button>
    </div>
  </div>
</section>
'''

def write():
    variants = {
        'voices': ('mcdaniel', 'all', 'Customer stories', 'From the people who run on it.'),
        'voices-res': ('peebles', 'home', 'Homeowner stories', 'Homes that stay on.'),
        'voices-com': ('dycus', 'all', 'Business and farm stories', 'Businesses that stayed open.'),
        'voices-inv': ('howle', 'all', 'Proof in the field', 'Customers who would do it again.'),
    }
    for name, (first, filt, label, title) in variants.items():
        open(os.path.join(HERE, 'partials', name + '.html'), 'w', encoding='utf-8').write(section(first, filt, label, title))
