/**
 * lib/state-estimator.js
 *
 * Estimates current paddock state by running historical simulation.
 *
 * PROBLEM: We can't directly observe forage levels, soil moisture, or SOM.
 * SOLUTION: Simulate forward from a known starting point using actual weather
 * and rotation history, then read the final state.
 *
 * This is conceptually similar to data assimilation in numerical weather prediction —
 * reconstruct unobserved state from known inputs and model dynamics.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { simulate } from './engine.js';
import { loadModel } from './loader.js';
import { loadWeatherArchive } from './forecast.js';
import { loadRotationHistory } from './rotation.js';
import { preprocessWeather, generateCoolSeasonLifecycle, getPlantingIndex } from './weather-preprocessor.js';
import { PADDOCKS, PADDOCK_KEYS } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load planting schedule from data file
 * @returns {Promise<Object>} Planting schedule data
 */
async function loadPlantingSchedule() {
  const raw = await readFile(join(__dirname, '../data/planting-schedule.json'), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Build a current_paddock time series array from rotation history.
 * Maps each day in the simulation to the paddock the herd was grazing.
 *
 * @param {Object} rotationHistory - From loadRotationHistory()
 * @param {string} startDate - Simulation start date (YYYY-MM-DD)
 * @param {number} days - Number of days to generate
 * @returns {number[]} Paddock IDs (1-5) for each day
 */
export function buildHistoricalPaddockSchedule(rotationHistory, startDate, days) {
  const start = new Date(startDate + 'T12:00:00Z');
  const schedule = new Array(days);

  // Build a date→paddockId lookup from rotation history
  const dateLookup = {};
  for (const rot of rotationHistory.rotations) {
    const rotStart = new Date(rot.start + 'T12:00:00Z');
    const rotEnd = rot.end ? new Date(rot.end + 'T12:00:00Z') : new Date();
    const paddockId = PADDOCKS[rot.paddock]?.id || 3;

    for (let d = new Date(rotStart); d <= rotEnd; d.setDate(d.getDate() + 1)) {
      dateLookup[d.toISOString().split('T')[0]] = paddockId;
    }
  }

  // Fill the schedule array
  const defaultPaddock = PADDOCKS[rotationHistory.currentPaddock?.id]?.id || 3;
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    schedule[i] = dateLookup[dateStr] || defaultPaddock;
  }

  return schedule;
}

/**
 * Build complete time series params for the V2 model from weather archive.
 * Generates cool_temp_mult, per-paddock lifecycle arrays, and current_paddock.
 *
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {number} steps - Number of simulation steps
 * @param {Object} plantingSchedule - From loadPlantingSchedule()
 * @returns {Object} timeSeriesParams for engine.simulate()
 */
export function buildWeatherTimeSeries(weatherArchive, startDate, steps, plantingSchedule) {
  // Find the start index in the weather archive
  const startIdx = weatherArchive.all.time.indexOf(startDate);
  if (startIdx === -1) {
    throw new Error(`Start date ${startDate} not found in weather archive`);
  }

  // Slice weather data for our date range
  const slicedWeather = {
    daily: {
      time: weatherArchive.all.time.slice(startIdx, startIdx + steps),
      temperature_2m_max: weatherArchive.all.temperature_2m_max.slice(startIdx, startIdx + steps),
      temperature_2m_min: weatherArchive.all.temperature_2m_min.slice(startIdx, startIdx + steps),
      precipitation_sum: weatherArchive.all.precipitation_sum.slice(startIdx, startIdx + steps),
      et0_fao_evapotranspiration: weatherArchive.all.et0_fao_evapotranspiration.slice(startIdx, startIdx + steps),
    }
  };

  // Get temperature multipliers via preprocessWeather
  const processed = preprocessWeather(slicedWeather);

  // Generate per-paddock lifecycle arrays from planting dates.
  // IMPORTANT: The planting date is usually BEFORE the simulation start date,
  // so the plant index will be negative. This tells generateCoolSeasonLifecycle()
  // that the crop is already established (e.g., -98 means planted 98 days ago).
  const lifecycles = {};
  const simStartDate = new Date(startDate + 'T12:00:00Z');
  for (const key of PADDOCK_KEYS) {
    const paddockData = plantingSchedule.paddocks[key];
    const plantDate = paddockData?.cool_season?.['2025']?.planted || '2025-10-31';
    const plantDateObj = new Date(plantDate + 'T12:00:00Z');
    const plantIdx = Math.floor((plantDateObj - simStartDate) / (1000 * 60 * 60 * 24));
    lifecycles[`${key}_lifecycle`] = generateCoolSeasonLifecycle(plantIdx, steps);
  }

  return {
    cool_temp_mult: processed.cool_temp_mult,
    daily_precip: processed.precip,
    daily_et: processed.et,
    ...lifecycles,
  };
}

/**
 * Extract the final value of every stock from simulation results.
 * Returns a flat object suitable for setting as initial conditions.
 *
 * @param {Object} results - From engine.simulate()
 * @returns {Object} { stockName: finalValue, ... }
 */
export function extractFinalState(results) {
  const state = {};
  for (const [stockName, values] of Object.entries(results.stocks)) {
    state[stockName] = values[values.length - 1];
  }
  return state;
}

/**
 * Estimate current paddock state by running historical simulation.
 *
 * Loads the V2 model, fetches weather archive, builds rotation schedule,
 * and runs the simulation engine over the historical period. The final
 * stock values represent our best estimate of current conditions.
 *
 * @param {Object} options - Configuration
 * @param {string} options.modelName - Model to use (default: 'grazing-rotation-annual-v2')
 * @param {number} options.historicalDays - Days to simulate back (default: 60)
 * @returns {Promise<Object>} { results, finalState, meta }
 */
export async function estimateCurrentState(options = {}) {
  const {
    modelName = 'grazing-rotation-annual-v2',
    historicalDays = 60,
  } = options;

  // Load all inputs
  const model = await loadModel(modelName);
  const weatherArchive = await loadWeatherArchive();
  const rotationHistory = await loadRotationHistory();
  const plantingSchedule = await loadPlantingSchedule();

  // Calculate date range
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - historicalDays);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Verify weather data covers our range
  const todayIdx = weatherArchive.all.time.indexOf(todayStr);
  if (todayIdx === -1 || todayIdx < historicalDays) {
    throw new Error(`Weather archive doesn't cover ${historicalDays} days of history. Last date: ${weatherArchive.all.time[weatherArchive.all.time.length - 1]}`);
  }

  // Build time series params (V2: cool_temp_mult + per-paddock lifecycles)
  const timeSeriesParams = buildWeatherTimeSeries(
    weatherArchive, startDateStr, historicalDays, plantingSchedule
  );

  // Build rotation schedule (which paddock was grazed each day)
  const paddockSchedule = buildHistoricalPaddockSchedule(
    rotationHistory, startDateStr, historicalDays
  );
  timeSeriesParams.current_paddock = paddockSchedule;

  // Boost initial conditions to approximate pre-drought state
  // The model YAML values represent mid-drought conditions.
  // 60 days ago (early December) conditions were healthier.
  const historicalModel = JSON.parse(JSON.stringify(model));
  for (const key of PADDOCK_KEYS) {
    if (historicalModel.stocks[`${key}_forage`]) {
      historicalModel.stocks[`${key}_forage`].initial *= 1.4;
    }
  }

  // Run simulation
  const results = simulate(historicalModel, {
    steps: historicalDays,
    dt: 1,
    timeSeriesParams,
  });

  // Add date labels
  results.dates = weatherArchive.all.time.slice(
    weatherArchive.all.time.indexOf(startDateStr),
    weatherArchive.all.time.indexOf(startDateStr) + historicalDays + 1
  );

  const finalState = extractFinalState(results);

  return {
    results,
    finalState,
    meta: {
      modelName,
      historicalDays,
      startDate: startDateStr,
      endDate: todayStr,
      estimatedAt: new Date().toISOString(),
    },
  };
}
