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
import { loadRotationHistory } from './rotation.js';

// Default rotation cycle: paddock order with duration based on acreage.
// Hog (5 acres) gets a shorter rotation; all others are 14 days.
const DEFAULT_ROTATION_CYCLE = [
  { key: 'ccw', days: 14 },
  { key: 'big', days: 14 },
  { key: 'hog', days: 5 },
  { key: 'cce', days: 14 },
];

/**
 * Build a forward rotation schedule (paddock IDs per day).
 *
 * Starts with `remainingDays` on `startPaddock`, then cycles through
 * the default rotation order, skipping any excluded paddocks.
 *
 * @param {Object} options - Schedule configuration
 * @param {string} options.startPaddock - Key of paddock herd starts on
 * @param {number} options.remainingDays - Days remaining on startPaddock (default: 0)
 * @param {number} options.totalDays - Total schedule length
 * @param {string[]} options.excludePaddocks - Keys to exclude from cycle (default: [])
 * @returns {number[]} Paddock numeric IDs for each day
 */
export function buildRotationSchedule({ startPaddock, remainingDays = 0, totalDays, excludePaddocks = [] }) {
  const schedule = [];
  const excludeSet = new Set(excludePaddocks);

  // Days remaining on start paddock
  if (remainingDays > 0) {
    const startId = PADDOCKS[startPaddock]?.id || PADDOCKS.big.id;
    for (let i = 0; i < remainingDays && schedule.length < totalDays; i++) {
      schedule.push(startId);
    }
  }

  // Build filtered cycle (exclude specified paddocks)
  const cycle = DEFAULT_ROTATION_CYCLE.filter(m => !excludeSet.has(m.key));

  if (cycle.length === 0) {
    // No paddocks available — stay on start
    const fallbackId = PADDOCKS[startPaddock]?.id || PADDOCKS.big.id;
    while (schedule.length < totalDays) schedule.push(fallbackId);
    return schedule;
  }

  // Cycle through available paddocks
  let cycleIdx = 0;
  while (schedule.length < totalDays) {
    const move = cycle[cycleIdx % cycle.length];
    const paddockId = PADDOCKS[move.key].id;
    for (let d = 0; d < move.days && schedule.length < totalDays; d++) {
      schedule.push(paddockId);
    }
    cycleIdx++;
  }

  return schedule;
}

/**
 * Generate all candidate rotation sequences.
 *
 * @param {string} currentPaddock - Current paddock ID (e.g., "big")
 * @param {Object} options - Configuration
 * @param {number} options.movesAhead - Rotations to look ahead (default: 2)
 * @param {number} options.daysPerRotation - Days per rotation (default: 14)
 * @param {string[]} options.excludeFromFirst - Paddock IDs to exclude from first move (cooldown)
 * @returns {Array<Object>} Candidates: { moves: [...], totalDays }
 */
export function generateCandidates(currentPaddock, options = {}) {
  const { movesAhead = 2, daysPerRotation = 14, excludeFromFirst = [] } = options;

  const excludeSet = new Set([currentPaddock, ...excludeFromFirst]);
  const firstMovePaddocks = PADDOCK_KEYS.filter(k => !excludeSet.has(k));
  const candidates = [];

  if (movesAhead === 1) {
    for (const first of firstMovePaddocks) {
      candidates.push({
        moves: [{ paddockId: first, numericId: PADDOCKS[first].id, name: PADDOCKS[first].name, duration: daysPerRotation }],
        totalDays: daysPerRotation,
      });
    }
  } else {
    // 2 moves ahead: try every combination
    for (const first of firstMovePaddocks) {
      // Second move can go anywhere except where we just moved to
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
 * Calculate days since each paddock was last grazed.
 * Used for cooldown filtering — don't send herd back too soon.
 *
 * @param {Object} rotationHistory - From loadRotationHistory()
 * @returns {Object} { paddockId: daysSince, ... }
 */
export function getDaysSinceGrazed(rotationHistory) {
  const today = new Date();
  const result = {};

  for (const key of PADDOCK_KEYS) {
    // Find most recent rotation for this paddock
    const lastRotation = [...rotationHistory.rotations]
      .reverse()
      .find(r => r.paddock === key);

    if (!lastRotation) {
      result[key] = Infinity;
    } else if (!lastRotation.end) {
      // Currently grazing — 0 days rest
      result[key] = 0;
    } else {
      const endDate = new Date(lastRotation.end + 'T12:00:00Z');
      result[key] = Math.floor((today - endDate) / (1000 * 60 * 60 * 24));
    }
  }

  return result;
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
 *   score = -10000 * hayDays - 5000 * hayConsumptionDays + 10 * minEndForage + totalEndForage
 *
 * Two tiers of hay awareness:
 * - hayDays: grazed paddock below critical threshold (500 kg/ac) — must feed hay
 * - hayConsumptionDays: grazed paddock below low threshold (1000 kg/ac) — should supplement
 *
 * This ensures:
 * - Paths that avoid critical hay dependency are strongly preferred
 * - Among those, paths that avoid moderate supplementation are preferred
 * - Then resilience (worst-paddock health) wins
 * - Tiebreaker: overall forage productivity
 *
 * @param {Object} results - From simulate()
 * @param {Object} candidate - The candidate that was simulated
 * @returns {Object} { score, metrics }
 */
export function scoreSimulation(results, candidate) {
  const lastIdx = results.time.length - 1;
  const steps = results.time.length;

  // Count days where the grazed paddock is below thresholds
  let hayDays = 0;
  let hayConsumptionDays = 0;
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
    if (forage !== undefined) {
      if (forage < FORAGE_THRESHOLDS.critical) {
        hayDays++;
      } else if (forage < FORAGE_THRESHOLDS.low) {
        hayConsumptionDays++;
      }
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

  // Weighted score with two-tier hay awareness
  const score = -10000 * hayDays - 5000 * hayConsumptionDays + 10 * minEndForage + totalEndForage;

  return {
    score,
    metrics: {
      hayDays,
      hayConsumptionDays,
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
 * @param {number} options.minRestDays - Minimum rest days before a paddock can be grazed again (default: 14)
 * @returns {Promise<Object>} { ranked: [...], bestMove, candidateCount, elapsed, cooldownExcluded }
 */
export async function optimizeRotation(options = {}) {
  const {
    initialState,
    currentPaddock,
    forecastDays,
    movesAhead = 2,
    daysPerRotation = 14,
    plantingSchedule,
    minRestDays = 14,
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

  // Apply cooldown: exclude paddocks that haven't rested long enough
  const rotationHistory = await loadRotationHistory();
  const daysSince = getDaysSinceGrazed(rotationHistory);
  const excludeFromFirst = PADDOCK_KEYS.filter(
    k => k !== currentPaddock && daysSince[k] < minRestDays
  );

  // Generate all candidates (with cooldown exclusions)
  const candidates = generateCandidates(currentPaddock, { movesAhead, daysPerRotation, excludeFromFirst });

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
    cooldown: {
      minRestDays,
      excluded: excludeFromFirst,
      daysSinceGrazed: daysSince,
    },
  };
}
