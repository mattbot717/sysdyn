# sysdyn - Future Feature Ideas

Features to build after core functionality is solid.

---

## 🌾 GRASS SPECIES & SEED MIXTURE MODELING

**Requested:** 2026-01-31
**Priority:** HIGH (directly useful for farm operations)
**Phase:** 4+ (Advanced Simulation)

### Concept

Model different grass species with unique growth characteristics, then simulate **seed mixture blends** to optimize pasture performance for specific conditions.

### Why This Matters

**Problem:** Seed companies sell "magic blends" but you don't know if they're optimized for YOUR soil, YOUR climate, YOUR rotation schedule. Testing is expensive ($500+/acre) and takes a full growing season.

**Solution:** Simulate different species and blends BEFORE planting. Answer questions like:
- "Will 60% fescue + 30% clover + 10% chicory give me year-round forage?"
- "Which blend is most drought-tolerant for North Texas?"
- "Can I extend my grazing season into winter with a better mix?"
- "What happens if I overseed bermuda with winter annuals?"

### Species Characteristics to Model

Each grass species would have unique parameters:

#### **Cool-Season Grasses** (active Oct-May in Texas)
- **Tall Fescue**
  - Growth temp range: 50-75°F (optimal: 60-70°F)
  - Drought tolerance: Moderate (deep roots)
  - Growth rate: 40-60 kg/acre/day (spring/fall)
  - Winter activity: Active (stays green)
  - Summer dormancy: Semi-dormant (heat stress)

- **Ryegrass (Annual or Perennial)**
  - Growth temp range: 40-70°F
  - Drought tolerance: Low (shallow roots)
  - Growth rate: 60-80 kg/acre/day (fast!)
  - Winter activity: Very active
  - Summer: Dies off (annual) or dormant (perennial)

- **Orchardgrass**
  - Growth temp range: 50-75°F
  - Drought tolerance: Moderate-high
  - Growth rate: 50-70 kg/acre/day
  - Shade tolerance: Good (silvopasture)

#### **Warm-Season Grasses** (active Apr-Oct in Texas)
- **Bermudagrass**
  - Growth temp range: 75-95°F (optimal: 85°F)
  - Drought tolerance: Very high (deep rhizomes)
  - Growth rate: 80-120 kg/acre/day (summer peak)
  - Winter: Completely dormant (brown)
  - Recovery from grazing: Excellent

- **Bahiagrass**
  - Growth temp range: 70-90°F
  - Drought tolerance: High
  - Growth rate: 40-60 kg/acre/day (slower than bermuda)
  - Low maintenance, persistent

- **Native Warm-Season Grasses** (Big Bluestem, Indiangrass, Switchgrass)
  - Growth temp range: 70-90°F
  - Drought tolerance: Very high (6+ foot roots!)
  - Growth rate: 40-80 kg/acre/day
  - Wildlife value: Excellent
  - Soil building: Excellent (deep roots)

#### **Legumes** (nitrogen fixers, protein boost)
- **White Clover**
  - Growth temp range: 50-80°F
  - Drought tolerance: Low-moderate
  - Growth rate: 20-40 kg/acre/day
  - Nitrogen fixation: 100-150 lbs N/acre/year
  - Nutritional quality: Very high protein (20-25%)

- **Red Clover**
  - Similar to white, but taller, more productive
  - Better for hay, white better for grazing

- **Chicory** (technically a forb, not legume)
  - Deep taproot (drought tolerance, breaks hardpan)
  - High mineral content
  - Parasite control properties

### Model Implementation

#### **Multi-Species Stock Structure**

Instead of one `forage_biomass` stock, each paddock would have:

```yaml
stocks:
  cce_fescue:      # Tall fescue biomass
    initial: 1200
  cce_bermuda:     # Bermudagrass biomass
    initial: 800
  cce_clover:      # White clover biomass
    initial: 200
  # Total forage = sum of all species
```

#### **Species-Specific Growth Equations**

Each species has its own growth function:

```yaml
flows:
  cce_fescue_growth:
    from: external
    to: cce_fescue
    rate: "max_growth_fescue * temp_response_fescue(temp) * moisture_response(soil_moisture) * (1 - cce_fescue/optimal_fescue)"
    # temp_response_fescue = peaked curve (optimal at 65°F)

  cce_bermuda_growth:
    from: external
    to: cce_bermuda
    rate: "max_growth_bermuda * temp_response_bermuda(temp) * moisture_response(soil_moisture) * (1 - cce_bermuda/optimal_bermuda)"
    # temp_response_bermuda = peaked curve (optimal at 85°F)
    # Goes to ZERO below 50°F (dormant)
```

#### **Temperature Response Curves**

Different species respond differently to temperature:

- **Cool-season:** Bell curve peaked at 60-70°F, drops off above 80°F
- **Warm-season:** Bell curve peaked at 85°F, ZERO below 50°F
- **Legumes:** Broad tolerance (50-85°F)

We'd need to incorporate **daily temperature** from weather API into the model.

