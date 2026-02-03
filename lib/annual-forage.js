/**
 * lib/annual-forage.js
 *
 * Growth models for annual forage rotation system
 * - Cool-season mix: Rye + clover + cover crops (Oct-May)
 * - Warm-season mix: Sorghum-sudan + pearl millet + cowpeas + summer clover (May-Oct)
 *
 * NO PERENNIAL BERMUDAGRASS - 100% annual rotation system
 */

// ============================================================
// COOL-SEASON MIX (Winter/Spring Forage)
// ============================================================
// Species: Annual ryegrass, cereal rye, clover mix, possibly daikon radish
// Seeded: Late October - November
// Grazeable: 6 weeks after seeding (normal moisture)
// Peak: March - April
// Termination: May - June (heat death above 85°F sustained)
// ============================================================

export const COOL_SEASON = {
  name: 'Winter Mix (Rye + Clover + Covers)',

  // Temperature thresholds (°F)
  temps: {
    dormant: 35,      // Below this: dormant/no growth
    slow: 50,         // 35-50°F: slow growth
    optimal_low: 60,  // 60-75°F: optimal range
    optimal_high: 75,
    stress: 80,       // Above 80°F: heat stress begins
    death: 85,        // Sustained temps above 85°F = death
  },

  // Life cycle timing (days from seeding)
  lifecycle: {
    germination: 14,      // 0-14 days: germinating, not grazeable
    establishment: 42,    // 15-42 days: establishing, 0-50% production
    peak_start: 43,       // 43+ days: peak production
    peak_duration: 120,   // Peak lasts ~4 months (Nov seeding → March peak)
    decline_start: 163,   // ~5.5 months: heat begins to stress plants
  },

  // Growth rate multipliers
  rates: {
    germination: 0.0,     // No forage during germination
    establishment_max: 0.5, // Ramps from 0 to 50% during establishment
    peak: 1.0,            // 100% production at peak
  },
};

// ============================================================
// WARM-SEASON MIX (Summer Forage)
// ============================================================
// Species: Sorghum-sudan, pearl millet, cowpeas, summer clover
// Planted: May - June (soil temp >60°F)
// Grazeable: 35-45 days after planting
// Grazing: 2+ times per season (fast regrowth)
// Termination: October - November (frost <32°F)
// ============================================================

export const WARM_SEASON = {
  name: 'Summer Mix (Sorghum-sudan + Pearl Millet + Cowpeas + Clover)',

  // Temperature thresholds (°F)
  temps: {
    dormant: 50,      // Below 50°F: no growth
    slow: 65,         // 50-65°F: slow growth
    optimal_low: 75,  // 75-95°F: optimal (these LOVE heat!)
    optimal_high: 95,
    peak: 90,         // 85-90°F: absolute peak for sorghum-sudan
    stress: 100,      // >100°F: even warm-season crops stress
    frost: 32,        // <32°F: frost kill
  },

  // Life cycle timing (days from planting)
  lifecycle: {
    germination: 10,       // 0-10 days: germinating
    establishment: 40,     // 11-40 days: establishing, rapid growth
    first_graze: 40,       // Ready for first grazing at day 40
    regrowth_period: 35,   // ~5 weeks between grazings
    peak_duration: 90,     // Peak production for ~3 months
  },

  // Growth rate multipliers
  rates: {
    germination: 0.0,
    establishment_max: 0.7,  // Ramps to 70% by first grazing
    peak: 1.0,               // 100% at peak
    regrowth_rate: 1.2,      // Sorghum-sudan regrows FASTER after cutting (tillers)
  },
};

// ============================================================
// TEMPERATURE RESPONSE FUNCTIONS
// ============================================================

/**
 * Cool-season temperature growth multiplier
 * @param {number} tempMaxF - Daily high (°F)
 * @param {number} tempMinF - Daily low (°F)
 * @returns {number} Growth multiplier (0.0 to 1.0)
 */
export function getCoolSeasonTempMultiplier(tempMaxF, tempMinF) {
  const avgTemp = (tempMaxF + tempMinF) / 2;
  const t = COOL_SEASON.temps;

  if (avgTemp < t.dormant) {
    return 0.0;  // Dormant below 35°F
  }
  if (avgTemp < t.slow) {
    // Slow growth 35-50°F: ramp from 0 to 0.3
    return 0.3 * (avgTemp - t.dormant) / (t.slow - t.dormant);
  }
  if (avgTemp < t.optimal_low) {
    // Accelerating 50-60°F: ramp from 0.3 to 0.7
    return 0.3 + 0.4 * (avgTemp - t.slow) / (t.optimal_low - t.slow);
  }
  if (avgTemp <= t.optimal_high) {
    // Optimal 60-75°F: ramp from 0.7 to 1.0
    return 0.7 + 0.3 * (avgTemp - t.optimal_low) / (t.optimal_high - t.optimal_low);
  }
  if (avgTemp <= t.stress) {
    // Heat stress beginning 75-80°F: drop from 1.0 to 0.6
    return 1.0 - 0.4 * (avgTemp - t.optimal_high) / (t.stress - t.optimal_high);
  }
  if (avgTemp <= t.death) {
    // Severe stress 80-85°F: drop from 0.6 to 0.1
    return 0.6 - 0.5 * (avgTemp - t.stress) / (t.death - t.stress);
  }
  // Above 85°F sustained: plant is dying
  return 0.05;
}

