#!/usr/bin/env node

/**
 * Weather-driven simulation
 *
 * Run grazing model with REAL weather data instead of constant parameters
 */

import { loadModel } from '../lib/loader.js';
import { validateModel, sparkline } from '../lib/engine.js';
import { getCollinsvilleWeather, summarizeWeather, displayWeatherSummary } from '../lib/weather.js';

/**
 * Run simulation with real weather data
 * @param {Object} model - The model definition
 * @param {Array} weatherDays - Array of daily weather objects
 * @param {number} dt - Time step (default 1 day)
 * @returns {Object} Simulation results
 */
function simulateWithWeather(model, weatherDays, dt = 1) {
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

  for (let dayIdx = 0; dayIdx < weatherDays.length; dayIdx++) {
    const weather = weatherDays[dayIdx];

    // Determine which paddock the herd is in today
    const rotation = getPaddockForDay(dayIdx);
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
function displayResults(results, model, weatherDays) {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  ${model.name.toUpperCase()}`);
  console.log(`  ${model.description}`);
  console.log('════════════════════════════════════════════════════════════\n');

  console.log(`⏱️  Simulated ${weatherDays.length} days with REAL weather data\n`);

  // Key paddock forage levels
  console.log('📊 PADDOCK FORAGE LEVELS:\n');

  const paddocks = ['cce', 'ccw', 'big', 'hog', 'south'];
  const paddockNames = {
    cce: 'Cedar Crest East',
    ccw: 'Cedar Crest West',
    big: 'Big Pasture',
    hog: 'Hog Pasture',
    south: "Frankie's Pasture",
  };

  // Calculate total grazing days per paddock
  const schedule = getRotationSchedule();
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
      const status = final < 500 ? '⚠️  CRITICAL' : final < 1000 ? '⚠️  LOW' : '✓ OK';
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

/**
 * Define rotation schedule based on actual farm history
 * Returns paddock number (1-5) for a given day
 */
function getRotationSchedule() {
  // Real rotation history (Dec 10, 2025 - Jan 31, 2026)
  // Day 0 = Dec 10, 2025 (roughly when weather data starts getting good)
  return [
    { paddock: 5, name: "Frankie's Pasture", startDay: 0, duration: 14 },   // Dec 10-24
    { paddock: 2, name: 'Cedar Crest West', startDay: 14, duration: 10 }, // Dec 24-Jan 3
    { paddock: 1, name: 'Cedar Crest East', startDay: 24, duration: 14 }, // Jan 3-17 (DROUGHT!)
    { paddock: 4, name: 'Hog Pasture', startDay: 38, duration: 5 },      // Jan 17-22
    { paddock: 3, name: 'Big Pasture', startDay: 43, duration: 38 },     // Jan 22-now (ice storm!)
  ];
}

function getPaddockForDay(day) {
  const schedule = getRotationSchedule();

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

    // Display rotation schedule
    console.log('🔄 ROTATION SCHEDULE:\n');
    const schedule = getRotationSchedule();
    for (const period of schedule) {
      console.log(`   Day ${period.startDay}-${period.startDay + period.duration - 1}: ${period.name} (${period.duration} days)`);
    }
    console.log('');

    // Fetch weather
    const weatherDays = await getCollinsvilleWeather(days, 0);

    // Show weather summary
    const summary = summarizeWeather(weatherDays);
    displayWeatherSummary(summary, `${days}-Day Period`);

    // Run simulation
    console.log('⚙️  Running weather-driven simulation...\n');
    const results = simulateWithWeather(model, weatherDays, 1);

    // Display results
    displayResults(results, model, weatherDays);

    // Critical warnings
    console.log('\n⚠️  WARNINGS:\n');

    const paddocks = ['cce', 'ccw', 'big', 'hog', 'south'];
    const paddockNames = {
      cce: 'Cedar Crest East',
      ccw: 'Cedar Crest West',
      big: 'Big Pasture',
      hog: 'Hog Pasture',
      south: "Frankie's Pasture",
    };

    for (const paddock of paddocks) {
      const forageName = `${paddock}_forage`;
      if (results.stocks[forageName]) {
        const final = results.stocks[forageName][results.stocks[forageName].length - 1];
        if (final < 500) {
          console.log(`  ❌ ${paddockNames[paddock]}: CRITICAL forage level (${final.toFixed(0)} kg/acre)`);
          console.log(`     → Hay feeding REQUIRED if grazing`);
        } else if (final < 1000) {
          console.log(`  ⚠️  ${paddockNames[paddock]}: LOW forage (${final.toFixed(0)} kg/acre)`);
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
