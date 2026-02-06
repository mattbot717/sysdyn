/**
 * HTTP server for sysdyn web dashboard
 *
 * Uses Node's built-in http module for zero dependencies.
 * Serves a single-page dashboard with live simulation updates.
 *
 * Routes:
 *   GET  /      - Dashboard HTML page
 *   GET  /model - Current model definition as JSON
 *   POST /run   - Run simulation with parameters, returns results JSON
 */

import { createServer } from 'http';
import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { simulate } from '../engine.js';
import { loadModel } from '../loader.js';
import { generateHTML } from './template.js';
import { getForecast, loadWeatherArchive } from '../forecast.js';
import { loadRotationHistory } from '../rotation.js';
import { getDynamicSeasonMultiplier, getSeasonalBaseline, getTemperatureGrowthMultiplier, PADDOCKS, PADDOCK_KEYS } from '../config.js';
import { estimateCurrentState, buildWeatherTimeSeries } from '../state-estimator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Build time series params appropriate for the model.
 * V2 models (with cool_temp_mult in flow equations) need weather-preprocessed arrays.
 * Legacy models use the simpler season_multiplier approach.
 *
 * @param {object} model - Loaded model definition
 * @param {number} steps - Simulation steps
 * @param {number[]} rotationSchedule - Paddock IDs per day
 * @param {Array} weatherForecast - Forecast weather days (for legacy fallback)
 * @returns {Promise<object>} timeSeriesParams for simulate()
 */
async function buildTimeSeriesForModel(model, steps, rotationSchedule, weatherForecast) {
  // Check if model uses V2 time series params (cool_temp_mult, lifecycle arrays)
  const flowRates = Object.values(model.flows).map(f => f.rate).filter(r => typeof r === 'string');
  const needsV2 = flowRates.some(r => r.includes('cool_temp_mult'));

  if (needsV2) {
    // V2 model: use weather preprocessor for accurate time series
    try {
      const archive = await loadWeatherArchive();
      const plantingSchedule = JSON.parse(
        await readFile(join(__dirname, '../../data/planting-schedule.json'), 'utf-8')
      );
      const todayStr = new Date().toISOString().split('T')[0];
      const ts = buildWeatherTimeSeries(archive, todayStr, steps, plantingSchedule);
      ts.current_paddock = rotationSchedule;
      return ts;
    } catch (err) {
      console.warn('  Could not build V2 time series, falling back to legacy:', err.message);
    }
  }

  // Legacy model: use season_multiplier approach
  const seasonMultipliers = generateSeasonMultipliers(steps, weatherForecast);
  return {
    season_multiplier: seasonMultipliers,
    current_paddock: rotationSchedule,
  };
}

/**
 * Generate time-varying season multipliers for simulation
 * Combines weather forecast (first 14 days) with seasonal baseline (beyond)
 *
 * @param {number} steps - Number of simulation steps
 * @param {Array} weatherForecast - Array of forecast weather days
 * @returns {number[]} Array of season multipliers, one per step
 */
function generateSeasonMultipliers(steps, weatherForecast = []) {
  const today = new Date();
  const multipliers = [];

  for (let day = 0; day < steps; day++) {
    multipliers.push(getDynamicSeasonMultiplier(day, today, weatherForecast));
  }

  return multipliers;
}

/**
 * Generate a rotation schedule (paddock IDs per day) for the simulation
 * Uses a simple round-robin through paddocks, prioritizing by initial forage
 *
 * @param {object} model - The model with initial forage values
 * @param {number} steps - Number of simulation days
 * @param {number} rotationDays - Days to stay on each paddock
 * @param {number} startPaddock - Starting paddock ID (1-5)
 * @returns {number[]} Array of paddock IDs, one per day
 */
function generateRotationSchedule(model, steps, rotationDays, startPaddock) {
  // Get initial forage for each paddock to determine rotation order
  const paddockForage = [];
  const paddockKeys = ['cce', 'ccw', 'big', 'hog', 'south'];
  const paddockIds = [1, 2, 3, 4, 5];

  for (let i = 0; i < paddockKeys.length; i++) {
    const key = paddockKeys[i];
    const dormant = model.stocks[`${key}_dormant`]?.initial || 0;
    const active = model.stocks[`${key}_active`]?.initial || 0;
    paddockForage.push({
      id: paddockIds[i],
      key: key,
      forage: dormant + active
    });
  }

  // Sort paddocks by forage (highest first) for rotation priority
  // But start with the current paddock
  const sortedPaddocks = paddockForage
    .filter(p => p.id !== startPaddock)
    .sort((a, b) => b.forage - a.forage);

  // Build rotation order: start paddock, then by forage level
  const rotationOrder = [startPaddock, ...sortedPaddocks.map(p => p.id)];

  // Generate day-by-day schedule
  const schedule = [];
  let rotationIndex = 0;
  let daysOnCurrentPaddock = 0;

  for (let day = 0; day < steps; day++) {
    schedule.push(rotationOrder[rotationIndex % rotationOrder.length]);
    daysOnCurrentPaddock++;

    // Time to rotate?
    if (daysOnCurrentPaddock >= rotationDays) {
      rotationIndex++;
      daysOnCurrentPaddock = 0;
    }
  }

  return schedule;
}

/**
 * Run historical simulation using actual weather data and rotation history.
 * Delegates to state-estimator module for shared logic with CLI forecast tool.
 *
 * @param {object} model - The model definition
 * @param {object} rotationHistory - Rotation history data (unused, kept for API compat)
 * @param {number} historicalDays - Number of days to simulate back
 * @returns {object} Simulation results with historical dates
 */