/**
 * Warm-season temperature growth multiplier
 * @param {number} tempMaxF - Daily high (°F)
 * @param {number} tempMinF - Daily low (°F)
 * @returns {number} Growth multiplier (0.0 to 1.0)
 */
export function getWarmSeasonTempMultiplier(tempMaxF, tempMinF) {
  const avgTemp = (tempMaxF + tempMinF) / 2;
  const t = WARM_SEASON.temps;

  if (avgTemp < t.dormant) {
    return 0.0;  // No growth below 50°F
  }
  if (avgTemp < t.slow) {
    // Slow start 50-65°F: ramp from 0 to 0.4
    return 0.4 * (avgTemp - t.dormant) / (t.slow - t.dormant);
  }
  if (avgTemp < t.optimal_low) {
    // Accelerating 65-75°F: ramp from 0.4 to 0.7
    return 0.4 + 0.3 * (avgTemp - t.slow) / (t.optimal_low - t.slow);
  }
  if (avgTemp < t.peak) {
    // Strong growth 75-90°F: ramp from 0.7 to 1.0
    return 0.7 + 0.3 * (avgTemp - t.optimal_low) / (t.peak - t.optimal_low);
  }
  if (avgTemp <= t.optimal_high) {
    // Peak zone 90-95°F: hold at 1.0
    return 1.0;
  }
  if (avgTemp <= t.stress) {
    // Still good 95-100°F: slight decline from 1.0 to 0.8
    return 1.0 - 0.2 * (avgTemp - t.optimal_high) / (t.stress - t.optimal_high);
  }
  // Extreme heat >100°F: drops to 0.5
  return 0.5;
}

// ============================================================
// LIFE CYCLE STAGE FUNCTIONS
// ============================================================

/**
 * Cool-season life cycle multiplier
 * Models: germination → establishment → peak → heat decline
 *
 * @param {number} daysSincePlanting - Days since seeding
 * @param {number} avgTemp - Average daily temp (for heat death check)
 * @returns {number} Life stage multiplier (0.0 to 1.0)
 */
export function getCoolSeasonLifeCycle(daysSincePlanting, avgTemp) {
  const lc = COOL_SEASON.lifecycle;
  const rates = COOL_SEASON.rates;

  // Germination phase: no forage
  if (daysSincePlanting < lc.germination) {
    return rates.germination;
  }

  // Establishment phase: linear ramp from 0 to 50%
  if (daysSincePlanting < lc.establishment) {
    const progress = (daysSincePlanting - lc.germination) /
                     (lc.establishment - lc.germination);
    return progress * rates.establishment_max;
  }

  // Peak phase: 50% → 100% over first 30 days of peak, then hold
  if (daysSincePlanting < lc.peak_start + 30) {
    const progress = (daysSincePlanting - lc.establishment) / 30;
    return rates.establishment_max + progress * (rates.peak - rates.establishment_max);
  }

  // Full peak production
  if (daysSincePlanting < lc.decline_start) {
    return rates.peak;
  }

  // Heat-induced decline: sustained high temps kill the plants
  // Linear decline over 30 days as heat stress accumulates
  const declineDays = daysSincePlanting - lc.decline_start;
  const declineRate = Math.max(0, 1.0 - (declineDays / 30));

  // Accelerate decline if temps consistently above death threshold
  if (avgTemp > COOL_SEASON.temps.death) {
    return declineRate * 0.5;  // Rapid death
  }

  return declineRate;
}

/**
 * Warm-season life cycle multiplier
 * Models: germination → establishment → peak → regrowth cycles
 *
 * @param {number} daysSincePlanting - Days since planting
 * @param {number} daysSinceLastGraze - Days since last grazing (for regrowth)
 * @returns {number} Life stage multiplier (0.0 to 1.0)
 */
export function getWarmSeasonLifeCycle(daysSincePlanting, daysSinceLastGraze = null) {
  const lc = WARM_SEASON.lifecycle;
  const rates = WARM_SEASON.rates;

  // If we're tracking regrowth (after first grazing)
  if (daysSinceLastGraze !== null && daysSinceLastGraze < lc.regrowth_period) {
    // Fast regrowth: sorghum-sudan tillers aggressively
    const progress = daysSinceLastGraze / lc.regrowth_period;
    return progress * rates.regrowth_rate;  // Can exceed 1.0 during regrowth!
  }

  // Initial growth cycle
  if (daysSincePlanting < lc.germination) {
    return rates.germination;  // 0.0 during germination
  }

  if (daysSincePlanting < lc.establishment) {
    // Rapid establishment: 0 → 70% over 30 days
    const progress = (daysSincePlanting - lc.germination) /
                     (lc.establishment - lc.germination);
    return progress * rates.establishment_max;
  }

  // Peak production: ramp from 70% to 100% over 15 days, then hold
  if (daysSincePlanting < lc.first_graze + 15) {
    const progress = (daysSincePlanting - lc.establishment) / 15;
    return rates.establishment_max + progress * (rates.peak - rates.establishment_max);
  }

  // Full peak
  return rates.peak;
}

