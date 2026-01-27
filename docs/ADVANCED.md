# Advanced System Dynamics Concepts

Going beyond stocks, flows, and basic feedback loops.

---

## 1. Delays

**The most underrated source of complexity.**

Delays are gaps between cause and effect. They're everywhere:

- Construction delay (decide to build → building complete)
- Perception delay (change happens → you notice it)
- Response delay (you decide to act → action takes effect)
- Material delay (order placed → inventory arrives)
- Biological delay (plant seed → harvest)

### Why Delays Matter

In **balancing loops**, delays cause oscillation:

```
  Shower temperature example:

  Water too cold
       ↓
  Turn handle toward hot
       ↓
  [DELAY: water in pipes]
       ↓
  Still cold... turn more
       ↓
  [DELAY]
       ↓
  SCALDING - turn toward cold
       ↓
  [DELAY]
       ↓
  ... oscillation continues
```

The longer the delay relative to the response, the worse the oscillation.

In **reinforcing loops**, delays cause overshoot:

```
  Population exceeds carrying capacity
       ↓
  Resources depleted
       ↓
  [DELAY: death rate takes time to rise]
       ↓
  Population still growing on momentum
       ↓
  Way overshoots sustainable level
       ↓
  Crash
```

### Types of Delays

- **Pipeline delay**: Fixed time. Order takes 2 weeks to arrive. 2 weeks, always.
- **Exponential delay**: Gradual adjustment. Perception changes by 10% of gap per period. Asymptotic approach.
- **Information delay**: You see lagging indicators, not current reality. Financial statements are history.

### Modeling Delays

Pipeline delay = chain of stocks:

```
  [Ordered] → flow → [In Transit Week 1] → flow → [In Transit Week 2] → flow → [Arrived]
```

Exponential delay:

```
  Perceived Value += (Actual Value - Perceived Value) × Adjustment Rate
```

---

## 2. Non-linear Relationships

Most real relationships aren't straight lines.

### Common Patterns

**Diminishing returns:**
```
  Yield
    │      ___________
    │    /
    │   /
    │  /
    │ /
    └──────────────────
         Fertilizer
```
First units of fertilizer help a lot. Later units help less. Eventually, no effect or harm.

**S-curve (logistic):**
```
  Adoption
    │         _______
    │       /
    │      /
    │_____/
    └──────────────────
            Time
```
Slow start, rapid middle, saturation at end.

**Threshold effects:**
```
  Response
    │            ____
    │           |
    │           |
    │___________|
    └──────────────────
         Input
```
Nothing happens until threshold, then sudden change. Tipping points.

**Hysteresis:**
Going up follows a different path than going down. Lake can eutrophy quickly, but recovery is slow and requires lower nutrient levels than the original tipping point.

### Modeling Non-linearity

Table functions: Define points, interpolate between them.

```
  Multiplier = table(Utilization)
  where table: (0, 1.0), (0.8, 1.0), (0.9, 0.9), (1.0, 0.5), (1.1, 0.1)
```

Built-in functions: min, max, if-then, smooth, delay, pulse.

---

## 3. Aging Chains (Cohort Models)

Stocks that progress through stages.

### Examples

**Cattle herd:**
```
  [Calves] → aging → [Yearlings] → aging → [Mature] → aging → [Culled]
       ↑                                        │
       └──────────── births ←──────────────────┘
```

**Crop lifecycle:**
```
  [Seeds] → germination → [Seedlings] → growth → [Mature] → harvest → [Yield]
```

**Equipment fleet:**
```
  [New] → aging → [Mid-life] → aging → [End-of-life] → disposal
    ↑                            │
    └────── purchases ←──────────┴──── maintenance decisions
```

**Project pipeline:**
```
  [Prospects] → qualification → [Qualified] → proposal → [Proposed] → close → [Won]
                                                              ↓
                                                           [Lost]
```

### Why Chains Matter

