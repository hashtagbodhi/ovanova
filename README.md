# Ovanova website

Static site for Ovanova: ten pages, three interactive simulators (home, business, town),
a PET deployment simulator and a GridGuardian page. English and Spanish.

## Layout

- `build/` source: page content (`pages/`, `partials/`), styles, scripts, i18n strings.
- `site/` the built, ready-to-host site. Open `site/index.html` in a browser, or serve the folder.

## Rebuild

```bash
cd build
python3 build.py
```

This regenerates `site/`. Python 3 is the only requirement.

## Notes

- 3D views load three.js from a CDN and models from `site/models/`.
- Spanish strings live in `build/i18n/es.json`.
