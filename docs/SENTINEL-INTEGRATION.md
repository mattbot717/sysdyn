# Sentinel-2 Satellite NDVI Integration Plan

*Phased implementation plan for adding satellite-derived vegetation indices to the grazing rotation optimizer.*

---

## Why Sentinel-2

The grazing optimizer currently predicts forage biomass from weather inputs (precipitation, ET, temperature). These predictions are never validated against real-world observation. Sentinel-2 fills that gap.

**What it is:** Two ESA satellites (Sentinel-2A and 2B) capturing multispectral imagery of the entire Earth's land surface every 5 days, at 10-meter resolution, completely free and open access. Funded by the EU's Copernicus Programme.

**What we extract:** NDVI (Normalized Difference Vegetation Index) — a measure of vegetation greenness and density computed from the Red (B4, 665nm) and Near-Infrared (B8, 842nm) bands:

```
NDVI = (NIR - Red) / (NIR + Red) = (B8 - B4) / (B8 + B4)
```

**NDVI ranges for Pyrennial context:**

| Surface | NDVI | When you'd see it |
|---------|------|-------------------|
| Bare soil | 0.05 - 0.15 | Freshly seeded paddock, drought |
| Dormant bermuda (winter) | 0.15 - 0.25 | Dec - Feb |
| Stressed/sparse growth | 0.20 - 0.35 | Early spring or drought stress |
| Moderate pasture | 0.35 - 0.55 | Active growth, not peak |
| Healthy dense pasture | 0.55 - 0.80 | Peak growth, full canopy |
| Very dense/lush | 0.75 - 0.90 | Irrigated or peak spring flush |

**What this means for each paddock:**
- CCE (hilltop, high evap): Expect systematically lower NDVI than other paddocks
- Hog (creek + trees, moist): Should show highest NDVI, especially in summer
- Frankie's (seeded Dec 12 2025): Will show establishment progression from bare soil toward vegetated over spring 2026 — a perfect natural experiment

**Pixel coverage at 10m resolution (1 pixel = 10m x 10m = 0.025 acres):**

| Paddock | Est. Acreage | Approx. Pixels |
|---------|-------------|----------------|
| CCE | ~10 | ~400 |
| CCW | ~10 | ~400 |
| Big | ~15-20 | ~600-800 |
| Hog | ~10 | ~400 |
| Frankie's | ~10 | ~400 |

Hundreds of pixels per paddock = robust statistics. You can compute mean, median, min, max, and standard deviation of NDVI per paddock per observation.

**Practical imaging frequency for Collinsville TX (~33.56N, 96.91W):**

| Season | Avg Cloud Cover | Usable Images/Month |
|--------|----------------|---------------------|
| Winter (Dec-Feb) | 50-60% | 3-4 |
| Spring (Mar-May) | 55-65% | 2-3 (storm season) |
| Summer (Jun-Aug) | 30-45% | 4-5 |
| Fall (Sep-Nov) | 40-50% | 4-5 |

Expect ~40-50 usable cloud-free scenes per year. Roughly weekly in summer, every 10-14 days in winter. Sentinel-2 overpass is ~11:00 AM local time (before afternoon convective clouds build).

---

## Data Access Options (Ranked)

### Option A: Sentinel Hub Statistical API (Recommended)

**Why this wins:** It returns JSON. Mean NDVI per date for your polygon. No raster processing. Works from Node.js via HTTP. Free tier is sufficient.

- **Provider:** Sentinel Hub (Sinergise/Planet), integrated into Copernicus Data Space Ecosystem
- **Auth:** Free registration at dataspace.copernicus.eu, OAuth2 client credentials
- **Endpoint:** `https://sh.dataspace.copernicus.eu/api/v1/statistics` (CDSE-integrated)
- **Free tier:** ~30,000 processing units/month. Each paddock request costs ~40-80 PU. All 5 paddocks weekly for a year = ~15,600 PU. Well within free tier.
- **Output:** JSON with mean/median/min/max NDVI per time interval for your polygon

This mirrors the existing pattern of pre-computing weather data as exogenous time series. NDVI becomes another time series input — `ndvi_observed` — alongside `daily_precip`, `daily_et`, and `cool_temp_mult`.

### Option B: AWS Open Data + Python Pipeline

- **Provider:** Element 84 hosting Sentinel-2 COGs on S3
- **Auth:** None required for data access
- **STAC endpoint:** `https://earth-search.aws.element84.com/v1`, collection `sentinel-2-l2a`
- **How:** Query STAC for scenes covering Pyrennial, download B4/B8 COG windows, compute NDVI, extract zonal stats per paddock
- **Pro:** No auth, fully free, full control
- **Con:** You do the raster math yourself. Python-centric (rasterio, rasterstats, pystac-client)

### Option C: Google Earth Engine

