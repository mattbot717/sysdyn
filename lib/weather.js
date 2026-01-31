/**
 * lib/weather.js
 *
 * Fetch real weather data for Collinsville, TX and integrate with grazing models
 */

/**
 * Fetch weather data from Open-Meteo API
 * @param {number} latitude - Location latitude
 * @param {number} longitude - Location longitude
 * @param {number} pastDays - Number of past days to fetch (max 92)
 * @param {number} futureDays - Number of future forecast days (max 16)
 * @returns {Promise<Object>} Weather data with daily arrays
 */
export async function fetchWeather(latitude = 33.56, longitude = -96.91, pastDays = 92, futureDays = 7) {
  const url = `https://api.open-meteo.com/v1/forecast?` +
    `latitude=${latitude}&longitude=${longitude}` +
    `&past_days=${pastDays}&forecast_days=${futureDays}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
    `&temperature_unit=fahrenheit&timezone=America/Chicago`;

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

    days.push({
      date: time[i],
      rain_mm: precipitation_sum[i] || 0,  // Convert null to 0
      temp_max_f: temperature_2m_max[i],
      temp_min_f: temperature_2m_min[i],
      et_mm: et0_fao_evapotranspiration[i] || 1.5,  // Default if null
    });
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
 * Get weather data for Collinsville, TX (farm location)
 * @param {number} pastDays - Days of historical data
 * @param {number} futureDays - Days of forecast
 * @returns {Promise<Array>} Parsed weather days
 */
export async function getCollinsvilleWeather(pastDays = 92, futureDays = 7) {
  console.log(`\n📡 Fetching weather data for Collinsville, TX...`);
  console.log(`   Historical: ${pastDays} days`);
  console.log(`   Forecast: ${futureDays} days\n`);

  const data = await fetchWeather(33.56, -96.91, pastDays, futureDays);
  const days = parseWeatherData(data);

  console.log(`✅ Retrieved ${days.length} days of weather data\n`);

  return days;
}
