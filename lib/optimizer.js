/**
 * lib/optimizer.js
 *
 * Rotation optimizer for adaptive grazing management.
 *
 * Generates candidate rotation sequences, simulates each using the full
 * engine with real weather data, and scores/ranks them to find the optimal
 * next moves.
 *
 * APPROACH: Brute-force combinatorial search.
 * With 5 paddocks and 2 moves ahead, the search space is 4x4 = 16 candidates.
 * Each simulation takes ~1ms, so the full optimization runs in <50ms.
 *
 * SCORING: Lexicographic priority
 *   1. Minimize hay days (days where grazed paddock forage < critical)
 *   2. Maximize minimum end forage across all paddocks (resilience)
 *   3. Maximize total end forage (overall productivity)
 */

import { simulate } from './engine.js';
import { loadModel } from './loader.js';
import { PADDOCKS, PADDOCK_KEYS, FORAGE_THRESHOLDS } from './config.js';
import { buildWeatherTimeSeries, extractFinalState } from './state-estimator.js';
import { loadWeatherArchive } from './forecast.js';

/**
 * Generate all candidate rotation sequences.
 *
 * @param {string} currentPaddock - Current paddock ID (e.g., "big")
 * @param {Object} options - Configuration
 * @param {number} options.movesAhead - Rotations to look ahead (default: 2)
 * @param {number} options.daysPerRotation - Days per rotation (default: 14)
 * @returns {Array<Object>} Candidates: { moves: [...], totalDays }
 */
export function generateCandidates(currentPaddock, options = {}) {
  const { movesAhead = 2, daysPerRotation = 14 } = options;

  const otherPaddocks = PADDOCK_KEYS.filter(k => k !== currentPaddock);
  const candidates = [];

  if (movesAhead === 1) {
    for (const first of otherPaddocks) {
      candidates.push({
        moves: [{ paddockId: first, numericId: PADDOCKS[first].id, name: PADDOCKS[first].name, duration: daysPerRotation }],
        totalDays: daysPerRotation,
      });
    }
  } else {
    // 2 moves ahead: try every combination
    for (const first of otherPaddocks) {
      const secondOptions = PADDOCK_KEYS.filter(k => k !== first);
      for (const second of secondOptions) {
        candidates.push({
          moves: [
            { paddockId: first, numericId: PADDOCKS[first].id, name: PADDOCKS[first].name, duration: daysPerRotation },
            { paddockId: second, numericId: PADDOCKS[second].id, name: PADDOCKS[second].name, duration: daysPerRotation },
          ],
          totalDays: daysPerRotation * 2,
        });
      }
    }
  }

  return candidates;
}

/**
 * Build a current_paddock time series array from a candidate sequence.
 *
 * @param {Object} candidate - From generateCandidates()
 * @param {number} totalDays - Total simulation days
 * @returns {number[]} Paddock IDs for each day
 */
function candidateToSchedule(candidate, totalDays) {
  const schedule = [];
  let day = 0;

  for (const move of candidate.moves) {
    for (let d = 0; d < move.duration && day < totalDays; d++) {
      schedule.push(move.numericId);
      day++;
    }
  }

  // Fill remaining days with last paddock
  const lastId = candidate.moves[candidate.moves.length - 1].numericId;
  while (schedule.length < totalDays) {
    schedule.push(lastId);
  }

  return schedule;
}

/**
 * Simulate a candidate rotation sequence.
 *
 * Clones the model, sets initial conditions from estimated state,
 * builds the rotation schedule, and runs the full engine.
 *
 * @param {Object} candidate - From generateCandidates()
 * @param {Object} initialState - From extractFinalState() { stockName: value }
 * @param {Object} model - Loaded model definition
 * @param {Object} timeSeriesParams - Weather/lifecycle params (without current_paddock)
 * @returns {Object} Simulation results
 */
export function simulateCandidate(candidate, initialState, model, timeSeriesParams) {
  // Clone model and set initial conditions from current state estimate
  const simModel = JSON.parse(JSON.stringify(model));
  for (const [stockName, value] of Object.entries(initialState)) {
    if (simModel.stocks[stockName]) {
      if (typeof simModel.stocks[stockName] === 'number') {
        simModel.stocks[stockName] = value;
      } else {
        simModel.stocks[stockName].initial = value;
      }
    }
  }

  // Build rotation schedule from candidate
  const steps = candidate.totalDays;
  const paddockSchedule = candidateToSchedule(candidate, steps);

  // Merge params: weather time series + rotation schedule
  const params = {
    ...timeSeriesParams,
    current_paddock: paddockSchedule,
  };

  // Trim all time series arrays to match steps
  for (const [key, arr] of Object.entries(params)) {
    if (Array.isArray(arr) && arr.length > steps) {
      params[key] = arr.slice(0, steps);
    }
  }

  return simulate(simModel, { steps, dt: 1, timeSeriesParams: params });
}