- **Provider:** Google
- **Auth:** OAuth2 via GCP project
- **Licensing:** Free for non-commercial/research. Commercial farm use is ambiguous — technically should use paid tier, but Google has not enforced against small ag users
- **Pro:** Most powerful for complex analysis (cloud masking, time series, multi-year trends)
- **Con:** Python only. Headless server auth is harder. Licensing question for a commercial operation

**Recommendation:** Start with Option A. If you outgrow the free tier or need more control, graduate to Option B with a Python pre-processing script.

---

## Phase 1: Paddock Boundaries + First Data Pull

**Goal:** Define paddock polygons, register with Copernicus, pull first NDVI time series.

**Duration:** 1-2 days

### Steps

1. **Define paddock boundaries as GeoJSON polygons**
   - Use Google Earth/Maps to trace each paddock boundary
   - Export as GeoJSON FeatureCollection
   - Save to `data/paddock-boundaries.geojson`
   - Each feature has a `name` property matching your paddock IDs (CCE, CCW, Big, Hog, Frankies)

2. **Register on Copernicus Data Space Ecosystem**
   - Create account at dataspace.copernicus.eu
   - Generate OAuth2 client credentials (client_id + client_secret)
   - Store credentials in `.env` (gitignored)

3. **Write fetch script**
   - `bin/fetch-ndvi.js` — Node.js script using native `fetch()`
   - For each paddock: call Statistical API with polygon, date range, cloud cover filter
   - Request NDVI mean/median/stddev per available date
   - Apply cloud mask: use Sentinel-2 SCL (Scene Classification Layer) band to exclude cloud pixels (SCL values 0,1,2,3,8,9,10,11)

4. **Output format**
   - Save to `data/ndvi-timeseries.json`
   - Structure mirrors weather data:
   ```json
   {
     "paddocks": {
       "CCE": [
         { "date": "2025-06-15", "ndvi_mean": 0.52, "ndvi_median": 0.54, "ndvi_std": 0.08, "cloud_pct": 5, "pixel_count": 395 },
         ...
       ],
       ...
     }
   }
   ```

5. **Pull historical data**
   - Request all available imagery from 2023-01-01 to present
   - This gives you 2+ years of NDVI baseline per paddock before any model changes
   - Sentinel-2 archive goes back to 2015, but 2-3 years is enough to establish seasonal patterns

### Deliverable
A JSON file with NDVI time series for all 5 paddocks, and a fetch script that can refresh the data on demand.

---

## Phase 2: Visual Validation + Baseline Analysis

**Goal:** Visualize NDVI time series alongside weather data and model predictions. Build intuition before integrating into the engine.

**Duration:** 2-3 days

### Steps

1. **Plot NDVI time series per paddock**
   - Add ASCII chart or HTML visualization (extend existing web dashboard if present)
   - Overlay on the same time axis as forage_biomass predictions
   - Plot weather data (precip, ET) on secondary axis for context

