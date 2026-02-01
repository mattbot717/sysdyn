#!/usr/bin/env node

/**
 * Fetch full historical weather data in chunks
 *
 * Open-Meteo limits to 93 days per request, so we walk backwards
 * through time in 93-day chunks to build a complete historical archive
 */

import { writeFile } from 'fs/promises';
import { LOCATION, WEATHER_API } from '../lib/config.js';

const CHUNK_SIZE = WEATHER_API.maxPastDays; // API allows max 93, we use 92 to be safe

/**
 * Fetch weather data for a specific date range
 */
async function fetchChunk(endDate, pastDays) {
  const url = `${WEATHER_API.baseUrl}?` +
    `latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
    `&end_date=${endDate}` +
    `&past_days=${pastDays}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
    `&temperature_unit=${WEATHER_API.temperatureUnit}&timezone=${WEATHER_API.timezone}`;

  console.log(`  Fetching: ${endDate} going back ${pastDays} days...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`API error: ${data.reason}`);
  }

  return data.daily;
}

/**
 * Subtract days from a date string
 */
function subtractDays(dateString, days) {
  const date = new Date(dateString + 'T12:00:00Z');
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Fetch full historical archive in chunks
 */
async function fetchFullHistory(totalDays = 365) {
  console.log('\n📡 Fetching historical weather data in chunks...\n');
  console.log(`  Target: ${totalDays} days`);
  console.log(`  Location: ${LOCATION.name} (${LOCATION.latitude}°N, ${Math.abs(LOCATION.longitude)}°W)`);
  console.log(`  Chunk size: ${CHUNK_SIZE} days\n`);

  const today = new Date().toISOString().split('T')[0];
  const chunks = [];
  let currentEndDate = today;
  let daysFetched = 0;

  // Calculate number of chunks needed
  const numChunks = Math.ceil(totalDays / CHUNK_SIZE);

  for (let i = 0; i < numChunks; i++) {
    const daysRemaining = totalDays - daysFetched;
    const chunkDays = Math.min(CHUNK_SIZE, daysRemaining);

    try {
      const chunk = await fetchChunk(currentEndDate, chunkDays);
      chunks.push(chunk);
      daysFetched += chunk.time.length;

      console.log(`    ✓ Chunk ${i + 1}/${numChunks}: ${chunk.time[0]} to ${chunk.time[chunk.time.length - 1]} (${chunk.time.length} days)`);

      // Move end date backwards for next chunk
      currentEndDate = subtractDays(chunk.time[0], 1);

      // Small delay to be nice to the API
      if (i < numChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`    ✗ Chunk ${i + 1} failed: ${error.message}`);
      break;
    }
  }

  console.log(`\n  Total days fetched: ${daysFetched}\n`);

  // Merge chunks (reverse order since we fetched backwards)
  const merged = {
    time: [],
    precipitation_sum: [],
    temperature_2m_max: [],
    temperature_2m_min: [],
    et0_fao_evapotranspiration: [],
  };

  // Reverse chunks to get chronological order
  chunks.reverse();

  for (const chunk of chunks) {
    merged.time.push(...chunk.time);
    merged.precipitation_sum.push(...chunk.precipitation_sum);
    merged.temperature_2m_max.push(...chunk.temperature_2m_max);
    merged.temperature_2m_min.push(...chunk.temperature_2m_min);
    merged.et0_fao_evapotranspiration.push(...chunk.et0_fao_evapotranspiration);
  }

  return merged;
}

async function main() {
  const args = process.argv.slice(2);
  const totalDays = parseInt(args[0]) || 365;

  try {
    const historical = await fetchFullHistory(totalDays);

    // Also fetch current forecast
    console.log('📡 Fetching current forecast (14 days)...\n');
    const forecastUrl = `${WEATHER_API.baseUrl}?` +
      `latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}` +
      `&forecast_days=14` +
      `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,et0_fao_evapotranspiration` +
      `&temperature_unit=${WEATHER_API.temperatureUnit}&timezone=${WEATHER_API.timezone}`;

    const forecastResponse = await fetch(forecastUrl);
    const forecastData = await forecastResponse.json();

    // Combine historical + forecast
    const combined = {
      time: [...historical.time, ...forecastData.daily.time.slice(1)], // Skip duplicate today
      precipitation_sum: [...historical.precipitation_sum, ...forecastData.daily.precipitation_sum.slice(1)],
      temperature_2m_max: [...historical.temperature_2m_max, ...forecastData.daily.temperature_2m_max.slice(1)],
      temperature_2m_min: [...historical.temperature_2m_min, ...forecastData.daily.temperature_2m_min.slice(1)],
      et0_fao_evapotranspiration: [...historical.et0_fao_evapotranspiration, ...forecastData.daily.et0_fao_evapotranspiration.slice(1)],
    };

    // Save to file
    const archive = {
      metadata: {
        location: LOCATION.name,
        latitude: LOCATION.latitude,
        longitude: LOCATION.longitude,
        fetched: new Date().toISOString(),
        historicalDays: historical.time.length,
        forecastDays: 14,
        totalDays: combined.time.length,
        dateRange: {
          start: combined.time[0],
          end: combined.time[combined.time.length - 1],
        },
      },
      daily: combined,
    };

    const outputPath = './data/weather-archive-full.json';
    await writeFile(outputPath, JSON.stringify(archive, null, 2));

    console.log(`✅ Saved to: ${outputPath}\n`);
    console.log('📊 ARCHIVE SUMMARY:');
    console.log(`   Historical: ${archive.metadata.historicalDays} days (${archive.metadata.dateRange.start} to today)`);
    console.log(`   Forecast:   ${archive.metadata.forecastDays} days`);
    console.log(`   Total:      ${archive.metadata.totalDays} days\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
