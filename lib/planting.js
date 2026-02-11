/**
 * lib/planting.js
 *
 * Planting recommendation engine for annual forage rotation system.
 *
 * Analyzes historical weather data to identify optimal planting windows,
 * compares planting date scenarios, and identifies transition gaps between
 * cool-season and warm-season forages.
 *
 * SOIL TEMP PROXY: Real soil temp sensors aren't available, so we estimate
 * soil temperature from air temperature using a 4-day lag with 60% damping
 * around the 63°F annual mean for North Texas. This is adequate for the
 * "soil >60°F" warm-season planting threshold.
 */

import { loadWeatherArchive } from './forecast.js';
import { loadPlantingSchedule, getPlantingDate } from './state-estimator.js';
import { generateCoolSeasonLifecycle, generateWarmSeasonLifecycle } from './weather-preprocessor.js';
import { getCoolSeasonTempMultiplier, getWarmSeasonTempMultiplier, COOL_SEASON, WARM_SEASON } from './annual-forage.js';
import { PADDOCK_KEYS, PADDOCKS } from './config.js';

// ============================================================
// SOIL TEMPERATURE PROXY
// ============================================================

const ANNUAL_MEAN_TEMP = 63; // °F for Collinsville, TX
const SOIL_DAMPING = 0.6;     // 60% of air temp deviation reaches soil
const SOIL_LAG_DAYS = 4;       // 4-day thermal lag

/**
 * Estimate soil temperature from air temperature history.
 *
 * Uses a simple thermal lag model: soil responds to air temp
 * with a 4-day delay and only 60% of the deviation from the
 * annual mean temperature reaches the soil.
 *
 * @param {number[]} airTempAvg - Array of daily average air temps (°F)
 * @returns {number[]} Estimated soil temperatures (°F)
 */
export function estimateSoilTemp(airTempAvg) {
  return airTempAvg.map((_, i) => {
    const laggedIdx = Math.max(0, i - SOIL_LAG_DAYS);
    const laggedTemp = airTempAvg[laggedIdx];
    return ANNUAL_MEAN_TEMP + SOIL_DAMPING * (laggedTemp - ANNUAL_MEAN_TEMP);
  });
}

// ============================================================
// HISTORICAL WINDOW ANALYSIS
// ============================================================

/**
 * Group weather archive data by year for multi-year analysis.
 *
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @returns {Map<number, Object>} Year → { dates, tempMax, tempMin, tempAvg, precip, et }
 */
function groupByYear(weatherArchive) {
  const years = new Map();
  const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, et0_fao_evapotranspiration } = weatherArchive.all;

  for (let i = 0; i < time.length; i++) {
    const year = parseInt(time[i].slice(0, 4));
    if (!years.has(year)) {
      years.set(year, { dates: [], tempMax: [], tempMin: [], tempAvg: [], precip: [], et: [] });
    }
    const y = years.get(year);
    y.dates.push(time[i]);
    y.tempMax.push(temperature_2m_max[i]);
    y.tempMin.push(temperature_2m_min[i]);
    y.tempAvg.push((temperature_2m_max[i] + temperature_2m_min[i]) / 2);
    y.precip.push(precipitation_sum[i]);
    y.et.push(et0_fao_evapotranspiration[i]);
  }

  return years;
}

/**
 * Calculate 7-day rolling average of an array.
 */
function rolling7DayAvg(values) {
  return values.map((_, i) => {
    const start = Math.max(0, i - 6);
    const window = values.slice(start, i + 1);
    return window.reduce((a, b) => a + b, 0) / window.length;
  });
}

/**
 * Analyze cool-season planting windows from historical weather.
 *
 * For each year with Oct-Nov data, finds:
 * - Date when 7-day avg temp drops below 70°F (ideal for rye/clover germination)
 * - Precipitation totals in Oct 15 – Nov 15 window
 * - First frost date (temp < 32°F)
 *
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @returns {Object} { yearResults, averages }
 */