- Different stages have different properties (calves can't breed, old equipment breaks more)
- Delays are structural (it takes time to move through stages)
- History matters (age distribution affects future behavior)

---

## 4. Co-flows

When one stock moves, another must move with it.

### Examples

**Inventory and cash:**
```
  Buy inventory → Inventory increases, Cash decreases
  Sell inventory → Inventory decreases, Cash increases (at different rate)
```

**Herd and feed:**
```
  Animals consume feed proportional to their mass
  More animals = more feed flow out
```

**Embedded energy/carbon:**
```
  Physical goods carry embedded energy
  When goods flow, energy accounting flows with them
```

### Why Co-flows Matter

They enforce conservation laws. They connect systems that might otherwise be modeled separately. They reveal hidden dependencies.

---

## 5. Multi-System Coupling

Real systems don't exist in isolation.

### Farm as Coupled Systems

```
  WATER SYSTEM
  [Soil moisture] ← irrigation, rain
                  → evaporation, plant uptake, runoff
                            │
                            ↓ affects
  VEGETATION SYSTEM
  [Biomass] ← photosynthesis (depends on water, nutrients)
            → harvest, decomposition
                    │
                    ↓ decomposition adds to
  SOIL SYSTEM
  [Organic matter] ← residue, compost
                   → mineralization (releases nutrients)
                            │
                            ↓ affects
  NUTRIENT SYSTEM
  [Available N, P, K] ← fertilizer, mineralization
                      → plant uptake, leaching
                            │
                            ↓ affects
  VEGETATION SYSTEM (loop back)
```

Each system has its own stocks, flows, and timescales. But they influence each other. A drought affects all of them.

### Economic-Physical Coupling

```
  PHYSICAL: [Equipment condition] → degradation → [Unusable]
                    ↑
                    maintenance
                    ↑
  ECONOMIC: [Cash] → maintenance spending
              ↑
              revenue (depends on equipment working)
```

Deferred maintenance: Save cash now, accelerate degradation, reduce future revenue. The systems are coupled.

---

## 6. Stochastic Dynamics

Introducing randomness.

### Why Add Randomness?

- Real inputs are uncertain (weather, prices, yields)
- Test robustness: Does the system behave well under noise?
- Monte Carlo analysis: Run 1000 simulations, see distribution of outcomes
- Find fragilities: When does randomness cause failure?

### Types of Randomness

**White noise:** Random every timestep. Weather.
**Random walk:** Accumulated randomness. Stock prices.
**Poisson events:** Random discrete occurrences. Equipment failures.
**Correlated noise:** Random but autocorrelated. Drought years cluster.

### Simulation Approach

Run the model many times with different random seeds. Analyze:
- Mean trajectory
- Confidence bands (5th-95th percentile)
- Failure probability
- Worst-case scenarios

---

## 7. Leverage Points

Where to intervene in a system (from most to least effective):

1. **Paradigms** - The mindset out of which the system arises
2. **Goals** - The purpose of the system
3. **Power structure** - Who makes the rules
4. **Rules** - Incentives, constraints, laws
5. **Information flows** - Who knows what, when
6. **Reinforcing loops** - Driving growth or collapse
7. **Balancing loops** - Creating stability
8. **Delays** - Timing of feedback
9. **Stock structure** - Physical configuration
10. **Buffers** - Size of stabilizing stocks
11. **Parameters** - Numbers (often least effective!)

Most policy debates focus on parameters. System dynamicists focus on structure.

---

## 8. Reference Modes

Before building a model, sketch the behavior you're trying to understand:

- Is it growing exponentially?
- Oscillating?
- S-curve?
- Overshoot and collapse?
- Goal-seeking?
- Stagnating?

The reference mode guides model structure. If you're seeing oscillation, look for balancing loops with delays. If you're seeing exponential growth, look for reinforcing loops without limits.

---

## 9. Validation

Models aren't right or wrong, they're useful or not. But test them:

- **Structure verification**: Do the stocks and flows make physical sense?
- **Dimensional consistency**: Do units work out?
- **Extreme conditions**: What happens if a stock goes to 0 or infinity?
- **Behavior reproduction**: Does it match historical patterns?
- **Sensitivity analysis**: Which parameters matter most?
- **Surprise**: Does it reveal anything non-obvious?

---

## Reading List

- *Thinking in Systems* by Donella Meadows (start here)
- *Business Dynamics* by John Sterman (comprehensive textbook)
- *The Fifth Discipline* by Peter Senge (organizational systems)
- *Limits to Growth* by Meadows et al. (the famous world model)
- *Industrial Dynamics* by Jay Forrester (the original)

---

*"The behavior of a system cannot be known just by knowing the elements of which the system is made."*
— Donella Meadows
