#!/usr/bin/env node

/**
 * Weather-driven simulation
 *
 * Run grazing model with REAL weather data instead of constant parameters
 */

import { loadModel } from '../lib/loader.js';
import { validateModel, sparkline } from '../lib/engine.js';
import { getCollinsvilleWeather, summarizeWeather, displayWeatherSummary } from '../lib/weather.js';
import { getRotationSchedule as loadRotationSchedule, displayRotationHistory } from '../lib/rotation.js';
import { PADDOCK_KEYS, getPaddockNamesMap, FORAGE_THRESHOLDS, getForageStatus } from '../lib/config.js';

/**
 * Run simulation with real weather data
 * @param {Object} model - The model definition
 * @param {Array} weatherDays - Array of daily weather objects
 * @param {number} dt - Time step (default 1 day)
 * @returns {Object} Simulation results
 */
async function simulateWithWeather(model, weatherDays, dt = 1) {
  // Validate model
  const errors = validateModel(model);
  if (errors.length > 0) {
    throw new Error(`Model validation failed:\n${errors.join('\n')}`);
  }

  // Initialize stocks
  const stocks = {};
  for (const [name, config] of Object.entries(model.stocks)) {
    stocks[name] = config.initial;
  }

  // Track time series
  const results = {
    time: [0],
    stocks: {},
    flows: {},
  };

  // Initialize result arrays
  for (const name of Object.keys(model.stocks)) {
    results.stocks[name] = [stocks[name]];
  }
  for (const name of Object.keys(model.flows)) {
    results.flows[name] = [];
  }

  // Simulation loop - one step per weather day
  let time = 0;

  // Load rotation schedule
  const schedule = await getRotationSchedule();

  for (let dayIdx = 0; dayIdx < weatherDays.length; dayIdx++) {
    const weather = weatherDays[dayIdx];

    // Determine which paddock the herd is in today
    const rotation = getPaddockForDay(dayIdx, schedule);
    model.params.current_paddock = rotation.paddock;

    // Override rain and ET parameters with actual weather
    model.params.base_rain_input = weather.rain_mm;
    model.params.base_evaporation = weather.et_mm;

    // Calculate flow rates for this timestep
    const flowRates = {};
    const context = { ...model.params, ...stocks };

    for (const [flowName, flow] of Object.entries(model.flows)) {
      try {
        // Add previously calculated flow rates to context (for dependencies)
        // Also add Math functions
        const fullContext = { ...context, ...flowRates, max: Math.max, min: Math.min };
        const rateFunc = new Function(...Object.keys(fullContext), `return ${flow.rate}`);
        const rate = rateFunc(...Object.values(fullContext));
        flowRates[flowName] = isNaN(rate) ? 0 : Math.max(0, rate);
      } catch (e) {
        throw new Error(`Error evaluating flow "${flowName}": ${e.message}`);
      }
    }

    // Update stocks (Euler integration)
    for (const [flowName, flow] of Object.entries(model.flows)) {
      const rate = flowRates[flowName];

      if (flow.from !== 'external') {
        stocks[flow.from] -= rate * dt;
        stocks[flow.from] = Math.max(0, stocks[flow.from]); // Prevent negative
      }

      if (flow.to !== 'external') {
        stocks[flow.to] += rate * dt;
      }
    }

    // Record results
    time += dt;
    results.time.push(time);

    for (const name of Object.keys(model.stocks)) {
      results.stocks[name].push(stocks[name]);
    }
    for (const name of Object.keys(model.flows)) {
      results.flows[name].push(flowRates[name]);
    }
  }

  return results;
}

/**
 * Display simulation results
 */
