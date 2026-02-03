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
import { getDynamicSeasonMultiplier, getSeasonalBaseline, getTemperatureGrowthMultiplier, PADDOCKS } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Run historical simulation using actual weather data and rotation history
 * This reconstructs approximate forage levels for the past N days
 *
 * @param {object} model - The model definition
 * @param {object} rotationHistory - Rotation history data
 * @param {number} historicalDays - Number of days to simulate back
 * @returns {object} Simulation results with historical dates
 */
async function runHistoricalSimulation(model, rotationHistory, historicalDays = 60) {
  try {
    // Load weather archive
    const archive = await loadWeatherArchive();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find today's index in the archive
    const todayIndex = archive.all.time.findIndex(d => d === todayStr);
    if (todayIndex === -1 || todayIndex < historicalDays) {
      console.warn('Not enough historical weather data');
      return null;
    }

    // Build arrays for the historical period
    const startIndex = todayIndex - historicalDays;
    const seasonMultipliers = [];
    const rainInputs = [];
    const currentPaddockArray = [];

    // Build rotation lookup: date -> paddock ID
    const rotationSchedule = {};
    if (rotationHistory?.rotations) {
      for (const rot of rotationHistory.rotations) {
        const startDate = new Date(rot.start);
        const endDate = rot.end ? new Date(rot.end) : today;
        const paddockKey = rot.paddock;
        const paddockId = PADDOCKS[paddockKey]?.id || 3;

        // Mark each day with the paddock being grazed
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          rotationSchedule[d.toISOString().split('T')[0]] = paddockId;
        }
      }
    }

    // Generate time-series parameters from actual historical data
    for (let i = 0; i < historicalDays; i++) {
      const idx = startIndex + i;
      const dateStr = archive.all.time[idx];
      const date = new Date(dateStr);

      // Season multiplier from actual temperature
      const tempMax = archive.all.temperature_2m_max[idx];
      const tempMin = archive.all.temperature_2m_min[idx];
      if (tempMax !== null && tempMin !== null) {
        const tempMult = getTemperatureGrowthMultiplier(tempMax, tempMin);
        const baseline = getSeasonalBaseline(date);
        seasonMultipliers.push(0.6 * tempMult + 0.4 * baseline);
      } else {
        seasonMultipliers.push(getSeasonalBaseline(date));
      }

      // Rain from actual data
      const rain = archive.all.precipitation_sum[idx];
      rainInputs.push(rain !== null ? rain : 0);

      // Which paddock was being grazed on this date
      const paddockId = rotationSchedule[dateStr] || model.params.current_paddock || 3;
      currentPaddockArray.push(paddockId);
    }

    // Create a modified model with estimated historical starting conditions
    // Start with higher forage since we're going back in time before grazing impact
    const historicalModel = JSON.parse(JSON.stringify(model));

    // Estimate starting conditions ~60 days ago (pre-drought, healthier)
    const paddockKeys = ['cce', 'ccw', 'big', 'hog', 'south'];
    for (const key of paddockKeys) {
      if (historicalModel.stocks[`${key}_dormant`]) {
        historicalModel.stocks[`${key}_dormant`].initial *= 1.3; // Higher starting forage
      }
      if (historicalModel.stocks[`${key}_active`]) {
        historicalModel.stocks[`${key}_active`].initial *= 1.5;
      }
    }

    // Run simulation with historical data
    const results = simulate(historicalModel, {
      steps: historicalDays,
      dt: 1,
      timeSeriesParams: {
        season_multiplier: seasonMultipliers,
        base_rain_input: rainInputs,
        current_paddock: currentPaddockArray
      }
    });

    // Add date labels to results
    results.dates = [];
    for (let i = 0; i < historicalDays; i++) {
      results.dates.push(archive.all.time[startIndex + i]);
    }

    results.meta.type = 'historical';
    results.meta.startDate = archive.all.time[startIndex];
    results.meta.endDate = todayStr;

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

  // Generate dynamic season multipliers
  const seasonMultipliers = generateSeasonMultipliers(steps, weatherForecast);
  console.log(`📈 Generated ${steps}-day seasonal curve`);
  console.log(`   Day 1 multiplier: ${seasonMultipliers[0].toFixed(2)}`);
  console.log(`   Day ${steps} multiplier: ${seasonMultipliers[steps-1].toFixed(2)}`);

  // Generate rotation schedule for forward simulation
  const currentPaddockId = PADDOCKS[rotationHistory?.currentPaddock?.id]?.id || 3;
  const rotationDays = model.params.rotation_days || 14;
  const rotationSchedule = generateRotationSchedule(model, steps, rotationDays, currentPaddockId);
  console.log(`🔄 Generated rotation schedule: starts at paddock ${currentPaddockId}, rotates every ${rotationDays} days`);

  // Run initial simulation with dynamic seasonality AND rotation (FORWARD projection)
  console.log(`⚙️  Running forward simulation (Planning)...`);
  const initialResults = simulate(model, {
    steps,
    dt,
    timeSeriesParams: {
      season_multiplier: seasonMultipliers,
      current_paddock: rotationSchedule
    }
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

        // Regenerate season multipliers for requested step count
        const simSteps = reqSteps || steps;
        const simSeasonMultipliers = generateSeasonMultipliers(simSteps, weatherForecast);

        // Generate rotation schedule based on slider value
        const simRotationDays = modifiedModel.params.rotation_days || 14;
        const simCurrentPaddock = PADDOCKS[rotationHistory?.currentPaddock?.id]?.id || 3;
        const simRotationSchedule = generateRotationSchedule(modifiedModel, simSteps, simRotationDays, simCurrentPaddock);
        console.log('   → rotation schedule: every', simRotationDays, 'days, starting paddock', simCurrentPaddock);

        // Run simulation with dynamic seasonality AND rotation
        const results = simulate(modifiedModel, {
          steps: simSteps,
          dt: reqDt || dt,
          timeSeriesParams: {
            season_multiplier: simSeasonMultipliers,
            current_paddock: simRotationSchedule
          }
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
