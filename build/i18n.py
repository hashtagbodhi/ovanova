"""Collects every translatable string from the built pages and the scripts.
Static text: text nodes plus alt / aria-label / placeholder / title attributes.
Script text: string literals wrapped in t('...') in site.js and tools.js.
"""
import os, re, json
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
ATTRS = ('alt', 'aria-label', 'placeholder', 'title', 'data-title', 'data-name', 'data-label')

def norm(s):
    return ' '.join(s.split())

class Collector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.keys = []
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        for k, v in attrs:
            if k in ATTRS and v and re.search(r'[A-Za-z]', v):
                self.keys.append(norm(v))
    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip -= 1
    def handle_data(self, data):
        if self.skip:
            return
        s = norm(data)
        if s and re.search(r'[A-Za-z]', s):
            self.keys.append(s)

def html_keys(html):
    c = Collector(); c.feed(html); return c.keys

def js_keys(js):
    out = []
    for m in re.finditer(r"\btk?\('((?:[^'\\]|\\.)*)'", js):
        out.append(m.group(1).encode().decode('unicode_escape') if '\\u' in m.group(1) else m.group(1).replace("\\'", "'"))
    return out

def collect(htmls, jss):
    seen, keys = set(), []
    for h in htmls:
        for k in html_keys(h):
            if k not in seen: seen.add(k); keys.append(k)
    for j in jss:
        for k in js_keys(j):
            if k not in seen: seen.add(k); keys.append(k)
    return keys

def load(lang):
    p = os.path.join(HERE, 'i18n', lang + '.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {}
