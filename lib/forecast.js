/**
 * lib/forecast.js
 *
 * Weather forecast mode for rotation planning
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load cached weather archive
 * @returns {Promise<Object>} Weather data with daily arrays
 */
export async function loadWeatherArchive() {
  const archivePath = join(__dirname, '../data/weather-archive.json');
  const raw = await readFile(archivePath, 'utf-8');
  const data = JSON.parse(raw);

  // Find the split between historical and forecast
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = data.daily.time.findIndex(d => d === today);

  return {
    all: data.daily,
    historical: {
      days: todayIndex + 1,
      startDate: data.daily.time[0],
      endDate: data.daily.time[todayIndex],
    },
    forecast: {
      days: data.daily.time.length - todayIndex - 1,
      startDate: data.daily.time[todayIndex + 1],
      endDate: data.daily.time[data.daily.time.length - 1],
    },
  };
}

/**
 * Get forecast period (next N days)
 * @param {number} days - Number of forecast days to retrieve
 * @returns {Promise<Array>} Array of forecast day objects
 */
export async function getForecast(days = 14) {
  const archive = await loadWeatherArchive();
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = archive.all.time.findIndex(d => d === today);

  if (todayIndex === -1) {
    throw new Error('Today not found in weather archive');
  }

  const forecastDays = [];
  for (let i = 1; i <= days && todayIndex + i < archive.all.time.length; i++) {
    const idx = todayIndex + i;
    forecastDays.push({
      date: archive.all.time[idx],
      rain_mm: archive.all.precipitation_sum[idx] || 0,
      temp_max_f: archive.all.temperature_2m_max[idx],
      temp_min_f: archive.all.temperature_2m_min[idx],
      et_mm: archive.all.et0_fao_evapotranspiration[idx] || 1.5,
    });
  }

  return forecastDays;
}

/**
 * Get historical period (last N days)
 * @param {number} days - Number of historical days
 * @returns {Promise<Array>} Array of historical day objects
 */
export async function getHistorical(days = 90) {
  const archive = await loadWeatherArchive();
  const today = new Date().toISOString().split('T')[0];
  const todayIndex = archive.all.time.findIndex(d => d === today);

  if (todayIndex === -1) {
    throw new Error('Today not found in weather archive');
  }

  const startIdx = Math.max(0, todayIndex - days + 1);
  const historicalDays = [];

  for (let i = startIdx; i <= todayIndex; i++) {
    historicalDays.push({
      date: archive.all.time[i],
      rain_mm: archive.all.precipitation_sum[i] || 0,
      temp_max_f: archive.all.temperature_2m_max[i],
      temp_min_f: archive.all.temperature_2m_min[i],
      et_mm: archive.all.et0_fao_evapotranspiration[i] || 1.5,
    });
  }

  return historicalDays;
}

/**
 * Display forecast summary
 */
export async function displayForecastSummary() {
  const forecast = await getForecast(14);

  console.log('\n🔮 14-DAY WEATHER FORECAST:\n');
  console.log('  Date       | Rain (mm) | ET (mm) | Balance | Temp (°F)');
  console.log('  -----------|-----------|---------|---------|----------');

  for (const day of forecast) {
    const balance = day.rain_mm - day.et_mm;
    const balanceStr = balance > 0 ? `+${balance.toFixed(1)}` : balance.toFixed(1);
    console.log(`  ${day.date} | ${day.rain_mm.toFixed(1).padStart(9)} | ${day.et_mm.toFixed(2).padStart(7)} | ${balanceStr.padStart(7)} | ${day.temp_min_f.toFixed(0)}-${day.temp_max_f.toFixed(0)}`);
  }

  // Summary stats
  const totalRain = forecast.reduce((sum, d) => sum + d.rain_mm, 0);
  const totalET = forecast.reduce((sum, d) => sum + d.et_mm, 0);
  const balance = totalRain - totalET;

  console.log('\n  FORECAST SUMMARY:');
  console.log(`    Total rain: ${totalRain.toFixed(1)}mm`);
  console.log(`    Total ET:   ${totalET.toFixed(1)}mm`);
  console.log(`    Balance:    ${balance > 0 ? '+' : ''}${balance.toFixed(1)}mm ${balance > 0 ? '(surplus)' : '(deficit)'}`);
  console.log('');
}

/**
 * Test paddock recovery over forecast period
 * @param {string} paddockName - Name of paddock
 * @param {number} currentForage - Current forage level (kg/acre)
 * @param {number} currentMoisture - Current soil moisture (mm)
 * @param {Object} paddockParams - Paddock-specific parameters
 * @returns {Promise<Object>} Recovery projection
 */
export async function projectPaddockRecovery(paddockName, currentForage, currentMoisture, paddockParams) {
  const forecast = await getForecast(14);

  let forage = currentForage;
  let moisture = currentMoisture;
  const dailyForage = [forage];
  const dailyMoisture = [moisture];

  // Simple growth model (no grazing during recovery)
  for (const day of forecast) {
    // Update moisture
    moisture += day.rain_mm + (paddockParams.flood_bonus || 0);
    moisture -= day.et_mm * (paddockParams.evap_mult || 1.0);
    moisture = Math.max(0, Math.min(moisture, paddockParams.field_capacity || 100));

    // Calculate growth
    const moistureFactor = moisture / (paddockParams.moisture_optimal || 60);
    const seasonFactor = paddockParams.season_multiplier || 0.1; // Winter
    const growthRate = (paddockParams.max_growth_rate || 80) *
                       seasonFactor *
                       (forage / (paddockParams.optimal_forage || 2500)) *
                       (1 - forage / (paddockParams.optimal_forage || 2500)) *
                       moistureFactor;

    forage += Math.max(0, growthRate);
    forage = Math.min(forage, paddockParams.optimal_forage || 2500);

    dailyForage.push(forage);
    dailyMoisture.push(moisture);
  }

  return {
    paddock: paddockName,
    initialForage: currentForage,
    finalForage: forage,
    forageGain: forage - currentForage,
    forageGainPercent: ((forage - currentForage) / currentForage * 100).toFixed(1),
    initialMoisture: currentMoisture,
    finalMoisture: moisture,
    dailyForage,
    dailyMoisture,
    daysToTarget: dailyForage.findIndex(f => f >= (paddockParams.target_forage || 2000)),
  };
}
