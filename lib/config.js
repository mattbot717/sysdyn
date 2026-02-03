/**
 * lib/config.js
 *
 * Centralized configuration for the sysdyn grazing management system.
 * Single source of truth for all location, paddock, and threshold constants.
 *
 * WHY THIS EXISTS:
 * Before this file, paddock names were hardcoded in 5+ files. When you renamed
 * "South Pasture" to "Frankie's Pasture", you had to update each one manually.
 * Now you change ONE line here.
 */

// ============================================================
// LOCATION - Farm coordinates for weather API
// ============================================================

export const LOCATION = {
  name: 'Collinsville, TX',
  latitude: 33.5723,
  longitude: -96.9507,
};

// ============================================================
// WEATHER API CONFIGURATION
// ============================================================

export const WEATHER_API = {
  baseUrl: 'https://api.open-meteo.com/v1/forecast',
  timezone: 'America/Chicago',
  temperatureUnit: 'fahrenheit',
  defaultET: 1.5,  // Default evapotranspiration (mm/day) when API returns null
  maxPastDays: 92, // API limit
  maxForecastDays: 16,
};

// ============================================================
// PADDOCKS - Master list of all paddocks
// ============================================================

/**
 * Paddock definitions with display names and numeric IDs (for legacy compatibility)
 */
export const PADDOCKS = {
  cce: { id: 1, name: 'Cedar Crest East' },
  ccw: { id: 2, name: 'Cedar Crest West' },
  big: { id: 3, name: 'Big Pasture' },
  hog: { id: 4, name: 'Hog Pasture' },
  south: { id: 5, name: "Frankie's Pasture" },
};

/**
 * Get array of paddock keys for iteration
 */
export const PADDOCK_KEYS = Object.keys(PADDOCKS);

/**
 * Get a map of paddock ID to name for display
 * @returns {Object} Map like { cce: 'Cedar Crest East', ... }
 */
export function getPaddockNamesMap() {
  const map = {};
  for (const [key, paddock] of Object.entries(PADDOCKS)) {
    map[key] = paddock.name;
  }
  return map;
}

/**
 * Get a map of numeric ID to paddock key for legacy compatibility
 * @returns {Object} Map like { 1: 'cce', 2: 'ccw', ... }
 */
export function getNumericIdMap() {
  const map = {};
  for (const [key, paddock] of Object.entries(PADDOCKS)) {
    map[paddock.id] = key;
  }
  return map;
}

// ============================================================
// FORAGE THRESHOLDS - Status levels for grazing decisions
// ============================================================

export const FORAGE_THRESHOLDS = {
  critical: 500,   // Below this: hay feeding REQUIRED
  low: 1000,       // Below this: monitor closely
  marginal: 1500,  // Below this: short grazing periods
  healthy: 2000,   // Above this: ready for full grazing
};

/**
 * Get forage status based on current level
 * @param {number} forage - Current forage in kg/acre
 * @returns {Object} { status, label, cssClass }
 */
export function getForageStatus(forage) {
  if (forage < FORAGE_THRESHOLDS.critical) {
    return { status: 'critical', label: 'Critical - Hay Needed', cssClass: 'badge-critical' };
  }
  if (forage < FORAGE_THRESHOLDS.low) {
    return { status: 'low', label: 'Low - Monitor Closely', cssClass: 'badge-warning' };
  }
  if (forage < FORAGE_THRESHOLDS.marginal) {
    return { status: 'marginal', label: 'Marginal', cssClass: 'badge-warning' };
  }
  return { status: 'healthy', label: 'Healthy', cssClass: 'badge-good' };
}

// ============================================================
// HERD DEFAULTS
// ============================================================

export const HERD_DEFAULTS = {
  averageWeight: 557,  // kg per animal (used in UI calculations)
  defaultCount: 14,    // Default herd size
};

// ============================================================
// VALID EVENT TYPES - For rotation.js logEvent()
// ============================================================

export const VALID_EVENT_TYPES = [
  'drought_start',
  'drought_end',
  'rain',
  'ice_storm',
  'seeding',
  'hay_delivery',
  'vet_visit',
  'fence_repair',
  'other',
];

/**
 * Get emoji icon for event type
 * @param {string} type - Event type
 * @returns {string} Emoji icon
 */
