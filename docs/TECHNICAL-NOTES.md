# Technical Notes & Architectural Decisions

## Language Choice: JavaScript

### Current Decision
This project is built in **JavaScript/Node.js** for the following reasons:

1. **Electron Desktop App Goal** - Phase 6 of the roadmap targets an Electron app, which requires JavaScript
2. **Full-stack Consistency** - Same language for CLI, web UI, and desktop app
3. **Easy Distribution** - npm ecosystem, simple bundling for end users
4. **Web Integration** - Engine runs natively in browsers for interactive dashboards
5. **Learning Continuity** - One language from CLI to desktop app development

### Trade-offs

This section documents alternatives **if** you decide to professionalize this tool for academic publication or high-performance production use parallel to the Electron app.

---

## Alternative 1: Python

### When to Consider
- Publishing academic papers (Python has more credibility in science)
- Integrating with existing SD tools (PySD, Vensim Python API)
- Advanced data analysis workflows (pandas, Jupyter notebooks)
- Collaborating with researchers who prefer Python

### Pros
- **NumPy/SciPy** - Fast numerical computing, battle-tested ODE solvers
- **Scientific Libraries** - pandas (data), matplotlib/seaborn (viz), statsmodels (analysis)
- **Jupyter Notebooks** - Interactive exploration, publishable research documents
- **Community** - Massive scientific Python ecosystem, lots of examples
- **Credibility** - Academic papers written with Python code are well-accepted
- **Integration** - Easy to connect with PySD, existing Vensim models

### Cons
- **Desktop App Challenge** - PyQt/Tkinter are clunkier than Electron
- **Web UI Requires Backend** - Flask/Django server needed, can't run in browser
- **Two Languages** - Python backend + JavaScript frontend for web
- **Distribution** - PyInstaller is less polished than Electron packaging
- **Loses Learning Path** - Diverges from Electron skill development

### Migration Path
If you go this route:
1. Rewrite `lib/engine.js` as `engine.py` using SciPy's `odeint` or `solve_ivp`
2. Use pandas DataFrame for results instead of JavaScript objects
3. Add Jupyter notebook examples for interactive model exploration
4. Keep JavaScript Electron app as separate "consumer" of Python simulation engine
5. Use Flask API to bridge Python engine ↔ JavaScript UI

**Example Architecture:**
```
Python engine (simulation core)
    ↓
Flask REST API
    ↓
JavaScript Electron app (UI)
```

---

## Alternative 2: Julia

### When to Consider
- Performance is critical (10,000+ timestep simulations, Monte Carlo with 100k runs)
- You need cutting-edge numerical methods
- Academic collaboration with Julia community
- You're okay learning a new language for significant performance gains

### Pros
- **Performance** - Near C++ speed (10-100x faster than JavaScript for numerical code)
- **DifferentialEquations.jl** - World-class ODE solving, automatic stiffness detection
- **Scientific Type System** - Designed for numerical computing from the ground up
- **Multiple Dispatch** - Elegant way to handle different model types
- **Growing Community** - Increasingly popular in computational science

### Cons
- **Smaller Ecosystem** - Fewer packages than Python or JavaScript
- **Desktop App Story** - No good native GUI framework (would still need Electron)
- **Learning Curve** - New language to learn, different paradigms
- **Deployment Complexity** - Less mature packaging than Python/JavaScript
- **Overkill** - For typical SD models, JavaScript is fast enough

### Migration Path
If performance becomes critical:
1. Rewrite hot loops (integration kernel) in Julia
2. Export Julia functions via PackageCompiler.jl
3. Call from JavaScript via child process or HTTP API
4. Keep UI in JavaScript/Electron
5. Julia becomes "computation backend"

**Hybrid Architecture:**
```
JavaScript UI (Electron)
    ↓
Julia computation server (high-performance simulations)
    ↓
Results back to UI
```

---

## Alternative 3: Rust + WebAssembly

### When to Consider
- You want maximum performance without leaving JavaScript ecosystem
- Distributing computation-heavy web apps (run in browser, near-native speed)
- You want to learn systems programming
- You need guaranteed memory safety

### Pros
- **Performance** - Compiled to native code, as fast as C++
- **WebAssembly** - Compile to WASM, run in browsers at near-native speed
- **Memory Safety** - No garbage collection pauses, no memory leaks
- **JavaScript Integration** - WASM modules work seamlessly with JavaScript
- **Modern Language** - Better ergonomics than C++, safer than C

### Cons
- **Steep Learning Curve** - Borrow checker, ownership model is hard
- **Numerical Ecosystem** - Smaller than Python, less mature than NumPy
- **Development Speed** - Slower iteration than JavaScript (compilation step)
- **Overkill for CLI** - Adds complexity without clear benefit for Node.js tools

### Migration Path
If you want browser-based high-performance simulation:
1. Rewrite `engine.js` in Rust
2. Compile to WebAssembly
3. Load WASM module in browser JavaScript
4. UI stays in JavaScript, computation in Rust/WASM
5. Electron app uses same WASM module

**Architecture:**
```
Rust simulation engine
    ↓ compile
WebAssembly module
    ↓ import
JavaScript UI (browser or Electron)
```

---

## Recommendation Matrix

| Use Case | Language | Reasoning |
|----------|----------|-----------|
| **Desktop app (current goal)** | JavaScript | Only practical choice for Electron |
| **Academic publication** | Python | Scientific credibility, Jupyter notebooks |
| **High-performance research** | Julia | Speed when it matters, modern numerics |
| **Web-based simulation** | Rust → WASM | Run heavy computation in browser |
| **Learning & prototyping** | JavaScript | Fast iteration, full-stack flexibility |

---

## Current Status: JavaScript is Correct

For Phase 1-6 of the roadmap, **JavaScript is the right choice**. Performance is sufficient for typical SD models, the path to Electron is clear, and you're learning marketable full-stack skills.

**Only reconsider if:**
1. You abandon the Electron app goal
2. Performance becomes a measured bottleneck (not theoretical)
3. You want to publish academic papers and need Python credibility
4. You're integrating with Python-only tools (PySD, pandas pipelines)

**Hybrid approach is possible:**
- Keep Electron app in JavaScript
- Build parallel "research engine" in Python for academic work
- Use same model files (YAML), different simulation backends
- Publish Python code in papers, ship JavaScript app to users

---

## Future Optimization Strategies

If JavaScript performance becomes limiting:

1. **Better Integration Method** - Switch from Euler to Runge-Kutta (RK4)
   - More accurate, can use larger timesteps
   - Pure JavaScript, no language change needed

2. **JIT Optimization** - Leverage V8's optimizations
   - Pre-compile equation functions once, reuse
   - Use typed arrays for stock values
   - Avoid object property lookups in hot loops

3. **Web Workers** - Parallel simulation runs
   - Monte Carlo across multiple CPU cores
   - JavaScript has good threading support

4. **Hybrid Rust/WASM** - Keep UI in JS, computation in Rust
   - Best of both worlds
   - Transparent to end users

Don't optimize until you measure actual performance problems. "Premature optimization is the root of all evil."

---

## References

- **Python SD Tools:** PySD (https://pysd.readthedocs.io/)
- **Julia DiffEq:** DifferentialEquations.jl (https://diffeq.sciml.ai/)
- **Rust WASM:** wasm-bindgen (https://rustwasm.github.io/)
- **JavaScript Optimization:** V8 performance tips (https://v8.dev/blog)

---

*Last updated: 2026-01-27*
