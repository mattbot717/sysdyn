#!/usr/bin/env node

/**
 * Forecast Mode - Rotation Planning Tool
 *
 * Uses 14-day weather forecast to predict paddock recovery
 * and recommend optimal rotation strategy
 */

import { displayForecastSummary, projectPaddockRecovery, getForecast } from '../lib/forecast.js';
import { loadModel } from '../lib/loader.js';

// Current paddock status (from last simulation)
// TODO: Load this from simulation state file
const CURRENT_STATUS = {
  cce: { forage: 1783, moisture: 36.5 },
  ccw: { forage: 1844, moisture: 41.4 },
  big: { forage: 331, moisture: 53.2 },   // Currently grazing
  hog: { forage: 2200, moisture: 45.9 },
  south: { forage: 1200, moisture: 75 },  // Recently seeded, recovering with good creek moisture
};

const PADDOCK_NAMES = {
  cce: 'Cedar Crest East',
  ccw: 'Cedar Crest West',
  big: 'Big Pasture',
  hog: 'Hog Pasture',
  south: "Frankie's Pasture",
};

async function main() {
  try {
    console.log('\n🔮 FORECAST MODE: ROTATION PLANNING');
    console.log('══════════════════════════════════════════════════════════\n');

    // Show weather forecast
    await displayForecastSummary();

    // Load model to get paddock parameters
    const model = await loadModel('grazing-rotation-real');

    // Project recovery for each paddock
    console.log('📊 PADDOCK RECOVERY PROJECTIONS (14 days, no grazing):\n');

    const paddocks = ['cce', 'ccw', 'big', 'hog', 'south'];
    const projections = [];

    for (const paddock of paddocks) {
      const params = {
        evap_mult: model.params[`${paddock}_evap_mult`],
        flood_bonus: model.params[`${paddock}_flood_bonus`] || 0,
        field_capacity: model.params.field_capacity,
        moisture_optimal: model.params.moisture_optimal,
        max_growth_rate: model.params.max_growth_rate,
        optimal_forage: model.params.optimal_forage,
        season_multiplier: model.params.season_multiplier,
        target_forage: 2000, // Healthy grazing threshold
      };

      const projection = await projectPaddockRecovery(
        PADDOCK_NAMES[paddock],
        CURRENT_STATUS[paddock].forage,
        CURRENT_STATUS[paddock].moisture,
        params
      );

      projections.push({ id: paddock, ...projection });
    }

    // Sort by final forage (best recovery first)
    projections.sort((a, b) => b.finalForage - a.finalForage);

    // Display projections
    for (const proj of projections) {
      const status = proj.finalForage > 2000 ? '✅ READY' :
                     proj.finalForage > 1500 ? '⚠️  MARGINAL' :
                     proj.finalForage > 1000 ? '⚠️  LOW' : '❌ CRITICAL';

      const currentlyGrazing = proj.id === 'big' ? ' (CURRENTLY GRAZING)' : '';

      console.log(`  ${proj.paddock}${currentlyGrazing}`);
      console.log(`    Current:  ${proj.initialForage.toFixed(0)} kg/acre`);
      console.log(`    14-day:   ${proj.finalForage.toFixed(0)} kg/acre (+${proj.forageGain.toFixed(0)}, ${proj.forageGainPercent > 0 ? '+' : ''}${proj.forageGainPercent}%)`);
      console.log(`    Moisture: ${proj.initialMoisture.toFixed(1)} → ${proj.finalMoisture.toFixed(1)} mm`);
      console.log(`    Status:   ${status}`);
      console.log('');
    }

    // Recommendations
    console.log('══════════════════════════════════════════════════════════');
    console.log('\n🎯 ROTATION RECOMMENDATIONS:\n');

    const ready = projections.filter(p => p.finalForage > 2000 && p.id !== 'big');
    const marginal = projections.filter(p => p.finalForage > 1500 && p.finalForage <= 2000 && p.id !== 'big');

    if (ready.length > 0) {
      console.log('  ✅ READY TO GRAZE (> 2000 kg/acre):');
      for (const p of ready) {
        console.log(`     → ${p.paddock} (${p.finalForage.toFixed(0)} kg/acre)`);
      }
    }

    if (marginal.length > 0) {
      console.log('\n  ⚠️  MARGINAL (1500-2000 kg/acre):');
      for (const p of marginal) {
        console.log(`     → ${p.paddock} (${p.finalForage.toFixed(0)} kg/acre) - short grazing period recommended`);
      }
    }

    // Current paddock status
    const currentProj = projections.find(p => p.id === 'big');
    console.log(`\n  📍 CURRENT PADDOCK: ${currentProj.paddock}`);
    console.log(`     Status: ${currentProj.finalForage.toFixed(0)} kg/acre (CRITICAL - hay feeding required)`);
    console.log(`     Recommendation: MOVE SOON to allow recovery`);

    // Best next paddock
    const best = ready.length > 0 ? ready[0] : marginal[0];
    console.log(`\n  🏆 BEST NEXT ROTATION:`);
    console.log(`     → Move to: ${best.paddock}`);
    console.log(`     → Expected forage: ${best.finalForage.toFixed(0)} kg/acre`);
    console.log(`     → Moisture: ${best.finalMoisture.toFixed(1)} mm`);

    // Weather-based insights
    const forecast = await getForecast(14);
    const totalRain = forecast.reduce((sum, d) => sum + d.rain_mm, 0);
    const totalET = forecast.reduce((sum, d) => sum + d.et_mm, 0);

    console.log(`\n  🌦️  WEATHER INSIGHTS:`);
    if (totalRain > totalET) {
      console.log(`     → Forecast shows SURPLUS (+${(totalRain - totalET).toFixed(1)}mm)`);
      console.log(`     → Good conditions for grazing and recovery`);
    } else {
      console.log(`     → Forecast shows DEFICIT (${(totalRain - totalET).toFixed(1)}mm)`);
      console.log(`     → Consider shorter grazing periods`);
      console.log(`     → Monitor closely, may need hay supplementation`);
    }

    console.log('\n══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
