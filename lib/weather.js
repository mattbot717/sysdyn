/**
 * lib/weather.js
 *
 * Fetch real weather data for Collinsville, TX and integrate with grazing models
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LOCATION, WEATHER_API, createWeatherDay } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Fetch weather data from Open-Meteo API
 * @param {number} latitude - Location latitude (defaults to farm location)
 * @param {number} longitude - Location longitude (defaults to farm location)
 * @param {number} pastDays - Number of past days to fetch (max 92)
 * @param {number} futureDays - Number of future forecast days (max 16)
 * @returns {Promise<Object>} Weather data with daily arrays
 */
export async function fetchWeather(
  latitude = LOCATION.latitude,
  longitude = LOCATION.longitude,
  pastDays = WEATHER_API.maxPastDays,
  futureDays = 7
) {
  const url = `${WEATHER_API.baseUrl}?` +
    `latitude=${latitude}&longitude=${longitude}` +
    `&past_days=${pastDays}&forecast_days=${futureDays}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
    `&temperature_unit=${WEATHER_API.temperatureUnit}&timezone=${WEATHER_API.timezone}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Parse weather data into daily time series
 * @param {Object} weatherData - Raw API response
 * @returns {Array} Array of daily weather objects
 */
export function parseWeatherData(weatherData) {
  const { time, precipitation_sum, temperature_2m_max, temperature_2m_min, et0_fao_evapotranspiration } = weatherData.daily;

  const days = [];
  for (let i = 0; i < time.length; i++) {
    // Skip null values (API sometimes returns nulls for early past data)
    if (precipitation_sum[i] === null) continue;

    days.push(createWeatherDay({
      date: time[i],
      precipitation_sum: precipitation_sum[i],
      temperature_2m_max: temperature_2m_max[i],
      temperature_2m_min: temperature_2m_min[i],
      et0_fao_evapotranspiration: et0_fao_evapotranspiration[i],
    }));
  }

  return days;
}

/**
 * Calculate summary statistics for a weather period
 * @param {Array} weatherDays - Array of daily weather objects
 * @returns {Object} Summary stats
 */
export function summarizeWeather(weatherDays) {
  const totalRain = weatherDays.reduce((sum, d) => sum + d.rain_mm, 0);
  const totalET = weatherDays.reduce((sum, d) => sum + d.et_mm, 0);
  const avgRain = totalRain / weatherDays.length;
  const avgET = totalET / weatherDays.length;
  const waterBalance = totalRain - totalET;

  // Count dry days (< 1mm rain)
  const dryDays = weatherDays.filter(d => d.rain_mm < 1).length;

  // Find longest dry spell
  let longestDrySpell = 0;
  let currentDrySpell = 0;
  for (const day of weatherDays) {
    if (day.rain_mm < 1) {
      currentDrySpell++;
      longestDrySpell = Math.max(longestDrySpell, currentDrySpell);
    } else {
      currentDrySpell = 0;
    }
  }

  return {
    days: weatherDays.length,
    totalRain_mm: totalRain,
    totalET_mm: totalET,
    avgRain_mm: avgRain,
    avgET_mm: avgET,
    waterBalance_mm: waterBalance,
    dryDays,
    longestDrySpell,
  };
}

/**
 * Display weather summary in terminal
 * @param {Object} summary - Weather summary object
 * @param {string} period - Description of the period (e.g., "Last 30 days")
 */
export function displayWeatherSummary(summary, period = "Period") {
  console.log(`\n🌦️  ${period} Weather Summary:\n`);
  console.log(`  Days analyzed:        ${summary.days}`);
  console.log(`  Total rainfall:       ${summary.totalRain_mm.toFixed(1)} mm`);
  console.log(`  Average daily rain:   ${summary.avgRain_mm.toFixed(2)} mm/day`);
  console.log(`  Total evaporation:    ${summary.totalET_mm.toFixed(1)} mm`);
  console.log(`  Average daily ET:     ${summary.avgET_mm.toFixed(2)} mm/day`);
  console.log(`  Water balance:        ${summary.waterBalance_mm > 0 ? '+' : ''}${summary.waterBalance_mm.toFixed(1)} mm ${summary.waterBalance_mm > 0 ? '(surplus)' : '(deficit)'}`);
  console.log(`  Dry days (< 1mm):     ${summary.dryDays}`);
  console.log(`  Longest dry spell:    ${summary.longestDrySpell} days`);
  console.log('');
}

/**
 * Get weather data for farm location (Collinsville, TX)
 * @param {number} pastDays - Days of historical data
 * @param {number} futureDays - Days of forecast
 * @returns {Promise<Array>} Parsed weather days
 */
/**
 * Refresh the weather archive with latest data.
 * Fetches 92 days of history + 14 days forecast from Open-Meteo,
 * then merges with the existing archive to preserve older historical data.
 *
 * @param {Object} options - Configuration
 * @param {number} options.pastDays - Historical days to fetch (default: 92)
 * @param {number} options.futureDays - Forecast days to fetch (default: 14)
 * @returns {Promise<Object>} Updated archive metadata
 */
export async function refreshWeatherArchive(options = {}) {
  const { pastDays = WEATHER_API.maxPastDays, futureDays = 14 } = options;

  console.log(`  Fetching ${pastDays} days history + ${futureDays} days forecast...`);

  const freshData = await fetchWeather(
    LOCATION.latitude, LOCATION.longitude, pastDays, futureDays
  );

  // Load existing archive to preserve older history
  const archivePath = join(__dirname, '../data/weather-archive-full.json');
  const shortArchivePath = join(__dirname, '../data/weather-archive.json');
  let existing = { daily: { time: [], precipitation_sum: [], temperature_2m_max: [], temperature_2m_min: [], et0_fao_evapotranspiration: [] } };

  try {
    const raw = await readFile(archivePath, 'utf-8');
    existing = JSON.parse(raw);
  } catch {
    // No existing archive, start fresh
  }

  // Merge: keep older data from existing archive, overlay with fresh data
  const freshDates = new Set(freshData.daily.time);
  const merged = {
    time: [],
    precipitation_sum: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    et0_fao_evapotranspiration: [],
  };

  // Add old data that isn't covered by fresh fetch
  for (let i = 0; i < existing.daily.time.length; i++) {
    if (!freshDates.has(existing.daily.time[i])) {
      merged.time.push(existing.daily.time[i]);
      merged.precipitation_sum.push(existing.daily.precipitation_sum[i]);
      merged.temperature_2m_max.push(existing.daily.temperature_2m_max[i]);
      merged.temperature_2m_min.push(existing.daily.temperature_2m_min[i]);
      merged.et0_fao_evapotranspiration.push(existing.daily.et0_fao_evapotranspiration[i]);
    }
  }

  // Add all fresh data (overwrites any overlapping dates)
  for (let i = 0; i < freshData.daily.time.length; i++) {
    merged.time.push(freshData.daily.time[i]);
    merged.precipitation_sum.push(freshData.daily.precipitation_sum[i]);
    merged.temperature_2m_max.push(freshData.daily.temperature_2m_max[i]);
    merged.temperature_2m_min.push(freshData.daily.temperature_2m_min[i]);
    merged.et0_fao_evapotranspiration.push(freshData.daily.et0_fao_evapotranspiration[i]);
  }

  // Sort by date
  const indices = merged.time.map((_, i) => i);
  indices.sort((a, b) => merged.time[a].localeCompare(merged.time[b]));

  const sorted = {
    time: indices.map(i => merged.time[i]),
    precipitation_sum: indices.map(i => merged.precipitation_sum[i]),
    temperature_2m_max: indices.map(i => merged.temperature_2m_max[i]),
    temperature_2m_min: indices.map(i => merged.temperature_2m_min[i]),
    et0_fao_evapotranspiration: indices.map(i => merged.et0_fao_evapotranspiration[i]),
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayIdx = sorted.time.indexOf(todayStr);
  const historicalDays = todayIdx >= 0 ? todayIdx + 1 : sorted.time.length;
  const forecastDays = sorted.time.length - historicalDays;

  const archive = {
    metadata: {
      location: LOCATION.name,
      latitude: LOCATION.latitude,
      longitude: LOCATION.longitude,
      fetched: new Date().toISOString(),
      historicalDays,
      forecastDays,
      totalDays: sorted.time.length,
      dateRange: {
        start: sorted.time[0],
        end: sorted.time[sorted.time.length - 1],
      },
    },
    daily: sorted,
  };

  // Write to both archive files
  await writeFile(archivePath, JSON.stringify(archive, null, 2));
  await writeFile(shortArchivePath, JSON.stringify(archive, null, 2));

  console.log(`  Archive updated: ${archive.metadata.totalDays} days (${archive.metadata.dateRange.start} to ${archive.metadata.dateRange.end})`);

  return archive.metadata;
}

export async function getCollinsvilleWeather(pastDays = WEATHER_API.maxPastDays, futureDays = 7) {
  console.log(`\n📡 Fetching weather data for ${LOCATION.name}...`);
  console.log(`   Historical: ${pastDays} days`);
  console.log(`   Forecast: ${futureDays} days\n`);

  const data = await fetchWeather(LOCATION.latitude, LOCATION.longitude, pastDays, futureDays);
  const days = parseWeatherData(data);

  console.log(`✅ Retrieved ${days.length} days of weather data\n`);

  return days;
}