export function analyzeCoolSeasonWindow(weatherArchive) {
  const years = groupByYear(weatherArchive);
  const yearResults = [];

  for (const [year, data] of years) {
    // Need Oct-Nov data for this year
    const octStart = data.dates.findIndex(d => d >= `${year}-10-01`);
    const novEnd = data.dates.findIndex(d => d > `${year}-11-30`);
    if (octStart === -1) continue;
    const endIdx = novEnd === -1 ? data.dates.length : novEnd;

    // 7-day rolling avg temp
    const rollingAvg = rolling7DayAvg(data.tempAvg);

    // Find date when 7-day avg drops below 70°F in Oct-Nov
    let cooldownDate = null;
    for (let i = octStart; i < endIdx; i++) {
      if (rollingAvg[i] < 70) {
        cooldownDate = data.dates[i];
        break;
      }
    }

    // Precipitation in Oct 15 - Nov 15 window
    let windowPrecip = 0;
    const windowStart = data.dates.findIndex(d => d >= `${year}-10-15`);
    const windowEnd = data.dates.findIndex(d => d > `${year}-11-15`);
    if (windowStart !== -1) {
      const wEnd = windowEnd === -1 ? data.dates.length : windowEnd;
      for (let i = windowStart; i < wEnd; i++) {
        windowPrecip += data.precip[i];
      }
    }

    // First frost (min temp < 32°F) after Oct 1
    let firstFrost = null;
    for (let i = octStart; i < data.dates.length; i++) {
      if (data.tempMin[i] < 32) {
        firstFrost = data.dates[i];
        break;
      }
    }

    yearResults.push({
      year,
      cooldownDate,
      windowPrecip: Math.round(windowPrecip * 10) / 10,
      firstFrost,
    });
  }

  // Calculate averages across years
  const validCooldown = yearResults.filter(r => r.cooldownDate);
  const avgCooldownDOY = validCooldown.length > 0
    ? Math.round(validCooldown.reduce((sum, r) => {
        const d = new Date(r.cooldownDate);
        return sum + dayOfYear(d);
      }, 0) / validCooldown.length)
    : null;

  const avgPrecip = yearResults.length > 0
    ? Math.round(yearResults.reduce((sum, r) => sum + r.windowPrecip, 0) / yearResults.length * 10) / 10
    : 0;

  return {
    yearResults,
    averages: {
      cooldownDOY: avgCooldownDOY,
      cooldownDateApprox: avgCooldownDOY ? doyToMonthDay(avgCooldownDOY) : 'N/A',
      windowPrecipMm: avgPrecip,
    },
  };
}

/**
 * Analyze warm-season planting windows from historical weather.
 *
 * For each year with May-Jun data, finds:
 * - Date when estimated soil temp consistently >60°F (3+ days)
 * - Precipitation totals in May-June window
 *
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @returns {Object} { yearResults, averages }
 */
export function analyzeWarmSeasonWindow(weatherArchive) {
  const years = groupByYear(weatherArchive);
  const yearResults = [];

  for (const [year, data] of years) {
    // Need April-June data
    const aprStart = data.dates.findIndex(d => d >= `${year}-04-01`);
    if (aprStart === -1) continue;

    // Estimate soil temps
    const soilTemps = estimateSoilTemp(data.tempAvg);

    // Find first date when soil temp is >60°F for 3+ consecutive days
    let warmEnoughDate = null;
    let consecutiveDays = 0;
    for (let i = aprStart; i < data.dates.length; i++) {
      if (soilTemps[i] > 60) {
        consecutiveDays++;
        if (consecutiveDays >= 3) {
          warmEnoughDate = data.dates[i - 2]; // Start of the 3-day stretch
          break;
        }
      } else {
        consecutiveDays = 0;
      }
    }

    // Precipitation in May-June window
    let windowPrecip = 0;
    const mayStart = data.dates.findIndex(d => d >= `${year}-05-01`);
    const julStart = data.dates.findIndex(d => d >= `${year}-07-01`);
    if (mayStart !== -1) {
      const endIdx = julStart === -1 ? data.dates.length : julStart;
      for (let i = mayStart; i < endIdx; i++) {
        windowPrecip += data.precip[i];
      }
    }

    yearResults.push({
      year,
      soilWarmDate: warmEnoughDate,
      windowPrecip: Math.round(windowPrecip * 10) / 10,
    });
  }

  // Averages
  const validWarm = yearResults.filter(r => r.soilWarmDate);
  const avgWarmDOY = validWarm.length > 0
    ? Math.round(validWarm.reduce((sum, r) => {
        return sum + dayOfYear(new Date(r.soilWarmDate));
      }, 0) / validWarm.length)
    : null;

  const avgPrecip = yearResults.length > 0
    ? Math.round(yearResults.reduce((sum, r) => sum + r.windowPrecip, 0) / yearResults.length * 10) / 10
    : 0;

  return {
    yearResults,
    averages: {
      soilWarmDOY: avgWarmDOY,
      soilWarmDateApprox: avgWarmDOY ? doyToMonthDay(avgWarmDOY) : 'N/A',
      windowPrecipMm: avgPrecip,
    },
  };
}

// ============================================================
// PLANTING SCENARIO PROJECTIONS
// ============================================================

