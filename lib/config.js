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