#### **Competitive Interactions**

Species compete for:
- **Light** (tall species shade short ones)
- **Moisture** (deep roots vs shallow)
- **Nutrients** (but legumes ADD nitrogen!)

Could model as:
```yaml
# Bermuda shades out clover when too tall
cce_clover_shading_stress:
  from: cce_clover
  to: external
  rate: "max(0, (cce_bermuda - 1500) * 0.01 * cce_clover)"
  # If bermuda > 1500 kg/acre, clover suffers
```

### Blend Optimization

**User interface:**
```bash
sys optimize-blend cce \
  --species fescue,bermuda,clover \
  --target year_round_coverage \
  --constraint drought_tolerant
```

Model would:
1. Test different percentage blends (30/60/10, 40/50/10, etc.)
2. Simulate 3-5 years with historical weather
3. Score each blend on:
   - Total annual forage production
   - Seasonal coverage (avoid gaps)
   - Drought resilience
   - Nutritional balance
4. Recommend optimal blend

### Example Scenarios

**Scenario 1: Year-Round Forage**
- Problem: Bermuda goes dormant in winter, leaving no forage
- Test blend: 40% fescue + 50% bermuda + 10% clover
- Result: Fescue active Nov-May, bermuda active May-Oct, clover fills gaps

**Scenario 2: Drought Resilience**
- Problem: Ryegrass crashes in summer drought
- Test blend: 60% bermuda + 30% fescue + 10% chicory
- Result: Bermuda handles summer heat, deep roots (fescue + chicory) access deep moisture

**Scenario 3: Silvopasture Optimization**
- Problem: Bermuda needs full sun, struggles under trees
- Test blend: 70% orchardgrass + 20% fescue + 10% white clover
- Result: Shade-tolerant species thrive, clover adds nitrogen

### Data Requirements

To implement this, we'd need:
- **Temperature data** (daily min/max) → Already have from weather API! ✓
- **Species growth curves** → Research literature or extension service data
- **Competition coefficients** → Experimental data or educated estimates
- **User input:** Current species composition (or starting from bare ground)

### Implementation Phases

**Phase 4.1: Single Species Variants**
- Allow user to specify ONE species per paddock
- Different paddocks = different species (test before mixing)
- "Run CCE with fescue vs bermuda vs native mix"

**Phase 4.2: Multi-Species Blends**
- Model 2-3 species per paddock simultaneously
- Competition dynamics
- Seasonal succession (cool → warm → cool)

**Phase 4.3: Blend Optimization**
- Automated testing of blend percentages
- Score on user-defined goals
- Recommend optimal seed mix

**Phase 4.4: Overseeding & Establishment**
- Model seed establishment (germination, seedling growth)
- Overseeding existing pasture (e.g., adding clover to bermuda)
- Timing recommendations (when to overseed for best results)

### Real-World Application

**Before planting:**
```bash
sys blend-test cce \
  --species fescue:40,bermuda:50,clover:10 \
  --weather historical-3yr \
  --rotation-days 14 \
  --herd-count 14
```

Output:
```
📊 Blend Performance (3-year simulation):

  Annual Forage Production:
    Year 1: 8,200 kg/acre (establishment)
    Year 2: 12,400 kg/acre (mature)
    Year 3: 13,100 kg/acre (stable)

  Seasonal Coverage:
    Jan-Mar: Fescue dominant (60%), Bermuda dormant
    Apr-May: Mixed (Fescue 40%, Bermuda 30%, Clover 20%)
    Jun-Sep: Bermuda dominant (75%), Fescue semi-dormant
    Oct-Dec: Fescue returning (50%), Bermuda declining

  Drought Events:
    2023 summer drought: 15% forage loss (bermuda resilient)
    2024 spring drought: 8% loss (deep roots sustained)

  Recommendation: ✓ Good year-round coverage
                   ✓ Drought-tolerant
                   ⚠️  Consider 5% more clover for nitrogen
```

---

## Related Features

- **Soil fertility modeling** (nitrogen, phosphorus, pH effects on growth)
- **Parasite/pest pressure** (some species have natural resistance)
- **Mycorrhizal networks** (perennial native grasses build fungal networks)
- **Carbon sequestration** (deep-rooted natives sequester more carbon)

---

## Notes

This feature transforms the model from "generic grazing" to "YOUR specific pasture with YOUR specific grass blend." It's the difference between:
- "The model says you need hay in January" (generic)
- "Your fescue/bermuda blend will go dormant Jan 15-Feb 28, need 1200 lbs hay" (specific)

The optimization piece is POWERFUL: test 100 different blends in simulation before spending $20,000 on seed!

---

**Status:** Documented, not yet implemented
**Next step:** Build core weather-driven model first, then tackle species modeling
**Estimated complexity:** High (requires species data, competition modeling, optimization algorithms)
**Estimated value:** VERY HIGH (direct operational impact, real cost savings)

---

*Documented by: mattbot717 & battle buddy*
*Date: 2026-01-31*