/**
 * Score a simulation result.
 *
 * Scoring formula (lexicographic):
 *   score = -10000 * hayDays + 10 * minEndForage + 1 * totalEndForage
 *
 * This ensures:
 * - Any hay-free path beats any hay-required path
 * - Among equal hay outcomes, resilience (worst-paddock health) wins
 * - Tiebreaker: overall forage productivity
 *
 * @param {Object} results - From simulate()
 * @param {Object} candidate - The candidate that was simulated
 * @returns {Object} { score, metrics }
 */
export function scoreSimulation(results, candidate) {
  const lastIdx = results.time.length - 1;
  const steps = results.time.length;

  // Count days where the grazed paddock is below critical threshold
  let hayDays = 0;
  for (let step = 0; step < steps; step++) {
    // Which paddock is being grazed this day?
    const moveIdx = candidate.moves.findIndex((m, i) => {
      const startDay = candidate.moves.slice(0, i).reduce((sum, mv) => sum + mv.duration, 0);
      return step >= startDay && step < startDay + m.duration;
    });
    if (moveIdx === -1) continue;

    const grazedKey = candidate.moves[moveIdx].paddockId;
    const forageKey = `${grazedKey}_forage`;
    const forage = results.stocks[forageKey]?.[step];
    if (forage !== undefined && forage < FORAGE_THRESHOLDS.critical) {
      hayDays++;
    }
  }

  // End-state forage for all paddocks
  const endForages = {};
  for (const key of PADDOCK_KEYS) {
    const values = results.stocks[`${key}_forage`];
    endForages[key] = values ? values[lastIdx] : 0;
  }

  const forageValues = Object.values(endForages);
  const minEndForage = Math.min(...forageValues);
  const totalEndForage = forageValues.reduce((sum, f) => sum + f, 0);

  // Weighted score
  const score = -10000 * hayDays + 10 * minEndForage + totalEndForage;

  return {
    score,
    metrics: {
      hayDays,
      minEndForage: Math.round(minEndForage),
      totalEndForage: Math.round(totalEndForage),
      perPaddock: endForages,
    },
  };
}

/**
 * Run full rotation optimization.
 *
 * Generates all candidate sequences, simulates each with the full engine
 * using weather forecast data, scores, and returns ranked results.
 *
 * @param {Object} options - Configuration
 * @param {Object} options.initialState - Current stock values from estimateCurrentState()
 * @param {string} options.currentPaddock - Current paddock ID (e.g., "big")
 * @param {number} options.forecastDays - Forecast period (default: 28 = 2 rotations)
 * @param {number} options.movesAhead - Rotations to explore (default: 2)
 * @param {number} options.daysPerRotation - Days per rotation (default: 14)
 * @param {Object} options.plantingSchedule - Planting dates for lifecycle calculation
 * @returns {Promise<Object>} { ranked: [...], bestMove, candidateCount, elapsed }
 */
export async function optimizeRotation(options = {}) {
  const {
    initialState,
    currentPaddock,
    forecastDays,
    movesAhead = 2,
    daysPerRotation = 14,
    plantingSchedule,
  } = options;

  const startTime = Date.now();

  // Load model
  const model = await loadModel('grazing-rotation-annual-v2');

  // Load weather and build time series for forecast period
  const weatherArchive = await loadWeatherArchive();
  const todayStr = new Date().toISOString().split('T')[0];

  // We need enough time series data for the longest candidate
  const maxDays = movesAhead * daysPerRotation;
  const timeSeriesParams = buildWeatherTimeSeries(
    weatherArchive, todayStr, maxDays, plantingSchedule
  );

  // Generate all candidates
  const candidates = generateCandidates(currentPaddock, { movesAhead, daysPerRotation });

  // Simulate and score each candidate
  const results = [];
  for (const candidate of candidates) {
    const simResults = simulateCandidate(candidate, initialState, model, timeSeriesParams);
    const score = scoreSimulation(simResults, candidate);
    results.push({ candidate, score, results: simResults });
  }

  // Sort by score descending (higher is better)
  results.sort((a, b) => b.score.score - a.score.score);

  // Assign ranks
  results.forEach((r, i) => { r.rank = i + 1; });

  return {
    ranked: results,
    bestMove: results[0]?.candidate.moves[0]?.paddockId || null,
    candidateCount: candidates.length,
    elapsed: Date.now() - startTime,
  };
}