async function runHistoricalSimulation(model, rotationHistory, historicalDays = 60) {
  try {
    const estimate = await estimateCurrentState({
      modelName: model.name,
      historicalDays,
    });

    const results = estimate.results;
    results.meta.type = 'historical';
    results.meta.startDate = estimate.meta.startDate;
    results.meta.endDate = estimate.meta.endDate;

    return results;
  } catch (err) {
    console.error('Historical simulation failed:', err);
    return null;
  }
}

/**
 * Start the web dashboard server
 * @param {string} modelName - Name of model to load
 * @param {object} options - { port, steps, dt }
 */
export async function startServer(modelName, options = {}) {
  const { port = 3000, steps = 100, dt = 1 } = options;

  // Load model
  console.log(`\n📊 Loading model: ${modelName}...`);
  const model = await loadModel(modelName);

  // Load rotation history
  console.log(`📋 Loading rotation history...`);
  const rotationHistory = await loadRotationHistory();

  // Load weather forecast for dynamic seasonality
  console.log(`🌤️  Loading weather forecast...`);
  let weatherForecast = [];
  try {
    weatherForecast = await getForecast(14);
    console.log(`   Got ${weatherForecast.length} days of forecast data`);
  } catch (err) {
    console.warn(`   ⚠️  Could not load forecast, using seasonal baseline only`);
  }

  // Generate rotation schedule for forward simulation
  const currentPaddockId = PADDOCKS[rotationHistory?.currentPaddock?.id]?.id || 3;
  const rotationDays = model.params.rotation_days || 14;
  const rotationSchedule = generateRotationSchedule(model, steps, rotationDays, currentPaddockId);
  console.log(`🔄 Generated rotation schedule: starts at paddock ${currentPaddockId}, rotates every ${rotationDays} days`);

  // Build time series params (V2 or legacy depending on model)
  console.log(`📈 Building time series parameters...`);
  const forwardTimeSeriesParams = await buildTimeSeriesForModel(model, steps, rotationSchedule, weatherForecast);
  console.log(`   Keys: ${Object.keys(forwardTimeSeriesParams).join(', ')}`);

  // Run initial simulation with dynamic seasonality AND rotation (FORWARD projection)
  console.log(`⚙️  Running forward simulation (Planning)...`);
  const initialResults = simulate(model, {
    steps,
    dt,
    timeSeriesParams: forwardTimeSeriesParams,
  });
  initialResults.meta.type = 'forecast';

  // Run historical simulation (BACKWARD reconstruction)
  console.log(`📜 Running historical simulation (Trends)...`);
  const historicalDays = 60;
  const historicalResults = await runHistoricalSimulation(model, rotationHistory, historicalDays);
  if (historicalResults) {
    console.log(`   Reconstructed ${historicalDays} days of forage history`);
  } else {
    console.log(`   ⚠️  Historical reconstruction unavailable`);
  }

  // Create server
  const server = createServer(async (req, res) => {
    // Parse URL
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;

    try {
      if (req.method === 'GET' && path === '/') {
        // Serve dashboard
        const html = generateHTML(model, initialResults, {
          steps,
          dt,
          rotationHistory,
          historicalResults
        });
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        });
        res.end(html);

      } else if (req.method === 'GET' && path === '/model') {
        // Return model definition
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(model));

      } else if (req.method === 'POST' && path === '/run') {
        // Run simulation with provided params
        const body = await readBody(req);
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (parseErr) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
          return;
        }
        const { params, steps: reqSteps, dt: reqDt } = parsed;

        // Debug: log received params
        console.log('📊 Simulation request received:');
        console.log('   Params:', JSON.stringify(params, null, 2));

        // Create modified model with new params
        const modifiedModel = {
          ...model,
          params: { ...model.params, ...params }
        };

        // Debug: log key params that affect grazing
        console.log('   → total_herd_weight:', modifiedModel.params.total_herd_weight);
        console.log('   → herd_count:', modifiedModel.params.herd_count);
        console.log('   → base_rain_input:', modifiedModel.params.base_rain_input);
        console.log('   → rotation_days:', modifiedModel.params.rotation_days);

        // Generate rotation schedule based on slider value
        const simSteps = reqSteps || steps;
        const simRotationDays = modifiedModel.params.rotation_days || 14;
        const simCurrentPaddock = PADDOCKS[rotationHistory?.currentPaddock?.id]?.id || 3;
        const simRotationSchedule = generateRotationSchedule(modifiedModel, simSteps, simRotationDays, simCurrentPaddock);
        console.log('   → rotation schedule: every', simRotationDays, 'days, starting paddock', simCurrentPaddock);

        // Build time series params (V2 or legacy)
        const simTimeSeriesParams = await buildTimeSeriesForModel(modifiedModel, simSteps, simRotationSchedule, weatherForecast);

        // Run simulation
        const results = simulate(modifiedModel, {
          steps: simSteps,
          dt: reqDt || dt,
          timeSeriesParams: simTimeSeriesParams,
        });

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(results));

      } else if (req.method === 'GET' && path === '/weather') {
        // Return 14-day weather forecast
        const forecast = await getForecast(14);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify(forecast));

      } else {
        // 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (err) {
      console.error('Server error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  // Start listening
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🌐 Dashboard running at: ${url}\n`);
    console.log('   Press Ctrl+C to stop\n');

    // Auto-open browser
    openBrowser(url);
  });

  // Handle clean shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down server...\n');
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
}

/**
 * Read request body as string
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Open URL in default browser
 */
function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log(`   Open manually: ${url}`);
    }
  });
}