export function getEventIcon(type) {
  const icons = {
    drought_start: '☀️',
    drought_end: '🌧️',
    rain: '💧',
    ice_storm: '🧊',
    seeding: '🌱',
    hay_delivery: '🌾',
    vet_visit: '💉',
    fence_repair: '🔧',
  };
  return icons[type] || '📌';
}

// ============================================================
// DISPLAY COLORS - Consistent UI theming
// ============================================================

export const PADDOCK_COLORS = {
  cce: '#f56565',
  ccw: '#ed8936',
  big: '#ecc94b',
  hog: '#48bb78',
  south: '#4299e1',
};

// ============================================================
// SEASONAL GROWTH MODEL - North Texas (Collinsville area)
// ============================================================
// SOURCES:
// - Missouri Extension G4620: "85% of bermudagrass production occurs May 15 - Sept 15"
//   https://extension.missouri.edu/publications/g4620
// - Texas A&M AgriLife: North Texas greenup late March/April, dormancy below 50°F
//   https://agrilifeextension.tamu.edu/library/landscaping/bermudagrass-home-lawn-management-calendar/
// - LawnLove/Bermuda Bible: DFW soil reaches 55°F ~March 1, triggering greenup
//   https://thebermudabible.com/north-texas-bermudagrass-lawn-schedule/
//
// Key biological facts (from research):
// - Growth stops when average air temp < 50°F (MU Extension)
// - Active growth begins at soil temp 65°F+ (Texas A&M)
// - Optimal growth at soil temp 75-90°F
// - Growth rate HIGHER in May-June than July-Aug (moisture availability)
// - 85% of annual production in 4-month window (May 15 - Sept 15)
// ============================================================

/**
 * Monthly baseline season multipliers for North Texas
 * Values represent fraction of max growth rate (0.0 to 1.0)
 *
 * Derived from: If 85% of production is May-Sept, and growth rate is
 * higher in May-June than July-August (MU Extension G4620):
 *
 * WINTER (15% of annual, distributed across 8 months):
 *   Dec-Feb: Near zero, full dormancy
 *   Nov, Mar: Transition periods
 *
 * GROWING SEASON (85% of annual, May 15 - Sept 15):
 *   May-June: Peak (higher moisture)
 *   July-Aug: Summer stress (heat/drought)
 *   September: Declining
 */
export const SEASONAL_BASELINE = {
  1:  0.01,  // January - deep dormancy (avg temp ~45°F DFW)
  2:  0.01,  // February - dormancy, soil starting to warm
  3:  0.08,  // March - early greenup begins (soil hits 55°F ~Mar 1)
  4:  0.47,  // April - accelerating growth, not yet peak
  5:  1.00,  // May - peak spring growth (moisture + warmth)
  6:  1.00,  // June - maximum growth rate
  7:  0.97,  // July - still strong despite summer stress
  8:  0.86,  // August - summer slump, drought stress
  9:  0.72,  // September - declining but still strong production
  10: 0.22,  // October - significant slowdown
  11: 0.03,  // November - near dormancy, first frosts
  12: 0.01,  // December - dormancy
};

/**
 * Temperature thresholds for grass growth (Fahrenheit)
 */
export const GROWTH_TEMPS = {
  dormant: 45,    // Below this: no growth, full dormancy
  minimal: 55,    // 45-55°F: minimal growth (10% of temp-optimal)
  slow: 65,       // 55-65°F: slow growth (30-50%)
  optimal_low: 75,  // 65-75°F: good growth (60-80%)
  optimal_high: 90, // 75-90°F: optimal growth (100%)
  stress: 95,     // 90-95°F: heat stress begins
  severe: 100,    // >100°F: severe heat stress, growth stops
};

/**
 * Calculate growth multiplier from daily temperature
 * Uses average of high and low temps to approximate soil temperature response
 *
 * @param {number} tempMaxF - Daily high temperature (°F)
 * @param {number} tempMinF - Daily low temperature (°F)
 * @returns {number} Growth multiplier (0.0 to 1.0)
 */