2. **Identify patterns**
   - Does NDVI track your forage model predictions?
   - Where do they diverge? (That's the calibration signal)
   - Do you see the bermuda dormancy drop in winter?
   - Can you see grazing impact? (NDVI should dip after cattle enter a paddock, recover after they leave)
   - Does Frankie's show the Dec 2025 seeding → spring 2026 establishment arc?

3. **Compute correlation metrics**
   - Pearson correlation between model-predicted forage and NDVI per paddock
   - Lag analysis: does NDVI lead or lag your model? (NDVI measures greenness which is not exactly biomass — there's a relationship but it's not 1:1)

4. **Establish NDVI-to-biomass relationship**
   - Literature suggests roughly linear relationship for grasslands: `biomass_kg_ha = a * NDVI + b`
   - Coefficients vary by grass species, season, and soil. You'll need to calibrate to your pasture.
   - Even without calibrated coefficients, relative NDVI between paddocks and over time is immediately useful

### Deliverable
Visual comparison of model vs satellite, initial correlation metrics, documented observations on where the model is right and where it's wrong.

---

## Phase 3: Model Integration

**Goal:** Wire NDVI into the sysdyn engine as an observation input for calibration and state estimation.

**Duration:** 1 week

### Steps

1. **Add `ndvi_observed` as a time series parameter**
   - Same mechanism as `daily_precip` and `daily_et`
   - Per-paddock arrays in the model YAML
   - Weather preprocessor extended to also fetch/load NDVI data

2. **Modify state estimator**
   - Currently: state estimator runs historical sim forward to reconstruct current paddock state
   - Add NDVI as a correction signal:
     - After each sim step where NDVI observation is available, compare predicted forage level to observed NDVI
     - If divergence exceeds threshold, adjust forage stock proportionally
     - This is essentially a simple data assimilation / Kalman-filter-like approach

3. **Add NDVI-informed confidence to optimizer**
   - Optimizer currently selects rotation moves based on simulated state
   - Add confidence weighting: paddocks with recent NDVI confirmation of model state get higher confidence
   - Paddocks where model and NDVI diverge get flagged for manual inspection

4. **Auto-refresh pipeline**
   - `bin/fetch-ndvi.js` runs on schedule (cron or manual trigger)
   - New NDVI data automatically available to next sim run
   - Consider: add to `sys` CLI as `sys ndvi fetch` command

### Deliverable
NDVI-informed state estimation and optimizer confidence. The model self-corrects when satellite observations disagree with predictions.

---

## Phase 4: Continuous Calibration Loop

**Goal:** Use accumulating NDVI data to continuously improve model parameters.

**Duration:** Ongoing

### Steps

1. **Parameter estimation from NDVI**
   - Use NDVI time series as ground truth to tune:
     - `growth_rate` per paddock
     - `evap_multiplier` per paddock (CCE's 1.15x — is it really 1.15?)
     - `creek_runoff_bonus` for Hog and Frankie's
   - Automated grid search: try parameter combinations, score against NDVI match

2. **Seasonal model refinement**
   - Warm-season vs cool-season forage growth patterns
   - Bermuda dormancy timing (when exactly does NDVI drop below 0.25?)
   - Spring green-up timing (when does NDVI cross 0.35?)

3. **Grazing impact detection**
   - Track NDVI before/after each rotation move
   - Quantify: "how much does NDVI drop per animal-day of grazing?"
   - Feed back into the grazing_pressure equations

4. **Anomaly detection**
   - Alert when NDVI drops unexpectedly (drought stress, disease, pest damage)
   - Alert when NDVI doesn't recover on expected timeline after grazing

### Deliverable
Self-improving model that gets more accurate with every season of satellite data.

---

## Phase 5 (Future): Multi-Source Fusion

**Goal:** Combine satellite NDVI with other data sources for richer understanding.

### Potential additions

- **Soil moisture sensors** ($200-500 each) on 2-3 paddocks — validate the moisture model directly, not just via vegetation proxy
- **Drone imagery** — higher resolution (cm-scale) for within-paddock variation mapping
- **Sentinel-1 SAR** (radar) — works through clouds, sensitive to soil moisture and vegetation structure. Same free Copernicus access.
- **Planet SuperDove** — 3m resolution, daily revisit, but paid ($)

---

## Technical Notes

### Cloud Masking with SCL Band

Sentinel-2 Level-2A products include a Scene Classification Layer (SCL) at 20m resolution. Use it to exclude unreliable pixels:

| SCL Value | Class | Action |
|-----------|-------|--------|
| 0 | No data | EXCLUDE |
| 1 | Saturated/defective | EXCLUDE |
| 2 | Dark area / shadows | EXCLUDE |
| 3 | Cloud shadow | EXCLUDE |
| 4 | Vegetation | KEEP |
| 5 | Bare soil | KEEP |
| 6 | Water | EXCLUDE (unless monitoring ponds) |
| 7 | Unclassified | KEEP (with caution) |
| 8 | Cloud medium probability | EXCLUDE |
| 9 | Cloud high probability | EXCLUDE |
| 10 | Thin cirrus | EXCLUDE |
| 11 | Snow/ice | EXCLUDE |

### NDVI vs Biomass Caveats

NDVI is not biomass. It correlates with green leaf area, not total standing dry matter. Key caveats:

- NDVI saturates at high biomass (above ~0.80, more grass doesn't mean higher NDVI)
- Dead standing material is invisible to NDVI (brown bermuda in winter = low NDVI, but forage may still have nutritive value for cattle)
- NDVI is affected by soil background when canopy is sparse (early growth, overgrazed paddock)
- Trees in Hog paddock will contribute to NDVI signal — may need to mask tree canopy pixels

Despite these caveats, NDVI is the single most validated remote sensing index for grassland monitoring. For relative comparison between paddocks and tracking change over time, it works well.

### Libraries and Tools

**Node.js (your stack):**
- Native `fetch()` for Sentinel Hub REST API calls — no additional dependencies needed
- JSON responses, no raster processing required if using Statistical API

**Python (if you need raster processing later):**
- `sentinelhub` — official Python client for Sentinel Hub API
- `pystac-client` — STAC catalog queries for AWS/CDSE
- `rasterio` — read Cloud-Optimized GeoTIFFs
- `rasterstats` — zonal statistics from rasters using vector geometries

---

## Cost Summary

| Component | Cost |
|-----------|------|
| Sentinel-2 data | Free (EU Copernicus Programme) |
| Sentinel Hub Statistical API | Free tier (30K PU/month, you'll use ~1.5K) |
| Copernicus registration | Free |
| Compute (your Mac Mini) | Already running |
| **Total** | **$0** |

---

*Integration plan for grazing-optimizer.*
*Created: 2026-02-13*
