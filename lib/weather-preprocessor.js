/**
 * lib/weather-preprocessor.js
 *
 * Pre-compute weather-driven growth multipliers from historical or forecast data.
 * These become time series parameters passed to the simulation engine.
 *
 * WHY: Weather is exogenous (external) - you can't change it during simulation.
 * Pre-computing weather multipliers is efficient and realistic.
 *
 * Dynamic factors (moisture, SOM, lifecycle) are still calculated during simulation
 * to preserve feedback loops.
 */

import {
  getCoolSeasonTempMultiplier,
  getWarmSeasonTempMultiplier,
} from './annual-forage.js';

/**
 * Process weather data into growth multiplier time series
 *
 * @param {Object} weatherData - Raw weather data from Open-Meteo format
 * @param {Object} options - Processing options
 * @returns {Object} Time series arrays for simulation
 */
export function preprocessWeather(weatherData, options = {}) {
  const {
    startDate = null,
    endDate = null,
    includeRawData = false,
  } = options;

  const { daily } = weatherData;
  const results = {
    dates: [],
    cool_temp_mult: [],
    warm_temp_mult: [],
    precip: [],
    et: [],
    temp_avg: [],
    temp_max: [],
    temp_min: [],
  };

  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);

    // Filter by date range if specified
    if (startDate && date < new Date(startDate)) continue;
    if (endDate && date > new Date(endDate)) continue;

    const tempMax = daily.temperature_2m_max[i];
    const tempMin = daily.temperature_2m_min[i];
    const precip = daily.precipitation_sum[i];
    const et = daily.et0_fao_evapotranspiration[i];

    // Calculate temperature-based growth multipliers
    const coolTempMult = getCoolSeasonTempMultiplier(tempMax, tempMin);
    const warmTempMult = getWarmSeasonTempMultiplier(tempMax, tempMin);

    results.dates.push(daily.time[i]);
    results.cool_temp_mult.push(coolTempMult);
    results.warm_temp_mult.push(warmTempMult);
    results.precip.push(precip);
    results.et.push(et);
    results.temp_avg.push((tempMax + tempMin) / 2);

    if (includeRawData) {
      results.temp_max.push(tempMax);
      results.temp_min.push(tempMin);
    }
  }

  return results;
}

/**
 * Calculate rolling sums for precipitation and ET
 * Used for moisture stress calculations
 *
 * @param {Array} values - Array of daily values
 * @param {number} window - Rolling window size (days)
 * @returns {Array} Rolling sums
 */
export function calculateRollingSums(values, window = 14) {
  const sums = [];

  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const sum = slice.reduce((acc, val) => acc + val, 0);
    sums.push(sum);
  }

  return sums;
}

/**
 * Generate moisture stress time series based on precip and ET
 *
 * @param {Array} precip - Daily precipitation (mm)
 * @param {Array} et - Daily ET (mm)
 * @param {number} window - Rolling window for water balance (days)
 * @returns {Array} Moisture stress multipliers (0.0 to 1.0)
 */
export function calculateMoistureStress(precip, et, window = 14) {
  const precipSums = calculateRollingSums(precip, window);
  const etSums = calculateRollingSums(et, window);

  return precipSums.map((p, i) => {
    const waterBalance = p - etSums[i];

    // Moisture stress thresholds
    if (waterBalance >= 30) return 1.0;   // No stress
    if (waterBalance >= 10) return 0.7 + 0.3 * ((waterBalance - 10) / 20);
    if (waterBalance >= -10) return 0.4 + 0.3 * ((waterBalance + 10) / 20);
    if (waterBalance >= -30) return 0.2 + 0.2 * ((waterBalance + 30) / 20);
    return 0.1;  // Severe drought
  });
}

/**
 * Prepare complete time series for simulation
 * Combines weather data with calculated multipliers
 *
 * @param {Object} weatherData - Raw weather data
 * @param {Object} options - Processing options
 * @returns {Object} Complete time series for simulation
 */
export function prepareTimeSeriesForSimulation(weatherData, options = {}) {
  const processed = preprocessWeather(weatherData, options);

  // Calculate moisture stress from weather
  const moistureStress = calculateMoistureStress(
    processed.precip,
    processed.et,
    14
  );

  // Add rolling sums for reference
  const precip14day = calculateRollingSums(processed.precip, 14);
  const et14day = calculateRollingSums(processed.et, 14);

  return {
    ...processed,
    moisture_stress: moistureStress,
    precip_14day: precip14day,
    et_14day: et14day,
    steps: processed.dates.length,
  };
}

/**
 * Get planting date index for a given paddock
 *
 * @param {string} plantDate - ISO date string (e.g., "2025-10-31")
 * @param {Array} dates - Array of date strings from weather data
 * @returns {number} Index of planting date in time series
 */
export function getPlantingIndex(plantDate, dates) {
  const plantDateObj = new Date(plantDate);

  for (let i = 0; i < dates.length; i++) {
    const dateObj = new Date(dates[i]);
    if (dateObj >= plantDateObj) {
      return i;
    }
  }

  return 0; // Default to start if not found
}

/**
 * Generate lifecycle multipliers for cool-season crops
 * Based on days since planting
 *
 * @param {number} plantIndex - Index where planting occurred
 * @param {number} totalSteps - Total simulation steps
 * @returns {Array} Lifecycle multipliers
 */
export function generateCoolSeasonLifecycle(plantIndex, totalSteps) {
  const multipliers = [];

  for (let step = 0; step < totalSteps; step++) {
    const daysSincePlant = step - plantIndex;

    if (daysSincePlant < 0) {
      // Before planting
      multipliers.push(0.0);
    } else if (daysSincePlant < 14) {
      // Germination
      multipliers.push(0.0);
    } else if (daysSincePlant < 42) {
      // Establishment: 0 → 0.5
      const progress = (daysSincePlant - 14) / 28;
      multipliers.push(0.5 * progress);
    } else if (daysSincePlant < 72) {
      // Ramp to peak: 0.5 → 1.0
      const progress = (daysSincePlant - 42) / 30;
      multipliers.push(0.5 + 0.5 * progress);
    } else if (daysSincePlant < 163) {
      // Peak production
      multipliers.push(1.0);
    } else if (daysSincePlant < 193) {
      // Heat decline: 1.0 → 0.0
      const progress = (daysSincePlant - 163) / 30;
      multipliers.push(1.0 - progress);
    } else {
      // Heat death
      multipliers.push(0.0);
    }
  }

  return multipliers;
}

/**
 * Generate lifecycle multipliers for warm-season crops
 *
 * @param {number} plantIndex - Index where planting occurred
 * @param {number} totalSteps - Total simulation steps
 * @returns {Array} Lifecycle multipliers
 */
export function generateWarmSeasonLifecycle(plantIndex, totalSteps) {
  const multipliers = [];

  for (let step = 0; step < totalSteps; step++) {
    const daysSincePlant = step - plantIndex;

    if (daysSincePlant < 0) {
      // Before planting
      multipliers.push(0.0);
    } else if (daysSincePlant < 10) {
      // Germination
      multipliers.push(0.0);
    } else if (daysSincePlant < 40) {
      // Establishment: 0 → 0.7
      const progress = (daysSincePlant - 10) / 30;
      multipliers.push(0.7 * progress);
    } else if (daysSincePlant < 55) {
      // Ramp to peak: 0.7 → 1.0
      const progress = (daysSincePlant - 40) / 15;
      multipliers.push(0.7 + 0.3 * progress);
    } else {
      // Peak production (can be grazed multiple times)
      multipliers.push(1.0);
    }
  }

  return multipliers;
}