/**
 * Project forage establishment for multiple planting date scenarios.
 *
 * For each candidate planting date, generates lifecycle multipliers and
 * combines with historical temperature multipliers to project:
 * - Days to grazeable (lifecycle > 0.3)
 * - Forage multiplier at weeks 6, 8, 10, 12
 * - Peak production window start
 *
 * @param {string} season - 'cool' or 'warm'
 * @param {string[]} plantingDates - ISO date strings to compare
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @param {number} projectionDays - Days to project forward (default: 120)
 * @returns {Object[]} Scenario results per planting date
 */
export function projectPlantingScenarios(season, plantingDates, weatherArchive, projectionDays = 120) {
  const times = weatherArchive.all.time;
  const tempMax = weatherArchive.all.temperature_2m_max;
  const tempMin = weatherArchive.all.temperature_2m_min;

  const getTempMult = season === 'cool' ? getCoolSeasonTempMultiplier : getWarmSeasonTempMultiplier;
  const getLifecycle = season === 'cool' ? generateCoolSeasonLifecycle : generateWarmSeasonLifecycle;

  return plantingDates.map(plantDate => {
    // Find planting date in archive for weather context
    const plantIdx = times.indexOf(plantDate);

    // Generate lifecycle from day 0 (planting day)
    const lifecycle = getLifecycle(0, projectionDays);

    // Get temperature multipliers for the projection window
    // Use same-year weather if available, otherwise use proxy year
    const tempMults = [];
    for (let d = 0; d < projectionDays; d++) {
      const weatherIdx = plantIdx !== -1 ? plantIdx + d : -1;
      if (weatherIdx >= 0 && weatherIdx < times.length) {
        tempMults.push(getTempMult(tempMax[weatherIdx], tempMin[weatherIdx]));
      } else {
        // Use prior year proxy
        const proxyDate = new Date(plantDate + 'T12:00:00Z');
        proxyDate.setDate(proxyDate.getDate() + d);
        proxyDate.setFullYear(proxyDate.getFullYear() - 1);
        const proxyStr = proxyDate.toISOString().split('T')[0];
        const proxyIdx = times.indexOf(proxyStr);
        if (proxyIdx !== -1) {
          tempMults.push(getTempMult(tempMax[proxyIdx], tempMin[proxyIdx]));
        } else {
          tempMults.push(0.5); // fallback
        }
      }
    }

    // Combined growth multiplier (temp × lifecycle)
    const combined = lifecycle.map((lc, i) => lc * tempMults[i]);

    // Days to grazeable: lifecycle > 0.3 (past germination, into establishment)
    const daysToGrazeable = lifecycle.findIndex(lc => lc >= 0.3);

    // Forage multiplier at key weeks
    const weekMultipliers = {};
    for (const week of [6, 8, 10, 12]) {
      const dayIdx = week * 7;
      weekMultipliers[`week${week}`] = dayIdx < projectionDays
        ? Math.round(combined[dayIdx] * 100) / 100
        : null;
    }

    // Peak production window: first day lifecycle reaches 0.9
    const peakStart = lifecycle.findIndex(lc => lc >= 0.9);
    const peakStartDate = peakStart !== -1
      ? addDays(plantDate, peakStart)
      : null;

    return {
      plantDate,
      daysToGrazeable: daysToGrazeable !== -1 ? daysToGrazeable : null,
      grazeableDate: daysToGrazeable !== -1 ? addDays(plantDate, daysToGrazeable) : null,
      weekMultipliers,
      peakStartDay: peakStart !== -1 ? peakStart : null,
      peakStartDate,
      lifecycle,
      combined,
    };
  });
}

// ============================================================
// TRANSITION GAP ANALYSIS
// ============================================================

/**
 * Analyze the gap between cool-season death and warm-season graze readiness.
 *
 * The transition gap is the period where neither forage is grazeable:
 * - Cool-season heat death: ~163 days from planting + 30-day decline
 * - Warm-season first graze: ~40 days from planting
 *
 * @param {Object} weatherArchive - From loadWeatherArchive()
 * @param {Object} plantingSchedule - From loadPlantingSchedule()
 * @returns {Object} Gap analysis per paddock
 */
