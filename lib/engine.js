/**
 * sysdyn simulation engine
 *
 * The core of the system. Takes a model definition, runs the simulation,
 * outputs time-series data.
 *
 * NUMERICAL INTEGRATION:
 *
 * We're solving differential equations of the form:
 *   d(stock)/dt = inflows - outflows
 *
 * Computers can't do continuous calculus, so we approximate with discrete steps:
 *   stock(t + dt) = stock(t) + (inflows - outflows) × dt
 *
 * This is Euler's method. Simple, intuitive, but has error proportional to dt.
 * For more accuracy, we'd use Runge-Kutta (RK4), which samples the rate at
 * multiple points within the timestep and takes a weighted average.
 *
 * For now: Euler. It works fine with small enough dt.
 */

// ============================================================
// Model Validation
// ============================================================

/**
 * Validate a model definition before running.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateModel(model) {
  const errors = [];

  if (!model.name) {
    errors.push('Model must have a name');
  }

  if (!model.stocks || Object.keys(model.stocks).length === 0) {
    errors.push('Model must have at least one stock');
  }

  if (!model.flows || Object.keys(model.flows).length === 0) {
    errors.push('Model must have at least one flow');
  }

  // Check that all flows reference valid stocks
  for (const [flowName, flow] of Object.entries(model.flows || {})) {
    if (flow.from && flow.from !== 'external' && !model.stocks[flow.from]) {
      errors.push(`Flow "${flowName}" references unknown stock "${flow.from}"`);
    }
    if (flow.to && flow.to !== 'external' && !model.stocks[flow.to]) {
      errors.push(`Flow "${flowName}" references unknown stock "${flow.to}"`);
    }
  }

  // Check that equations reference valid stocks/params
  // (Basic check - just look for undefined references)
  const validNames = new Set([
    ...Object.keys(model.stocks || {}),
    ...Object.keys(model.params || {}),
    ...Object.keys(model.flows || {}),
    'dt', 't', // built-in variables
  ]);

  for (const [flowName, flow] of Object.entries(model.flows || {})) {
    if (flow.rate) {
      const refs = extractReferences(flow.rate);
      for (const ref of refs) {
        if (!validNames.has(ref)) {
          errors.push(`Flow "${flowName}" references unknown variable "${ref}"`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract variable references from an equation string.
 * Simple regex - looks for word characters that aren't JS keywords.
 */
function extractReferences(equation) {
  const jsKeywords = new Set([
    'Math', 'min', 'max', 'abs', 'sin', 'cos', 'exp', 'log', 'pow', 'sqrt',
    'PI', 'E', 'if', 'else', 'true', 'false', 'null', 'undefined',
  ]);

  const matches = equation.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  return matches.filter(m => !jsKeywords.has(m));
}

// ============================================================
// Simulation Engine
// ============================================================

/**
 * Run a simulation.
 *
 * @param {object} model - The model definition
 * @param {object} options - Simulation options
 * @param {number} options.steps - Number of time steps to run
 * @param {number} options.dt - Time step size (default: 1)
 * @returns {object} - Results with time series for each stock
 */
export function simulate(model, options = {}) {
  const { steps = 100, dt = 1 } = options;

  // Validate first
  const validation = validateModel(model);
  if (!validation.valid) {
    throw new Error(`Invalid model:\n  ${validation.errors.join('\n  ')}`);
  }

  // Initialize state
  const state = {
    t: 0,
    dt,
    ...initializeStocks(model),
    ...initializeParams(model),
  };

  // Results storage
  const results = {
    meta: {
      model: model.name,
      steps,
      dt,
      startTime: new Date().toISOString(),
    },
    time: [],
    stocks: {},
    flows: {},
  };

  // Initialize result arrays
  for (const stockName of Object.keys(model.stocks)) {
    results.stocks[stockName] = [];
  }
  for (const flowName of Object.keys(model.flows)) {
    results.flows[flowName] = [];
  }

  // Record initial state
  recordState(results, state, model);

  // Main simulation loop
  for (let step = 0; step < steps; step++) {
    // Calculate all flow rates at current state
    const flowRates = calculateFlows(model, state);

    // Record flow rates
    for (const [flowName, rate] of Object.entries(flowRates)) {
      results.flows[flowName].push(rate);
    }

    // Update stocks (Euler integration)
    updateStocks(model, state, flowRates, dt);

    // Advance time
    state.t += dt;

    // Record new state
    recordState(results, state, model);
  }

  return results;
}

/**
 * Initialize stock values from model definition.
 */
