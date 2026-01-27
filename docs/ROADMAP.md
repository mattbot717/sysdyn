# sysdyn Roadmap

## Philosophy

This project exists to learn, grow, and get closer to the truth of how systems work.

Building the tool is as valuable as using it. Every layer we add is a chance to understand something new - numerical integration, data visualization, desktop app development. The destination matters, but so does the walk.

---

## Phase 1: Engine (Current)

The simulation core.

- [ ] Model definition format (YAML)
- [ ] Parser: YAML → internal representation
- [ ] Stocks, flows, parameters, equations
- [ ] Numerical integration (Euler first, then Runge-Kutta)
- [ ] Time-series output (JSON)
- [ ] Support for delays (pipeline, exponential)
- [ ] Non-linear table functions
- [ ] Basic validation and error messages

**Learning:** Numerical methods, simulation, DSL design.

---

## Phase 2: CLI

Thin wrapper around the engine.

- [ ] `sys new <model>` - create model scaffold
- [ ] `sys run <model>` - run simulation
- [ ] `sys validate <model>` - check for errors
- [ ] `sys list` - show available models
- [ ] `sys export <model> --format csv|json` - export results
- [ ] ASCII sparklines for quick terminal preview

**Learning:** CLI design patterns, piping data, UNIX philosophy.

---

## Phase 3: Web Dashboard (Static)

Simple browser-based visualization.

- [ ] `sys serve <model>` - start local server, open browser
- [ ] HTML + Chart.js for time-series plots
- [ ] Multiple stocks on same chart
- [ ] Parameter sliders (re-run simulation on change)
- [ ] Compare multiple runs / scenarios
- [ ] Export charts as PNG

**Learning:** Frontend basics, Chart.js, simple HTTP serving.

---

## Phase 4: Advanced Simulation

Deeper modeling capabilities.

- [ ] Aging chains (cohort models)
- [ ] Co-flows
- [ ] Stochastic runs (Monte Carlo)
- [ ] Sensitivity analysis (vary parameter, see impact)
- [ ] Optimization (find parameters that hit a target)
- [ ] Multi-model coupling

**Learning:** Statistical methods, optimization algorithms.

---

## Phase 5: Sensor Integration

Connect simulation to reality.

- [ ] Import time-series data (CSV, JSON, API)
- [ ] Overlay actual vs simulated
- [ ] Parameter estimation from data (fit model to reality)
- [ ] Live data feed (watch real-time)
- [ ] Alerts when reality diverges from model

**Learning:** Data pipelines, real-time systems, IoT protocols.

---

## Phase 6: Electron App ⚡

**THIS IS THE EXCITING ONE.**

A proper desktop application. Native feel. Works offline. One-click install.

- [ ] Learn Electron from scratch
- [ ] Package web UI as desktop app
- [ ] Native file dialogs (open/save models)
- [ ] Menubar, keyboard shortcuts
- [ ] Auto-update
- [ ] Maybe: visual model builder (drag-drop stocks and flows)
- [ ] Maybe: node-based equation editor

**Learning:** Electron, desktop app architecture, packaging, distribution. First native app ever built. A whole new world.

---

## Someday / Maybe

Ideas that might be worth exploring:

- Visual model editor (draw stock-and-flow diagrams)
- Import/export to other SD tools (Vensim, Stella)
- Collaborative modeling (share models, real-time edit)
- Model library / community sharing
- LLM integration (describe a system, generate model structure)
- Embed in other tools (use engine as a library)

---

## Principles

1. **Learn by building** - Every feature is a learning opportunity. Don't just copy-paste; understand.

2. **Simple first, fancy later** - Get something working, then improve it. Euler before Runge-Kutta. Static HTML before Electron.

3. **Truth over polish** - A correct simple model beats a beautiful broken one.

4. **Build for yourself** - This is a tool for your farm, your thinking, your understanding. External users are a bonus.

5. **Document the journey** - Write down what you learn. Future you will thank present you.

---

*"The purpose of a system is what it does."* — Stafford Beer

Let's find out what this one does.
