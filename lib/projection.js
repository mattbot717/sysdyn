/**
 * lib/projection.js
 *
 * Scenario comparison engine for forward projections.
 *
 * Projects paddock recovery trajectories under multiple scenarios:
 *   A. Move herd off focus paddock immediately (pure recovery)
 *   B. Finish current rotation + hay supplement
 *   C. Finish current rotation, no hay supplement
 *
 * Returns structured data — no console output. Display is handled by the CLI.
 */

import { simulate } from './engine.js';
import { loadModel } from './loader.js';
import { loadWeatherArchive } from './forecast.js';
import { getCurrentPaddock } from './rotation.js';
import {
  estimateCurrentState,
  loadPlantingSchedule,
  extendWeatherTimeSeries,
  extractFinalState,
} from './state-estimator.js';
import { buildRotationSchedule } from './optimizer.js';
import { PADDOCKS, PADDOCK_KEYS } from './config.js';

/**
 * Project paddock recovery under 3 scenarios.
 *
 * Orchestrates the full projection pipeline:
 *   1. estimateCurrentState() → initial conditions
 *   2. extendWeatherTimeSeries() → full weather for horizon
 *   3. getCurrentPaddock() → current paddock + remaining days
 *   4. buildRotationSchedule() → realistic multi-paddock rotation
 *   5. Run 3 scenarios via simulate()
 *   6. Return structured results
 *
 * @param {Object} options - Projection configuration
 * @param {string|null} options.paddock - Focus paddock key (null = current paddock)
 * @param {number} options.days - Projection horizon in days (default: 90)
 * @param {number} options.hayFactor - Hay supplement factor for Scenario B (default: 0.4)
 * @param {number} options.historicalDays - Days of history for state estimation (default: 60)
 * @returns {Promise<Object>} Structured projection results
 */
export async function projectForward(options = {}) {
  const {
    paddock = null,
    days = 90,
    hayFactor = 0.4,
    historicalDays = 60,
  } = options;

  // 1. Estimate current state from historical simulation
  const { finalState } = await estimateCurrentState({ historicalDays });

  // 2. Load weather archive and planting schedule
  const weatherArchive = await loadWeatherArchive();
  const plantingSchedule = await loadPlantingSchedule();
  const todayStr = new Date().toISOString().split('T')[0];

  // 3. Extend weather time series to cover full projection horizon
  const timeSeriesParams = extendWeatherTimeSeries(
    weatherArchive, todayStr, days, plantingSchedule
  );

  // Weather info for display
  const startIdx = weatherArchive.all.time.indexOf(todayStr);
  const availableDays = weatherArchive.all.time.length - startIdx;
  const forecastDays = Math.min(days, availableDays);
  const proxyDays = Math.max(0, days - availableDays);

  // 4. Get current paddock info
  const current = await getCurrentPaddock();
  const focusPaddock = paddock || current.id;
  const focusName = PADDOCKS[focusPaddock]?.name || focusPaddock;
  const daysOnCurrent = current.daysSince;
  const remainingDays = Math.max(0, 14 - daysOnCurrent);

  // 5. Build rotation schedules for 3 scenarios

  // A: Move herd off focus paddock immediately (pure recovery)
  const scheduleA = buildRotationSchedule({
    startPaddock: focusPaddock,
    remainingDays: 0,
    totalDays: days,
    excludePaddocks: [focusPaddock],
  });

  // B & C: Finish current rotation, then cycle (excluding focus)
  const scheduleBC = buildRotationSchedule({
    startPaddock: focusPaddock,
    remainingDays,
    totalDays: days,
    excludePaddocks: [focusPaddock],
  });

  // 6. Define scenarios
  const scenarioDefs = [
    {
      name: `A. Move off now, rest ${focusName} immediately`,
      schedule: scheduleA,
      hayFactor: 0,
    },
    {
      name: `B. Finish rotation (${remainingDays}d) + hay, then cycle`,
      schedule: scheduleBC,
      hayFactor,
    },
    {
      name: `C. Finish rotation (${remainingDays}d) no hay, then cycle`,
      schedule: scheduleBC,
      hayFactor: 0,
    },
  ];

  // 7. Run simulations
  const scenarios = [];
  for (const def of scenarioDefs) {
    const model = await loadModel('grazing-rotation-annual-v2');

    // Set initial state from current estimate
    for (const [stockName, value] of Object.entries(finalState)) {
      if (model.stocks[stockName]) {
        model.stocks[stockName].initial = value;
      }
    }

    // Set hay supplement factor
    model.params.hay_supplement_factor = def.hayFactor;

    // Build time series with rotation schedule
    const ts = { ...timeSeriesParams, current_paddock: def.schedule };

    const simResult = simulate(model, {
      steps: days,
      dt: 1,
      timeSeriesParams: ts,
    });

    const focusForage = simResult.stocks[`${focusPaddock}_forage`];
    const focusMoisture = simResult.stocks[`${focusPaddock}_moisture`];

    scenarios.push({
      name: def.name,
      forage: focusForage,
      moisture: focusMoisture,
      startForage: focusForage[0],
      endForage: focusForage[focusForage.length - 1],
      minForage: Math.min(...focusForage),
      maxForage: Math.max(...focusForage),
      daysTo500: focusForage.findIndex(f => f >= 500),
      daysTo800: focusForage.findIndex(f => f >= 800),
      daysTo1200: focusForage.findIndex(f => f >= 1200),
      daysTo1500: focusForage.findIndex(f => f >= 1500),
      allEndState: extractFinalState(simResult),
    });
  }

  return {
    focusPaddock,
    focusName,
    days,
    currentPaddock: current,
    remainingDays,
    finalState,
    weatherInfo: {
      forecastDays,
      proxyDays,
      startDate: todayStr,
    },
    scenarios,
  };
}
