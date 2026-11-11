# Data

| File | What it is | Source |
|---|---|---|
| `places_lk.csv` | Every populated place in Sri Lanka (17,856), with coordinates, province, time zone and, where known, the Sinhala name (138 places) | GeoNames, fetched 2026-11-11 by `scripts/fetch_geonames_lk.py` |

Places outside Sri Lanka come from the `geonamescache` package (GeoNames places with 1000 or more people). The search index (`places.sqlite`) is built from both by `app/geo/build.py` and is not committed.

Sinhala names from GeoNames are checked before use: names with a vowel sign before the consonant, or with characters outside Sinhala, are dropped. Province names are curated in `app/geo/regions.py`, because the GeoNames versions have errors.

## Attribution

Place data © [GeoNames](https://www.geonames.org), licensed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The data is provided "as is", without warranty.
