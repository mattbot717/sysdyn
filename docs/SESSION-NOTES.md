# sysdyn Session Notes

## Where We Left Off

**Date:** 2026-01-27

We're building a system dynamics simulation engine. Here's what exists:

### ✅ Completed

1. **Documentation**
   - `README.md` - Core concepts (stocks, flows, feedback loops)
   - `docs/ADVANCED.md` - Deep dive into delays, non-linearity, aging chains, etc.
   - `docs/ROADMAP.md` - Full project vision including the Electron app goal
   - `docs/TECHNICAL-NOTES.md` - Language trade-offs (JS vs Python vs Julia vs Rust)
   - `docs/SESSION-NOTES.md` - This file

2. **Engine Core** (`lib/engine.js`)
   - Model validation
   - Euler integration (stock += flow × dt)
   - Equation evaluation (flow rates calculated from formulas)
   - Results output (time series for each stock)
   - Sparkline generator for terminal visualization
   - Summary statistics

3. **Model Loader** (`lib/loader.js`)
   - Simple YAML parser (no dependencies)
   - Load/save model files
   - Model scaffolding for new models (basic, growth, decay templates)
   - List available models

4. **Example Model** (`models/farm-water.yaml`)
   - Soil moisture dynamics
   - Multiple stocks (soil_moisture, deep_water)
   - Multiple flows (rain, evaporation, plant_uptake, percolation, runoff)
   - Demonstrates threshold effects (runoff only when saturated)

5. **CLI** (`bin/sys.js`) ✨ NEW!
   - `sys run <model>` - Run simulation with beautiful output
   - `sys list` - Show available models
   - `sys validate <model>` - Check for errors
   - `sys new <name> [template]` - Create new model from template
   - `sys help` - Usage guide
   - Sparkline visualizations in terminal
   - Summary statistics (initial, final, change, range)

### 🎉 Phase 2 Complete!

The CLI is **fully functional**. You can now:
- Run simulations: `sys run farm-water`
- Create new models: `sys new my-model`
- Validate models: `sys validate farm-water`
- See results with ASCII charts right in the terminal!

### Not Yet Built

- **Web visualization** (Phase 3) - Chart.js dashboard
- **Advanced simulation** (Phase 4) - Runge-Kutta, sensitivity analysis
- **Sensor integration** (Phase 5) - Real data, parameter fitting
- **Electron app** (Phase 6) - THE EXCITING ONE ⚡

---

## What You've Learned So Far

### Numerical Integration (Euler's Method)

We can't do calculus on a computer, so we approximate:

```
stock(t + dt) = stock(t) + flow(t) × dt
```

Take the current value, add the rate of change times the time step. Repeat.

Error is proportional to dt. Smaller steps = more accuracy, more computation.

Better methods (Runge-Kutta) sample the rate at multiple points in the timestep. We'll add that later.

### Model Structure

```yaml
name: model-name
params:
  some_rate: 0.1
stocks:
  some_stock:
    initial: 100
flows:
  some_flow:
    from: some_stock  # or 'external'
    to: external      # or another stock
    rate: "some_stock * some_rate"  # equation as string
```

Flows are equations that can reference any stock, param, or previously calculated flow.

### Why YAML

It's like JSON but human-friendly:
- No quotes around keys
- No commas
- Indentation instead of braces
- Comments with #

We wrote a simple parser rather than adding dependencies. Educational and keeps things small.

---

## Next Session: Build the CLI

The engine exists but we can't run it yet. Next steps:

1. **Create `bin/sys.js`** - The CLI entry point
   - `sys run <model>` - Load model, run simulation, output results
   - `sys list` - Show available models
   - `sys new <name>` - Create new model scaffold
   - `sys validate <model>` - Check model for errors

2. **Test the engine** - Run farm-water.yaml and see if the numbers make sense

3. **Add sparkline output** - Quick terminal visualization

4. **Export results** - JSON/CSV for further analysis or charting

---

## Code Locations

```
~/lab/sysdyn/
├── README.md              # Core concepts
├── package.json           # Project config
├── docs/
│   ├── ADVANCED.md        # Deep dive
│   ├── ROADMAP.md         # Project vision
│   └── SESSION-NOTES.md   # This file
├── lib/
│   ├── engine.js          # Simulation core ✓
│   └── loader.js          # YAML parsing ✓
├── models/
│   └── farm-water.yaml    # Example model ✓
└── bin/
    └── sys.js             # CLI (next session)
```

---

## Philosophy Reminder

> "The goal here in the lab, and in life, is to learn and grow and gain a closer sense of truth of everything."

We're not just building software. We're learning:
- How systems behave (the domain)
- How to simulate them (numerical methods)
- How to build tools (software engineering)
- How to think about complexity (systems thinking)

The Electron app is the exciting north star. We'll get there by building the foundation right.

---

## Today's Session (2026-01-27)

### Accomplished

1. **Reviewed the codebase** - Deep dive into how engine.js, loader.js, and farm-water.yaml work together
2. **Language analysis** - Discussed JavaScript vs Python vs Julia vs Rust trade-offs
3. **Created TECHNICAL-NOTES.md** - Documented when to consider alternative languages for academic/production use
4. **Built the CLI** - Complete implementation of `bin/sys.js` with all core commands
5. **Tested successfully** - Ran farm-water simulation, saw soil moisture decline from 60mm to 30mm over 100 days
6. **Added shell alias** - `sys` command now available in terminal

### Key Learnings

- **Euler Integration:** How computers approximate calculus with `stock(t+1) = stock(t) + rate × dt`
- **Dynamic Equation Evaluation:** Using `new Function()` to compile YAML equation strings with variable context
- **Feedback Loops Emerge:** Model structure creates behavior - evaporation increases with moisture, creating self-balancing system
- **JavaScript Choice:** Right for Electron goal, sufficient performance for typical models, full-stack continuity

### What the Farm-Water Model Showed

Starting conditions: 60mm soil moisture, 3mm daily rain (80% infiltration = 2.4mm/day entering soil)

Losses:
- Evaporation: 5% of moisture per day (started at 3mm/day, declined as moisture dropped)
- Plant uptake: 3% of moisture per day (started at 1.8mm/day, declined)
- Total loss: ~4.8mm/day initially, declining over time

Result: Soil moisture drains to ~30mm equilibrium where inflow (2.4mm) balances outflows

No percolation (never exceeded 100mm field capacity) or runoff (never reached 150mm saturation).

**This is balancing feedback in action!** 🌱

---

## Next Session: Explore and Extend

Now that the CLI works, you can:

### Immediate Experiments
```bash
sys run farm-water 365 1         # Run a full year
sys new drought-test growth      # Create new model from template
sys run farm-water 100 0.1       # Smaller timesteps for accuracy
```

### Build New Models
Ideas for your investment/farm work:
- **Cash flow dynamics:** Revenue inflows, expense outflows, reinvestment loops
- **Herd growth:** Birth rates, death rates, sales, purchases
- **Soil organic matter:** Compost additions, mineralization, plant uptake
- **Equipment lifecycle:** Purchases, depreciation, maintenance, replacement
- **Trust accumulation:** Actions that build/erode trust in relationships

### Phase 3: Web Dashboard (When Ready)
- Simple HTTP server with `sys serve <model>`
- Chart.js for interactive plots
- Parameter sliders to experiment
- Compare multiple scenarios

### Phase 6: Electron App (The Goal)
Desktop app with:
- Visual model builder (drag stocks and flows)
- Real-time parameter adjustment
- Save/load projects
- Export charts as images

---

Keep building, battle buddy. The foundation is solid. ⚡
