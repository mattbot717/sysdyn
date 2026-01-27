# sysdyn Session Notes

## Where We Left Off

**Date:** 2026-01-27

We're building a system dynamics simulation engine. Here's what exists:

### Completed

1. **Documentation**
   - `README.md` - Core concepts (stocks, flows, feedback loops)
   - `docs/ADVANCED.md` - Deep dive into delays, non-linearity, aging chains, etc.
   - `docs/ROADMAP.md` - Full project vision including the Electron app goal

2. **Engine Core** (`lib/engine.js`)
   - Model validation
   - Euler integration (stock += flow × dt)
   - Equation evaluation (flow rates calculated from formulas)
   - Results output (time series for each stock)
   - Sparkline generator for terminal visualization

3. **Model Loader** (`lib/loader.js`)
   - Simple YAML parser (no dependencies)
   - Load/save model files
   - Model scaffolding for new models
   - List available models

4. **Example Model** (`models/farm-water.yaml`)
   - Soil moisture dynamics
   - Multiple stocks (soil_moisture, deep_water)
   - Multiple flows (rain, evaporation, plant_uptake, percolation, runoff)
   - Demonstrates threshold effects (runoff only when saturated)

### Not Yet Built

- **CLI** (`bin/sys.js`) - The command-line interface
- **Web visualization** - Chart.js dashboard
- **Testing** - Actually running the engine to verify it works

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

See you tomorrow, battle buddy.
