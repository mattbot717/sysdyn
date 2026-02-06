#!/usr/bin/env node

/**
 * Forecast Mode - Rotation Planning & Optimization
 *
 * Full-engine forward planning using real weather forecast data
 * and brute-force rotation optimization.
 *
 * Sections:
 *   1. Weather forecast summary (14-day)
 *   2. Current paddock state (estimated from historical simulation)
 *   3. Forward projections per paddock (full engine, no grazing)
 *   4. Optimal rotation recommendations (ranked candidates)
 *   5. Weather insights
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { displayForecastSummary, getForecast, loadWeatherArchive } from '../lib/forecast.js';
import { estimateCurrentState, extractFinalState, buildWeatherTimeSeries } from '../lib/state-estimator.js';
import { optimizeRotation } from '../lib/optimizer.js';
import { refreshWeatherArchive } from '../lib/weather.js';
import { getCurrentPaddock } from '../lib/rotation.js';
import { simulate } from '../lib/engine.js';
import { loadModel } from '../lib/loader.js';
import {
  FORAGE_THRESHOLDS, PADDOCK_KEYS, getPaddockNamesMap, getForageStatus, PADDOCKS
} from '../lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PADDOCK_NAMES = getPaddockNamesMap();

// ============================================================
// Display helpers
// ============================================================

function forageIcon(forage) {
  if (forage < FORAGE_THRESHOLDS.critical) return '\u274C';
  if (forage < FORAGE_THRESHOLDS.low) return '\u26A0\uFE0F ';
  if (forage < FORAGE_THRESHOLDS.marginal) return '\u{1F7E1}';
  return '\u2705';
}

function displayCurrentState(finalState, currentPaddockId) {
  console.log('\n\u{1F4CA} CURRENT PADDOCK STATE (estimated from historical simulation):\n');
  console.log('  Paddock                | Forage (kg/ac) | Moisture (mm) | Status');
  console.log('  -----------------------|----------------|---------------|------------------');

  // Sort by forage descending
  const sorted = PADDOCK_KEYS
    .map(key => ({
      key,
      forage: finalState[`${key}_forage`] || 0,
      moisture: finalState[`${key}_moisture`] || 0,
      som: finalState[`${key}_som`] || 0,
    }))
    .sort((a, b) => b.forage - a.forage);

  for (const p of sorted) {
    const icon = forageIcon(p.forage);
    const status = getForageStatus(p.forage);
    const grazing = p.key === currentPaddockId ? ' (GRAZING)' : '';
    const name = (PADDOCK_NAMES[p.key] + grazing).padEnd(21);
    console.log(`  ${icon} ${name} | ${p.forage.toFixed(0).padStart(14)} | ${p.moisture.toFixed(1).padStart(13)} | ${status.label}`);
  }
  console.log('');
}

function displayProjections(projections, currentPaddockId) {
  console.log('\n\u{1F4C8} 14-DAY FORWARD PROJECTIONS (rest, no grazing):\n');

  for (const proj of projections) {
    const grazing = proj.key === currentPaddockId ? ' (currently grazing)' : '';
    const changeStr = proj.change >= 0 ? `+${proj.change.toFixed(0)}` : proj.change.toFixed(0);
    const pctStr = proj.changePct >= 0 ? `+${proj.changePct.toFixed(0)}%` : `${proj.changePct.toFixed(0)}%`;
    const endIcon = forageIcon(proj.endForage);
    const endStatus = getForageStatus(proj.endForage);

    console.log(`  ${endIcon} ${PADDOCK_NAMES[proj.key]}${grazing}`);
    console.log(`       Now: ${proj.startForage.toFixed(0)} kg/ac  \u2192  14-day: ${proj.endForage.toFixed(0)} kg/ac (${changeStr}, ${pctStr})`);
    console.log(`       Moisture: ${proj.startMoisture.toFixed(1)} \u2192 ${proj.endMoisture.toFixed(1)} mm  |  ${endStatus.label}`);
    console.log('');
  }
}

function displayRecommendations(optimResult, currentPaddockId) {
  console.log('\n\u{1F3AF} OPTIMAL ROTATION RECOMMENDATIONS:\n');
  console.log(`  Evaluated ${optimResult.candidateCount} rotation sequences in ${optimResult.elapsed}ms\n`);

  console.log('  Rank | Move To \u2192 Then          | Hay Days | Min Forage | Total Forage');
  console.log('  -----|--------------------------|----------|------------|-------------');

  const top = optimResult.ranked.slice(0, 5);
  for (const r of top) {
    const seq = r.candidate.moves.map(m => m.paddockId.toUpperCase()).join(' \u2192 ');
    const hay = r.score.metrics.hayDays;
    const hayStr = hay === 0 ? '     0' : `    ${hay}*`;
    console.log(`  ${String(r.rank).padStart(4)} | ${seq.padEnd(24)} | ${hayStr} | ${String(r.score.metrics.minEndForage).padStart(10)} | ${String(r.score.metrics.totalEndForage).padStart(11)}`);
  }

  // Best recommendation
  const best = optimResult.ranked[0];
  if (best) {
    const nextMove = best.candidate.moves[0];
    const thenMove = best.candidate.moves[1];

    console.log(`\n  \u{1F3C6} RECOMMENDED NEXT MOVE:`);
    console.log(`     Move to: ${nextMove.name} (${nextMove.paddockId.toUpperCase()}) for ${nextMove.duration} days`);
    if (thenMove) {
      console.log(`     Then to: ${thenMove.name} (${thenMove.paddockId.toUpperCase()}) for ${thenMove.duration} days`);
    }

    if (best.score.metrics.hayDays > 0) {
      console.log(`\n     \u26A0\uFE0F  Even the best path requires ~${best.score.metrics.hayDays} days of hay feeding.`);
    } else {
      console.log(`\n     \u2705 This path avoids hay feeding entirely.`);
    }

    // Show per-paddock end state for best scenario
    console.log(`\n     Projected end state (day ${best.candidate.totalDays}):`);
    for (const key of PADDOCK_KEYS) {
      const forage = best.score.metrics.perPaddock[key];
      if (forage !== undefined) {
        const icon = forageIcon(forage);
        console.log(`       ${icon} ${PADDOCK_NAMES[key]}: ${Math.round(forage)} kg/ac`);
      }
    }
  }
}

// ============================================================
// Main
// ============================================================

async function main() {
  try {
    console.log('\n\u{1F52E} FORECAST MODE: ROTATION PLANNING & OPTIMIZATION');
    console.log('\u2550'.repeat(56) + '\n');

    // --- Auto-refresh weather if stale ---
    let weatherArchive;
    try {
      weatherArchive = await loadWeatherArchive();
      const lastDate = weatherArchive.all.time[weatherArchive.all.time.length - 1];
      const todayStr = new Date().toISOString().split('T')[0];
      const daysStale = Math.floor((new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));

      if (daysStale > 0) {
        console.log(`\u26A0\uFE0F  Weather data is ${Math.abs(daysStale)} days stale. Refreshing...\n`);
        await refreshWeatherArchive();
        console.log('');
      }
    } catch {
      console.log('\u26A0\uFE0F  No weather archive found. Fetching...\n');
      await refreshWeatherArchive();
      console.log('');
    }

    // --- Section 1: Weather forecast ---
    await displayForecastSummary();

    // --- Section 2: Current paddock state ---
    console.log('\u23F3 Estimating current paddock state from 60-day historical simulation...');
    const stateEstimate = await estimateCurrentState({ historicalDays: 60 });
    const finalState = stateEstimate.finalState;
    const currentPaddockInfo = await getCurrentPaddock();

    displayCurrentState(finalState, currentPaddockInfo.id);

    console.log(`  \u{1F4CD} Herd location: ${currentPaddockInfo.name} (${currentPaddockInfo.daysSince} days)`);

    // --- Section 3: Forward projections (no grazing) ---
    // Simulate each paddock forward 14 days with no herd to see recovery potential
    const model = await loadModel('grazing-rotation-annual-v2');
    const plantingSchedule = JSON.parse(
      await readFile(join(__dirname, '../data/planting-schedule.json'), 'utf-8')
    );
    weatherArchive = await loadWeatherArchive();
    const todayStr = new Date().toISOString().split('T')[0];

    const projections = [];
    for (const key of PADDOCK_KEYS) {
      // Clone model and set initial state, put herd on paddock 0 (no paddock)
      const projModel = JSON.parse(JSON.stringify(model));
      for (const [stockName, value] of Object.entries(finalState)) {
        if (projModel.stocks[stockName]) {
          projModel.stocks[stockName].initial = value;
        }
      }

      const steps = 14;
      const timeSeriesParams = buildWeatherTimeSeries(weatherArchive, todayStr, steps, plantingSchedule);
      // Set current_paddock to 0 = no paddock grazing (all paddocks rest)
      timeSeriesParams.current_paddock = new Array(steps).fill(0);

      const results = simulate(projModel, { steps, dt: 1, timeSeriesParams });
      const endState = extractFinalState(results);

      projections.push({
        key,
        startForage: finalState[`${key}_forage`] || 0,
        endForage: endState[`${key}_forage`] || 0,
        change: (endState[`${key}_forage`] || 0) - (finalState[`${key}_forage`] || 0),
        changePct: finalState[`${key}_forage`] > 0
          ? ((endState[`${key}_forage`] - finalState[`${key}_forage`]) / finalState[`${key}_forage`]) * 100
          : 0,
        startMoisture: finalState[`${key}_moisture`] || 0,
        endMoisture: endState[`${key}_moisture`] || 0,
      });
    }

    projections.sort((a, b) => b.endForage - a.endForage);
    displayProjections(projections, currentPaddockInfo.id);

    // --- Section 4: Rotation optimizer ---
    console.log('\u2699\uFE0F  Running rotation optimizer...');
    const optimResult = await optimizeRotation({
      initialState: finalState,
      currentPaddock: currentPaddockInfo.id,
      movesAhead: 2,
      daysPerRotation: model.params.rotation_days || 14,
      plantingSchedule,
    });

    displayRecommendations(optimResult, currentPaddockInfo.id);

    // --- Section 5: Weather insights ---
    const forecast = await getForecast(14);
    if (forecast.length > 0) {
      const totalRain = forecast.reduce((sum, d) => sum + d.rain_mm, 0);
      const totalET = forecast.reduce((sum, d) => sum + d.et_mm, 0);

      console.log(`\n  \u{1F326}\uFE0F  WEATHER OUTLOOK:`);
      if (totalRain > totalET) {
        console.log(`     Forecast: SURPLUS (+${(totalRain - totalET).toFixed(1)}mm over 14 days)`);
        console.log(`     Good conditions for grazing and recovery.`);
      } else {
        console.log(`     Forecast: DEFICIT (${(totalRain - totalET).toFixed(1)}mm over 14 days)`);
        console.log(`     Consider shorter grazing periods. Monitor moisture closely.`);
      }
    }

    console.log('\n' + '\u2550'.repeat(56) + '\n');

  } catch (error) {
    console.error('\n\u274C Error:', error.message);
    if (process.argv.includes('--debug')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