export function getTemperatureGrowthMultiplier(tempMaxF, tempMinF) {
  const avgTemp = (tempMaxF + tempMinF) / 2;
  const t = GROWTH_TEMPS;

  if (avgTemp < t.dormant) {
    return 0.0;  // Full dormancy
  }
  if (avgTemp < t.minimal) {
    // Linear ramp from 0 to 0.1
    return 0.1 * (avgTemp - t.dormant) / (t.minimal - t.dormant);
  }
  if (avgTemp < t.slow) {
    // Ramp from 0.1 to 0.4
    return 0.1 + 0.3 * (avgTemp - t.minimal) / (t.slow - t.minimal);
  }
  if (avgTemp < t.optimal_low) {
    // Ramp from 0.4 to 0.75
    return 0.4 + 0.35 * (avgTemp - t.slow) / (t.optimal_low - t.slow);
  }
  if (avgTemp <= t.optimal_high) {
    // Optimal range: 0.75 to 1.0
    return 0.75 + 0.25 * (avgTemp - t.optimal_low) / (t.optimal_high - t.optimal_low);
  }
  if (avgTemp <= t.stress) {
    // Heat stress beginning: 1.0 down to 0.7
    return 1.0 - 0.3 * (avgTemp - t.optimal_high) / (t.stress - t.optimal_high);
  }
  if (avgTemp <= t.severe) {
    // Severe stress: 0.7 down to 0.3
    return 0.7 - 0.4 * (avgTemp - t.stress) / (t.severe - t.stress);
  }
  // Extreme heat: minimal growth
  return 0.2;
}

/**
 * Get seasonal baseline multiplier for a specific date
 * Interpolates between months for smooth transitions
 *
 * @param {Date|string} date - Date to get multiplier for
 * @returns {number} Baseline seasonal multiplier (0.0 to 1.0)
 */
export function getSeasonalBaseline(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth() + 1;  // 1-12
  const day = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), month, 0).getDate();

  // Get current and next month's baseline
  const currentBaseline = SEASONAL_BASELINE[month];
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextBaseline = SEASONAL_BASELINE[nextMonth];

  // Linear interpolation based on day of month
  const progress = (day - 1) / daysInMonth;
  return currentBaseline + (nextBaseline - currentBaseline) * progress;
}

/**
 * Calculate dynamic season multiplier combining forecast temps and seasonal baseline
 *
 * Strategy:
 * - Days 1-14 (forecast available): Temperature-driven, weighted with seasonal baseline
 * - Days 15+: Pure seasonal baseline (historical average)
 *
 * @param {number} simulationDay - Day number in simulation (0-indexed)
 * @param {Date} startDate - Simulation start date
 * @param {Array} weatherForecast - Array of forecast weather days (may be shorter than simulation)
 * @returns {number} Season multiplier for this day
 */
export function getDynamicSeasonMultiplier(simulationDay, startDate, weatherForecast = []) {
  // Calculate the actual date for this simulation day
  const date = new Date(startDate);
  date.setDate(date.getDate() + simulationDay);

  // Get seasonal baseline for this date
  const baseline = getSeasonalBaseline(date);

  // If we have forecast data for this day, blend with temperature
  if (simulationDay < weatherForecast.length) {
    const forecast = weatherForecast[simulationDay];
    const tempMultiplier = getTemperatureGrowthMultiplier(
      forecast.temp_max_f,
      forecast.temp_min_f
    );

    // Blend: 60% temperature-driven, 40% seasonal baseline
    // This allows unusual weather to override historical patterns
    return 0.6 * tempMultiplier + 0.4 * baseline;
  }

  // Beyond forecast: use pure seasonal baseline
  return baseline;
}

// ============================================================
// WEATHER DAY FACTORY - For consistent object creation
// ============================================================

/**
 * Create a weather day object with consistent structure
 * @param {Object} params - Weather parameters
 * @returns {Object} Normalized weather day object
 */
export function createWeatherDay(params) {
  return {
    date: params.date,
    rain_mm: params.rain_mm ?? params.precipitation_sum ?? 0,
    temp_max_f: params.temp_max_f ?? params.temperature_2m_max,
    temp_min_f: params.temp_min_f ?? params.temperature_2m_min,
    et_mm: params.et_mm ?? params.et0_fao_evapotranspiration ?? WEATHER_API.defaultET,
  };
}
