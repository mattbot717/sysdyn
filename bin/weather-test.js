#!/usr/bin/env node

/**
 * Test the weather module - fetch and display Collinsville, TX weather
 */

import { getCollinsvilleWeather, summarizeWeather, displayWeatherSummary } from '../lib/weather.js';

async function main() {
  try {
    // Fetch last 90 days
    const weatherDays = await getCollinsvilleWeather(92, 0);

    // Overall summary
    const overall = summarizeWeather(weatherDays);
    displayWeatherSummary(overall, "Last 90 Days");

    // December analysis
    const decDays = weatherDays.filter(d => d.date.startsWith('2025-12'));
    if (decDays.length > 0) {
      const decSummary = summarizeWeather(decDays);
      displayWeatherSummary(decSummary, "December 2025");
    }

    // January analysis (up to today)
    const janDays = weatherDays.filter(d => d.date.startsWith('2026-01'));
    if (janDays.length > 0) {
      const janSummary = summarizeWeather(janDays);
      displayWeatherSummary(janSummary, "January 2026");
    }

    // Find the ice storm (Jan 24-26)
    console.log('\n❄️  ICE STORM EVENT (Jan 24-26, 2026):\n');
    const iceStorm = weatherDays.filter(d =>
      d.date === '2026-01-24' || d.date === '2026-01-25' || d.date === '2026-01-26'
    );
    for (const day of iceStorm) {
      console.log(`  ${day.date}: ${day.rain_mm.toFixed(1)}mm precip, ET: ${day.et_mm.toFixed(2)}mm/day`);
    }
    const iceTotal = iceStorm.reduce((sum, d) => sum + d.rain_mm, 0);
    console.log(`  Total: ${iceTotal.toFixed(1)}mm (${(iceTotal / 25.4).toFixed(2)} inches as ice)`);
    console.log('');

    // Show recent daily data (last 14 days)
    console.log('\n📅 Last 14 Days (Daily):\n');
    console.log('  Date       | Rain (mm) | ET (mm) | Balance | Temp (°F)');
    console.log('  -----------|-----------|---------|---------|----------');
    const recentDays = weatherDays.slice(-14);
    for (const day of recentDays) {
      const balance = day.rain_mm - day.et_mm;
      const balanceStr = balance > 0 ? `+${balance.toFixed(1)}` : balance.toFixed(1);
      console.log(`  ${day.date} | ${day.rain_mm.toFixed(1).padStart(9)} | ${day.et_mm.toFixed(2).padStart(7)} | ${balanceStr.padStart(7)} | ${day.temp_min_f.toFixed(0)}-${day.temp_max_f.toFixed(0)}`);
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error fetching weather:', error.message);
    process.exit(1);
  }
}

main();
