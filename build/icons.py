"""Line icons, one family (24px grid, 1.6 stroke, brand blue via currentColor).
decorate() adds an icon to known headings and to every Calendly button, at build time."""
import re

P = {
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
    'battery': '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M10.5 9.5 8.5 12h4l-2 2.5"/>',
    'sliders': '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    'shield': '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6L12 3z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
    'down': '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    'home': '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    'leaf': '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/>',
    'plus': '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    'phone': '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    'chart': '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    'layers': '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    'fuel': '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M8 8h4"/><path d="M15 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    'pulse': '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
    'peak': '<path d="M3 18c3 0 4-10 9-10s6 10 9 10"/><path d="M3 11h18" stroke-dasharray="2 2.5"/>',
    'plug': '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8zM12 17v4"/>',
    'grid': '<path d="M12 2 7 22M12 2l5 20M8.5 9h7M7.5 14h9M5 7h14"/>',
    'car': '<path d="M4 16v-3l2-5h12l2 5v3H4z"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/><path d="M4 13h16"/>',
    'users': '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.9.4 5 2.8 5 5.8"/>',
    'bolt': '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    'truck': '<path d="M2 6h11v10H2zM13 10h4l4 3.5V16h-8"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    'dollar': '<circle cx="12" cy="12" r="9"/><path d="M15 9.2c-.6-1-1.7-1.5-3-1.5-1.8 0-3 .9-3 2.2 0 3.2 6.2 1.6 6.2 4.4 0 1.3-1.3 2.2-3.2 2.2-1.4 0-2.6-.6-3.2-1.6M12 6v1.7M12 16.5V18"/>',
    'chip': '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    'pin': '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    'factory': '<path d="M3 20V10l5 3V10l5 3V6h3l1 14H3z"/><path d="M3 20h18"/>',
    'repeat': '<path d="M4 11V9a4 4 0 0 1 4-4h11l-3-3M20 13v2a4 4 0 0 1-4 4H5l3 3"/>',
    'flag': '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    'box': '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    'wrench': '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9.5h8M8 12.5h5"/>',
    'check': '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16.5 9"/>',
    'cal': '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h2M12 14h2M8 17h2"/>',
    'cube': '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
}

def svg(name, size=20, sw=1.6):
    return ('<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="%s" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>') % (size, size, sw, P[name])

HEADINGS = {
    # residential
    'Load management': 'sliders', 'A secure app': 'phone', 'Reliable power': 'shield', 'Lower monthly costs': 'down',
    'Energy independence': 'home', 'Clean, quiet backup': 'leaf', "Ready for what's next": 'plus',
    'During long outages': 'clock', 'Over time': 'chart', 'Carbon credits': 'leaf',
    # commercial
    'Solar generation': 'sun', 'Battery storage': 'battery', 'Smart controls': 'sliders', 'Optional generator': 'fuel',
    'Guaranteed uptime': 'pulse', 'Lower operating costs': 'down', 'Backup that lasts': 'clock', 'Peak demand control': 'peak',
    'Room to electrify': 'plug', 'Ready for grid services': 'grid',
    # power towns
    'Peak shaving': 'peak', 'Load shifting': 'repeat', 'Infrastructure deferral': 'layers', 'EV and V2G integration': 'car',
    'Reliability metric analysis': 'chart', 'With you, not for you': 'users',
    # PET
    'Secure grid support': 'grid', 'Portable power for your community': 'users', 'Citizen-owned': 'home', 'Faster than FEMA': 'bolt',
    'Pulled by pickups': 'truck', 'Many sources': 'layers', 'Storm-proof resilience': 'shield', 'Dock and deliver': 'plug', 'Rental income': 'dollar',
    # NERD
    'Keep your place running': 'home', 'Help the grid and your neighbors': 'grid', 'Stay in control': 'sliders',
    'Solar': 'sun', 'Generator': 'fuel', 'Electric vehicle': 'car', 'Local AI compute': 'chip',
    # invest
    'Field-tested experience': 'pin', 'A full-stack platform': 'layers', 'A large market': 'chart', 'U.S. manufacturing': 'factory',
    'Recurring revenue': 'repeat', 'Utility and federal alignment': 'flag', 'Hardware sales': 'box', 'Software subscriptions': 'chip',
    'Services': 'wrench', 'Monitoring and support': 'pulse', 'Grid services and VPP': 'grid',
    # GridGuardian
    'Precision forecasting': 'chart', 'Fleet intelligence': 'layers', 'Cybersecurity by design': 'shield', 'Adaptive integration': 'plug',
    'An overlay on existing sites': 'layers', 'Part of new installations': 'plus', 'Fixed or mobile': 'truck',
    # contractors, contact
    'Licensed and insured': 'shield', 'Solar or electrical experience': 'bolt', 'Reliable communication': 'chat', 'Quality and safety': 'check',
    'For existing systems': 'wrench', 'Projects, partners, press': 'chat',
}

def decorate(html):
    def h4(m):
        title = m.group(1)
        name = HEADINGS.get(title)
        if not name: return m.group(0)
        return '<h4 class="has-ic"><span class="ic">' + svg(name) + '</span><span>' + title + '</span></h4>'
    html = re.sub(r'<h4>([^<]+)</h4>', h4, html)
    # every booking button says so with a calendar
    def cal(m):
        return m.group(1) + '<span class="ic-cal">' + svg('cal', 16, 1.7) + '</span>'
    html = re.sub(r'(<a class="btn[^"]*" href="https://calendly\.com/[^"]+"[^>]*>)', cal, html)
    return html