function initializeStocks(model) {
  const stocks = {};
  for (const [name, def] of Object.entries(model.stocks)) {
    stocks[name] = typeof def === 'number' ? def : def.initial;
  }
  return stocks;
}

/**
 * Initialize parameter values from model definition.
 */
function initializeParams(model) {
  const params = {};
  for (const [name, value] of Object.entries(model.params || {})) {
    params[name] = value;
  }
  return params;
}

/**
 * Calculate all flow rates given current state.
 *
 * Flow rates are calculated from equations that can reference:
 * - Stock values
 * - Parameter values
 * - Other flow rates (careful with ordering!)
 * - Built-in: t (current time), dt (timestep)
 */
function calculateFlows(model, state) {
  const rates = {};

  for (const [flowName, flow] of Object.entries(model.flows)) {
    if (typeof flow.rate === 'number') {
      // Constant flow
      rates[flowName] = flow.rate;
    } else if (typeof flow.rate === 'string') {
      // Equation - evaluate it
      rates[flowName] = evaluateEquation(flow.rate, state, rates);
    } else {
      rates[flowName] = 0;
    }

    // Flows can't be negative (unless explicitly allowed)
    // This prevents stocks from going negative in basic models
    if (!flow.allowNegative && rates[flowName] < 0) {
      rates[flowName] = 0;
    }
  }

  return rates;
}

/**
 * Evaluate an equation string in the context of current state.
 *
 * This is where the magic happens. We build a function that has access
 * to all stocks, params, and previously calculated flows.
 *
 * SECURITY NOTE: We're using eval() here, which is fine for local use
 * but would be dangerous in a multi-user web context. For production,
 * you'd want a proper expression parser.
 */
function evaluateEquation(equation, state, rates) {
  try {
    // Build context object with all available variables
    const context = {
      ...state,
      ...rates,
      // Math functions available directly
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      sin: Math.sin,
      cos: Math.cos,
      exp: Math.exp,
      log: Math.log,
      pow: Math.pow,
      sqrt: Math.sqrt,
      PI: Math.PI,
      E: Math.E,
      // Conditional helper
      ifelse: (cond, a, b) => cond ? a : b,
    };

    // Create function with context variables as parameters
    const paramNames = Object.keys(context);
    const paramValues = Object.values(context);

    const fn = new Function(...paramNames, `return (${equation});`);
    return fn(...paramValues);
  } catch (err) {
    console.error(`Error evaluating equation: ${equation}`);
    console.error(err.message);
    return 0;
  }
}

/**
 * Update stock values using Euler integration.
 *
 * For each stock:
 *   new_value = old_value + (inflows - outflows) * dt
 *
 * This is the heart of system dynamics simulation.
 */
function updateStocks(model, state, flowRates, dt) {
  for (const [stockName, stockDef] of Object.entries(model.stocks)) {
    let netFlow = 0;

    // Sum up all flows affecting this stock
    for (const [flowName, flow] of Object.entries(model.flows)) {
      const rate = flowRates[flowName];

      if (flow.to === stockName) {
        netFlow += rate; // Inflow
      }
      if (flow.from === stockName) {
        netFlow -= rate; // Outflow
      }
    }

    // Euler step
    state[stockName] += netFlow * dt;

    // Optional: prevent negative stocks
    const minValue = stockDef.min ?? 0;
    if (state[stockName] < minValue) {
      state[stockName] = minValue;
    }
  }
}

/**
 * Record current state to results.
 */
function recordState(results, state, model) {
  results.time.push(state.t);
  for (const stockName of Object.keys(model.stocks)) {
    results.stocks[stockName].push(state[stockName]);
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get summary statistics for simulation results.
 */
export function summarize(results) {
  const summary = {
    duration: results.time[results.time.length - 1],
    stocks: {},
  };

  for (const [name, values] of Object.entries(results.stocks)) {
    summary.stocks[name] = {
      initial: values[0],
      final: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      change: values[values.length - 1] - values[0],
    };
  }

  return summary;
}

/**
 * Generate ASCII sparkline for a data series.
 * Compact visualization for terminal output.
 */
export function sparkline(data, width = 40) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const chars = '▁▂▃▄▅▆▇█';
  const step = Math.ceil(data.length / width);

  let spark = '';
  for (let i = 0; i < data.length; i += step) {
    const value = data[i];
    const normalized = (value - min) / range;
    const charIndex = Math.floor(normalized * (chars.length - 1));
    spark += chars[charIndex];
  }

  return spark;
}