// ============================================================
// MOISTURE STRESS FACTOR
// ============================================================

/**
 * Simple moisture stress multiplier based on recent rainfall
 *
 * In drought conditions (54-day drought in Dec-Jan 2025-26), winter forage
 * establishment was severely impaired. This function reduces growth when
 * precipitation is inadequate.
 *
 * @param {number} recentPrecip - Sum of precipitation over last 14 days (mm)
 * @param {number} recentET - Sum of ET over last 14 days (mm)
 * @returns {number} Moisture stress multiplier (0.0 to 1.0)
 */
export function getMoistureStress(recentPrecip, recentET) {
  // Water balance: precip - ET
  const waterBalance = recentPrecip - recentET;

  // Cool-season crops need ~20-30mm per 2 weeks to thrive
  // Warm-season crops need more: ~40-50mm per 2 weeks
  // For simplicity, use 30mm as baseline

  if (waterBalance >= 30) {
    return 1.0;  // No stress, adequate moisture
  }
  if (waterBalance >= 10) {
    // Moderate stress: linear from 10mm to 30mm
    return 0.7 + 0.3 * ((waterBalance - 10) / 20);
  }
  if (waterBalance >= -10) {
    // Significant stress: 10mm to -10mm
    return 0.4 + 0.3 * ((waterBalance + 10) / 20);
  }
  if (waterBalance >= -30) {
    // Severe drought: -10mm to -30mm
    return 0.2 + 0.2 * ((waterBalance + 30) / 20);
  }
  // Extreme drought: <-30mm balance
  return 0.1;
}

// ============================================================
// COMBINED GROWTH FUNCTION
// ============================================================

/**
 * Calculate total forage growth for a given day
 * Determines which season's mix is active and returns growth rate
 *
 * @param {Object} params - Growth parameters
 * @param {Date} date - Current date
 * @param {number} tempMaxF - Daily high temp
 * @param {number} tempMinF - Daily low temp
 * @param {number} recentPrecip - Precip last 14 days (mm)
 * @param {number} recentET - ET last 14 days (mm)
 * @param {Date} coolSeasonPlantDate - When winter mix was seeded
 * @param {Date} warmSeasonPlantDate - When summer mix was planted
 * @param {Date} lastGrazeDate - Last grazing date (for regrowth)
 * @returns {number} Growth multiplier (0.0 to 1.2+)
 */
export function getAnnualForageGrowth(params) {
  const {
    date,
    tempMaxF,
    tempMinF,
    recentPrecip,
    recentET,
    coolSeasonPlantDate,
    warmSeasonPlantDate,
    lastGrazeDate,
  } = params;

  const avgTemp = (tempMaxF + tempMinF) / 2;
  const moistureStress = getMoistureStress(recentPrecip, recentET);

  // Determine which season is active
  const month = date.getMonth() + 1; // 1-12

  // Cool season is active Oct-May (months 10, 11, 12, 1, 2, 3, 4, 5)
  const isCoolSeason = month >= 10 || month <= 5;

  if (isCoolSeason && coolSeasonPlantDate) {
    const daysSincePlanting = Math.floor((date - coolSeasonPlantDate) / (1000 * 60 * 60 * 24));

    const tempMult = getCoolSeasonTempMultiplier(tempMaxF, tempMinF);
    const lifecycleMult = getCoolSeasonLifeCycle(daysSincePlanting, avgTemp);

    return tempMult * lifecycleMult * moistureStress;
  }

  // Warm season is active May-Oct (months 5, 6, 7, 8, 9, 10)
  if (!isCoolSeason && warmSeasonPlantDate) {
    const daysSincePlanting = Math.floor((date - warmSeasonPlantDate) / (1000 * 60 * 60 * 24));

    let daysSinceGraze = null;
    if (lastGrazeDate && lastGrazeDate > warmSeasonPlantDate) {
      daysSinceGraze = Math.floor((date - lastGrazeDate) / (1000 * 60 * 60 * 24));
    }

    const tempMult = getWarmSeasonTempMultiplier(tempMaxF, tempMinF);
    const lifecycleMult = getWarmSeasonLifeCycle(daysSincePlanting, daysSinceGraze);

    return tempMult * lifecycleMult * moistureStress;
  }

  // Transition period or no planting date available
  return 0.0;
}