async function displayResults(results, model, weatherDays) {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  ${model.name.toUpperCase()}`);
  console.log(`  ${model.description}`);
  console.log('════════════════════════════════════════════════════════════\n');

  console.log(`⏱️  Simulated ${weatherDays.length} days with REAL weather data\n`);

  // Key paddock forage levels
  console.log('📊 PADDOCK FORAGE LEVELS:\n');

  const paddocks = PADDOCK_KEYS;
  const paddockNames = getPaddockNamesMap();

  // Calculate total grazing days per paddock
  const schedule = await getRotationSchedule();
  const grazingDays = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const period of schedule) {
    if (period.startDay + period.duration <= weatherDays.length) {
      grazingDays[period.paddock] += period.duration;
    } else {
      grazingDays[period.paddock] += Math.max(0, weatherDays.length - period.startDay);
    }
  }

  const paddockIdMap = { cce: 1, ccw: 2, big: 3, hog: 4, south: 5 };

  for (const paddock of paddocks) {
    const forageName = `${paddock}_forage`;
    if (results.stocks[forageName]) {
      const data = results.stocks[forageName];
      const initial = data[0];
      const final = data[data.length - 1];
      const change = final - initial;
      const pct = ((change / initial) * 100).toFixed(1);
      const min = Math.min(...data);
      const max = Math.max(...data);

      const spark = sparkline(data);
      const forageStatus = getForageStatus(final);
      const status = forageStatus.status === 'healthy' ? '✓ OK' : `⚠️  ${forageStatus.status.toUpperCase()}`;
      const daysGrazed = grazingDays[paddockIdMap[paddock]] || 0;
      const daysRested = weatherDays.length - daysGrazed;

      console.log(`  ${paddockNames[paddock]}`);
      console.log(`    ${initial.toFixed(0)} → ${final.toFixed(0)} kg/acre (${change > 0 ? '+' : ''}${pct}%) ${status}`);
      console.log(`    Grazed: ${daysGrazed} days | Rested: ${daysRested} days`);
      console.log(`    Range: ${min.toFixed(0)} - ${max.toFixed(0)} kg/acre`);
      console.log(`    ${spark}\n`);
    }
  }

  // Soil moisture status
  console.log('\n💧 SOIL MOISTURE LEVELS:\n');

  for (const paddock of paddocks) {
    const moistureName = `${paddock}_moisture`;
    if (results.stocks[moistureName]) {
      const data = results.stocks[moistureName];
      const final = data[data.length - 1];
      const status = final < 20 ? '⚠️  DRY' : final < 40 ? '⚠️  LOW' : '✓ OK';

      console.log(`  ${paddockNames[paddock]}: ${final.toFixed(1)} mm ${status}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════════\n');
}

// Schedule is now loaded from data/rotation-history.json via lib/rotation.js
let _schedule = null;

async function getRotationSchedule(startDate = '2025-12-10') {
  if (!_schedule) {
    _schedule = await loadRotationSchedule(startDate);
  }
  return _schedule;
}

function getPaddockForDay(day, schedule) {
  for (const period of schedule) {
    if (day >= period.startDay && day < period.startDay + period.duration) {
      return { paddock: period.paddock, name: period.name };
    }
  }

  // Default to last paddock if beyond schedule
  const last = schedule[schedule.length - 1];
  return { paddock: last.paddock, name: last.name };
}

async function main() {
  const args = process.argv.slice(2);
  const modelName = args[0] || 'grazing-rotation-real';
  const days = parseInt(args[1]) || 90;

  try {
    // Load model
    console.log(`\n📊 Loading model: ${modelName}...\n`);
    const model = await loadModel(modelName);

    // Display rotation history from JSON
    await displayRotationHistory();

    // Fetch weather
    const weatherDays = await getCollinsvilleWeather(days, 0);

    // Show weather summary
    const summary = summarizeWeather(weatherDays);
    displayWeatherSummary(summary, `${days}-Day Period`);

    // Run simulation
    console.log('⚙️  Running weather-driven simulation...\n');
    const results = await simulateWithWeather(model, weatherDays, 1);

    // Display results
    await displayResults(results, model, weatherDays);

    // Critical warnings
    console.log('\n⚠️  WARNINGS:\n');

    const warnPaddocks = PADDOCK_KEYS;
    const warnPaddockNames = getPaddockNamesMap();

    for (const paddock of warnPaddocks) {
      const forageName = `${paddock}_forage`;
      if (results.stocks[forageName]) {
        const final = results.stocks[forageName][results.stocks[forageName].length - 1];
        const status = getForageStatus(final);
        if (status.status === 'critical') {
          console.log(`  ❌ ${warnPaddockNames[paddock]}: CRITICAL forage level (${final.toFixed(0)} kg/acre)`);
          console.log(`     → Hay feeding REQUIRED if grazing`);
        } else if (status.status === 'low') {
          console.log(`  ⚠️  ${warnPaddockNames[paddock]}: LOW forage (${final.toFixed(0)} kg/acre)`);
          console.log(`     → Monitor closely, consider supplementation`);
        }
      }
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
