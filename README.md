# sysdyn

A system dynamics playground. Model feedback loops, simulate behavior, build intuition for how complex systems work.

## The Core Idea

Everything is **stocks** and **flows**.

- **Stock** = an accumulation. A bathtub's water level. Money in an account. Population of a city. Soil moisture on a field. Trust in a relationship. Anything that piles up or depletes over time.

- **Flow** = a rate of change. Water pouring in, draining out. Income, expenses. Births, deaths. Irrigation, evaporation. Flows fill or drain stocks.

That's it. Two concepts. But they compose into arbitrarily complex systems.

```
         ┌─────────────┐
  flow → │    STOCK    │ → flow
   in    │  (quantity) │    out
         └─────────────┘
```

A bathtub: stock is water level, inflow is faucet, outflow is drain.
A bank account: stock is balance, inflow is deposits + interest, outflow is withdrawals.
A farm's soil: stock is moisture, inflow is rain + irrigation, outflow is evaporation + plant uptake.

Simple. But here's where it gets interesting.

---

## Feedback Loops

When a stock influences its own flows, you get **feedback**. This is where complex behavior emerges from simple rules.

### Reinforcing Loops (Positive Feedback)

Amplifies change. Growth breeds growth. Decline accelerates decline.

```
  Money in account
        ↓
  Earns interest
        ↓
  More money in account
        ↓
  Earns more interest
        ↓
  ... (exponential growth)
```

Other examples:
- Population growth (more people → more births → more people)
- Viral spread (more infected → more contact → more infected)
- Word of mouth (more users → more referrals → more users)
- Erosion (less vegetation → more runoff → less vegetation)

Reinforcing loops are engines of growth **and** collapse. They don't stabilize on their own.

### Balancing Loops (Negative Feedback)

Seeks equilibrium. Pushes toward a goal.

```
  Room temperature
        ↓
  Gap from setpoint (70°F)
        ↓
  Heater output
        ↓
  Room temperature moves toward setpoint
        ↓
  Gap shrinks
        ↓
  ... (approaches equilibrium)
```

Other examples:
- Thermostat (temperature gap → heating/cooling → temperature correction)
- Predator-prey (more prey → more predators → fewer prey → fewer predators)
- Market prices (high price → less demand → price drops)
- Body temperature regulation

Balancing loops create stability, oscillation, or hunting behavior depending on delays and gains.

---

## Where It Gets Deep

Real systems have **both** loop types interacting. That's where you get:

- **S-curves** (growth that levels off): Reinforcing loop dominates early, balancing loop dominates late. Population hitting carrying capacity. Product adoption saturating a market.

- **Oscillation**: Balancing loops with delays. The shower that's too hot, then too cold. Inventory cycles. Economic boom-bust.

- **Overshoot and collapse**: Reinforcing loop pushes past sustainable limits before balancing loop kicks in. Overshooting carrying capacity → population crash.

- **Tipping points**: System flips from one stable state to another. Lake eutrophication. Climate tipping points. Trust collapse.

- **Policy resistance**: Interventions fail because feedback loops counteract them. Push here, system pushes back there.

---

## Advanced Concepts

Beyond basic stocks and flows:

### Delays
Time lags between cause and effect. Delays in balancing loops cause oscillation. Delays in reinforcing loops cause overshoot. Most real systems have significant delays - construction time, growth time, perception delays.

### Non-linear Relationships
Not everything is proportional. Diminishing returns. Thresholds. Saturation effects. A flow might depend on a stock via a curve, not a line.

### Co-flows
Stocks that must move together. You can't ship products without also shipping their associated costs, embedded energy, information.

### Aging Chains
Stocks that progress through stages. Cattle aging from calf → heifer → cow. Crops from seed → seedling → mature → harvest.

### Multi-system Coupling
Systems that influence each other. Water system affects vegetation system affects soil system affects water system. Economic system affects social system affects political system.

### Stochastic Elements
Randomness. Weather. Market shocks. Disease outbreaks. How does the system behave under uncertainty?

---

## Why This Matters

System dynamics gives you a **language** for thinking about complexity. Once you see stocks and flows, you see them everywhere:

- Farm economics (cash stock, operating flows, equipment depreciation)
- Soil health (organic matter stock, inputs and losses)
- Water management (aquifer levels, recharge and extraction)
- Herd dynamics (animal populations, birth/death/sale flows)
- Equipment lifecycle (condition stock, maintenance and wear)
- Even relationships and trust

The models aren't reality - they're **thinking tools**. Building a model forces you to make assumptions explicit. Simulating it reveals consequences your intuition might miss.

---

## What We're Building

A CLI tool to:

1. **Define** stocks, flows, and parameters in a simple format
2. **Connect** them with equations (flows depend on stocks and params)
3. **Simulate** behavior over time
4. **Visualize** results (ASCII charts, exportable data)
5. **Explore** - change parameters, see what happens

Plus a library of models to learn from and build on.

---

## Installation

```bash
cd ~/lab/sysdyn
npm link
```

## Usage

```bash
sys new <model>           # Create a new model
sys stock <name> <init>   # Add a stock with initial value
sys flow <name> ...       # Add a flow
sys param <name> <value>  # Set a parameter
sys run [--steps N]       # Simulate
sys plot <stock>          # Visualize
sys load <model>          # Load a pre-built model
sys list                  # Show available models
```

---

## Philosophy

> "All models are wrong, but some are useful." — George Box

We're not trying to predict the future. We're trying to understand structure - how the pieces connect, where the leverage points are, which interventions might backfire.

The goal is **insight**, not prediction.

---

A battle buddy lab project.