export function analyzeTransitionGap(weatherArchive, plantingSchedule) {
  const results = [];

  for (const key of PADDOCK_KEYS) {
    const coolPlantDate = getPlantingDate(plantingSchedule, key, 'cool_season');
    const warmPlantDate = getPlantingDate(plantingSchedule, key, 'warm_season');

    if (!coolPlantDate) {
      results.push({ paddock: key, name: PADDOCKS[key].name, error: 'No cool-season planting date' });
      continue;
    }

    // Cool-season decline starts at day 163, death by day 193
    const coolDeclineStart = addDays(coolPlantDate, COOL_SEASON.lifecycle.decline_start);
    const coolDeath = addDays(coolPlantDate, COOL_SEASON.lifecycle.decline_start + 30);

    // Warm-season first graze at day 40
    const warmGrazeReady = warmPlantDate
      ? addDays(warmPlantDate, WARM_SEASON.lifecycle.first_graze)
      : null;

    // Gap = time between cool death and warm graze readiness
    let gapDays = null;
    if (warmGrazeReady && coolDeath) {
      const coolDeathDate = new Date(coolDeath + 'T12:00:00Z');
      const warmReadyDate = new Date(warmGrazeReady + 'T12:00:00Z');
      gapDays = Math.round((warmReadyDate - coolDeathDate) / (1000 * 60 * 60 * 24));
    }

    results.push({
      paddock: key,
      name: PADDOCKS[key].name,
      coolPlantDate,
      coolDeclineStart,
      coolDeath,
      warmPlantDate: warmPlantDate || 'Not planned',
      warmGrazeReady,
      gapDays,
      gapSeverity: gapDays === null ? 'unknown' :
        gapDays <= 0 ? 'none' :
        gapDays <= 30 ? 'manageable' :
        gapDays <= 60 ? 'significant' : 'critical',
    });
  }

  return results;
}

// ============================================================
// PER-PADDOCK STATUS
// ============================================================

/**
 * Get planting status for each paddock.
 *
 * @param {Object} plantingSchedule - From loadPlantingSchedule()
 * @param {string} season - 'cool_season' or 'warm_season'
 * @returns {Object[]} Per-paddock status
 */
function getPaddockPlantingStatus(plantingSchedule, season) {
  return PADDOCK_KEYS.map(key => {
    const paddockData = plantingSchedule.paddocks[key];
    const plantDate = getPlantingDate(plantingSchedule, key, season);
    const info = paddockData?.[season];
    const latestYear = info ? Object.keys(info).sort().pop() : null;
    const yearData = latestYear ? info[latestYear] : null;

    const isPlanted = !!yearData?.planted;
    const daysSincePlanting = plantDate
      ? Math.floor((new Date() - new Date(plantDate + 'T12:00:00Z')) / (1000 * 60 * 60 * 24))
      : null;

    return {
      paddock: key,
      name: PADDOCKS[key].name,
      plantDate,
      isPlanted,
      isPlanned: !!yearData?.planned,
      daysSincePlanting,
      species: yearData?.species || 'Unknown',
      notes: yearData?.notes || '',
    };
  });
}

// ============================================================
// TOP-LEVEL RECOMMENDATION FUNCTION
// ============================================================

/**
 * Generate comprehensive planting recommendations.
 *
 * @param {Object} options - Configuration
 * @param {string} options.season - 'cool', 'warm', or 'next' (auto-detect)
 * @returns {Promise<Object>} Structured report with window analysis, scenarios, gap analysis
 */
export async function getPlantingRecommendations(options = {}) {
  let { season = 'next' } = options;

  // Auto-detect season
  if (season === 'next') {
    const month = new Date().getMonth() + 1;
    season = month <= 6 ? 'warm' : 'cool';
  }

  const weatherArchive = await loadWeatherArchive();
  const plantingSchedule = await loadPlantingSchedule();

  const seasonKey = season === 'cool' ? 'cool_season' : 'warm_season';

  // Window analysis
  const windowAnalysis = season === 'cool'
    ? analyzeCoolSeasonWindow(weatherArchive)
    : analyzeWarmSeasonWindow(weatherArchive);

  // Candidate planting dates for scenario comparison
  let candidateDates;
  const currentYear = new Date().getFullYear();
  if (season === 'cool') {
    candidateDates = [`${currentYear}-10-20`, `${currentYear}-11-01`, `${currentYear}-11-15`];
  } else {
    candidateDates = [`${currentYear}-05-15`, `${currentYear}-06-01`, `${currentYear}-06-15`];
  }

  // Planting scenario projections
  const scenarios = projectPlantingScenarios(season, candidateDates, weatherArchive);

  // Per-paddock status
  const paddockStatus = getPaddockPlantingStatus(plantingSchedule, seasonKey);

  // Transition gap analysis
  const transitionGap = analyzeTransitionGap(weatherArchive, plantingSchedule);

  return {
    season,
    seasonKey,
    windowAnalysis,
    candidateDates,
    scenarios,
    paddockStatus,
    transitionGap,
  };
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function doyToMonthDay(doy) {
  // Approximate month-day from day-of-year (non-leap year)
  const d = new Date(2025, 0, 1);
  d.setDate(d.getDate() + doy - 1);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
