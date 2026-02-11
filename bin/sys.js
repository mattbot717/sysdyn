#!/usr/bin/env node

/**
 * sysdyn CLI
 *
 * Command-line interface for system dynamics modeling.
 *
 * Usage:
 *   sys run <model>              Run a simulation
 *   sys project [paddock]        Project paddock recovery scenarios
 *   sys planting [--season ...]  Planting window analysis & recommendations
 *   sys list                     List available models
 *   sys new <name>               Create a new model
 *   sys validate <model>         Validate a model
 *   sys help                     Show this help
 */

import { simulate, validateModel, summarize, sparkline } from '../lib/engine.js';
import { loadModel, listModels, saveModel, createModelScaffold } from '../lib/loader.js';
import { startServer } from '../lib/web/server.js';
import { projectForward } from '../lib/projection.js';
import { getPlantingRecommendations } from '../lib/planting.js';
import { parseOptions } from '../lib/cli-utils.js';
import { PADDOCKS, PADDOCK_KEYS } from '../lib/config.js';

// ============================================================
// CLI Entry Point
// ============================================================

const args = process.argv.slice(2);
const command = args[0];

try {
  switch (command) {
    case 'run':
      await runCommand(args.slice(1));
      break;
    case 'project':
      await projectCommand(args.slice(1));
      break;
    case 'planting':
      await plantingCommand(args.slice(1));
      break;
    case 'list':
      await listCommand();
      break;
    case 'new':
      await newCommand(args.slice(1));
      break;
    case 'validate':
      await validateCommand(args.slice(1));
      break;
    case 'serve':
      await serveCommand(args.slice(1));
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "sys help" for usage information.');
      process.exit(1);
  }
} catch (err) {
  console.error(`\n❌ Error: ${err.message}\n`);
  if (process.argv.includes('--debug')) console.error(err.stack);
  process.exit(1);
}

// ============================================================
// Commands
// ============================================================

/**
 * Run a simulation
 */
async function runCommand(args) {
  const modelName = args[0];
  const steps = parseInt(args[1]) || 100;
  const dt = parseFloat(args[2]) || 1;

  if (!modelName) {
    console.error('Usage: sys run <model> [steps] [dt]');
    console.error('Example: sys run farm-water 100 1');
    process.exit(1);
  }

  // Load model
  console.log(`\n📊 Loading model: ${modelName}...`);
  const model = await loadModel(modelName);

  // Run simulation
  console.log(`⚙️  Running simulation (${steps} steps, dt=${dt})...\n`);
  const results = simulate(model, { steps, dt });

  // Display results
  displayResults(model, results);
}

/**
 * Project paddock recovery under multiple scenarios
 *
 * Usage: sys project [paddock] [--days 90] [--hay 0.4]
 */
async function projectCommand(args) {
  // Parse options first, then extract positional args (skipping flag values)
  const opts = parseOptions(args);
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      // Skip flag and its value (if next arg isn't another flag)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) i++;
    } else {
      positional.push(args[i]);
    }
  }

  // Resolve paddock key from name or key
  let paddock = positional[0] || null;
  if (paddock) {
    // Allow short names: "south", "frankies", "frankie's", "cce", etc.
    const normalized = paddock.toLowerCase().replace(/['']/g, '');
    if (PADDOCKS[normalized]) {
      paddock = normalized;
    } else {
      // Try matching by name substring
      const match = PADDOCK_KEYS.find(k =>
        PADDOCKS[k].name.toLowerCase().replace(/['']/g, '').includes(normalized)
      );
      if (match) paddock = match;
    }
  }

  const days = parseInt(opts.days) || 90;
  const hayFactor = parseFloat(opts.hay) || 0.4;

  console.log(`\n🌱 PADDOCK RECOVERY PROJECTION`);
  console.log('═'.repeat(60) + '\n');

  console.log('⏳ Estimating current paddock state from 60-day historical sim...');

  const result = await projectForward({ paddock, days, hayFactor });

  // Display current state
  const focusKey = result.focusPaddock;
  console.log(`\n  📍 ${result.focusName} current state:`);
  console.log(`     Forage:   ${result.finalState[`${focusKey}_forage`].toFixed(0)} kg/ac`);
  console.log(`     Moisture: ${result.finalState[`${focusKey}_moisture`].toFixed(1)} mm`);
  console.log(`     SOM:      ${result.finalState[`${focusKey}_som`].toFixed(2)}`);

  console.log(`\n  📅 Projecting ${days} days from ${result.weatherInfo.startDate}`);
  console.log(`     Weather: ${result.weatherInfo.forecastDays} days forecast + ${result.weatherInfo.proxyDays} days prior-year proxy`);

  console.log(`\n  🐄 Herd on ${result.currentPaddock.name} ${result.currentPaddock.daysSince} days, ~${result.remainingDays} remaining before move\n`);

  // Scenario comparison
  displayProjectionScenarios(result);
  displayProjectionTimeline(result);
  displayProjectionEndState(result);
  displayProjectionTakeaways(result);

  console.log('═'.repeat(60) + '\n');
}

/**
 * Planting window analysis and recommendations
 *
 * Usage: sys planting [--season cool|warm|next]
 */
async function plantingCommand(args) {
  const opts = parseOptions(args);
  const season = opts.season || 'next';

  console.log(`\n🌾 PLANTING RECOMMENDATIONS`);
  console.log('═'.repeat(60) + '\n');

  const result = await getPlantingRecommendations({ season });

  const seasonLabel = result.season === 'cool' ? 'Cool-Season (Winter Mix)' : 'Warm-Season (Summer Mix)';
  console.log(`  Season: ${seasonLabel}\n`);

  displayPlantingWindow(result);
  displayPaddockPlantingStatus(result);
  displayPlantingScenarios(result);
  displayTransitionGap(result);

  console.log('═'.repeat(60) + '\n');
}

/**
 * List available models
 */
async function listCommand() {
  const models = await listModels();

  if (models.length === 0) {
    console.log('\n📁 No models found in ~/lab/sysdyn/models/\n');
    console.log('Create a new model with: sys new <name>\n');
    return;
  }

  console.log('\n📁 Available models:\n');
  for (const name of models) {
    console.log(`  • ${name}`);
  }
  console.log('');
}

/**
 * Create a new model
 */
async function newCommand(args) {
  const name = args[0];
  const template = args[1] || 'basic';

  if (!name) {
    console.error('Usage: sys new <name> [template]');
    console.error('Templates: basic, growth, decay');
    process.exit(1);
  }

  console.log(`\n📝 Creating new model: ${name}...`);
  const model = createModelScaffold(name, template);
  const filepath = await saveModel(model, name);

  console.log(`✅ Model created: ${filepath}`);
  console.log(`\nEdit the model, then run: sys run ${name}\n`);
}

/**
 * Start web dashboard server
 */
async function serveCommand(args) {
  const modelName = args[0];
  const port = parseInt(args[1]) || 3000;

  if (!modelName) {
    console.error('Usage: sys serve <model> [port]');
    console.error('Example: sys serve farm-water 3000');
    process.exit(1);
  }

  await startServer(modelName, { port });
}

/**
 * Validate a model
 */
async function validateCommand(args) {
  const modelName = args[0];

  if (!modelName) {
    console.error('Usage: sys validate <model>');
    process.exit(1);
  }

  console.log(`\n🔍 Validating model: ${modelName}...`);
  const model = await loadModel(modelName);
  const validation = validateModel(model);

  if (validation.valid) {
    console.log('✅ Model is valid!\n');

    // Show model info
    const numStocks = Object.keys(model.stocks || {}).length;
    const numFlows = Object.keys(model.flows || {}).length;
    const numParams = Object.keys(model.params || {}).length;

    console.log(`   Stocks: ${numStocks}`);
    console.log(`   Flows: ${numFlows}`);
    console.log(`   Parameters: ${numParams}\n`);
  } else {
    console.log('❌ Model has errors:\n');
    for (const error of validation.errors) {
      console.log(`   • ${error}`);
    }
    console.log('');
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
╭──────────────────────────────────────────────────────────────╮
│                         sysdyn                               │
│        System Dynamics Modeling & Simulation                 │
╰──────────────────────────────────────────────────────────────╯

USAGE:
  sys run <model> [steps] [dt]        Run a simulation (CLI output)
  sys project [paddock] [--days N]    Project paddock recovery scenarios
  sys planting [--season cool|warm]   Planting window analysis & recs
  sys serve <model> [port]            Launch web dashboard
  sys list                            List available models
  sys new <name> [template]           Create a new model
  sys validate <model>                Validate a model
  sys help                            Show this help

PROJECTION EXAMPLES:
  sys project south --days 90         Frankie's 90-day recovery projection
  sys project --days 60               Current paddock 60-day projection
  sys project cce --hay 0.3           CCE projection with 30% hay supplement

PLANTING EXAMPLES:
  sys planting --season cool          Cool-season (Oct-Nov) window analysis
  sys planting --season warm          Warm-season (May-Jun) window analysis
  sys planting                        Auto-detect next season

SIMULATION EXAMPLES:
  sys run farm-water                  Run the farm-water model
  sys run farm-water 200 0.5          Run 200 steps with dt=0.5
  sys serve farm-water                Open interactive dashboard

TEMPLATES:
  basic     Simple stock and flow
  growth    Exponential growth
  decay     Exponential decay

MODELS:
  Models are stored in: ~/lab/sysdyn/models/
  Use YAML format for easy editing

`);
}

// ============================================================
// Display Functions — Simulation
// ============================================================

/**
 * Display simulation results
 */
function displayResults(model, results) {
  const summary = summarize(results);

  console.log('═'.repeat(60));
  console.log(`  ${model.name.toUpperCase()}`);
  if (model.description) {
    console.log(`  ${model.description}`);
  }
  console.log('═'.repeat(60));
  console.log('');

  // Time range
  console.log(`⏱️  Duration: ${summary.duration} time units`);
  console.log(`📈 Steps: ${results.time.length}`);
  console.log('');

  // Stock summary
  console.log('📊 STOCKS:\n');
  for (const [name, stats] of Object.entries(summary.stocks)) {
    const stockDef = model.stocks[name];
    const desc = stockDef.description || '';

    console.log(`  ${name}${desc ? ` - ${desc}` : ''}`);
    console.log(`    Initial: ${stats.initial.toFixed(2)}`);
    console.log(`    Final:   ${stats.final.toFixed(2)}`);
    console.log(`    Change:  ${stats.change >= 0 ? '+' : ''}${stats.change.toFixed(2)}`);
    console.log(`    Range:   [${stats.min.toFixed(2)}, ${stats.max.toFixed(2)}]`);

    // Sparkline
    const spark = sparkline(results.stocks[name], 50);
    console.log(`    ${spark}`);
    console.log('');
  }

  // Flow summary
  console.log('💧 FLOWS:\n');
  for (const [name, values] of Object.entries(results.flows)) {
    const flowDef = model.flows[name];
    const desc = flowDef.description || '';
    const avgRate = values.reduce((a, b) => a + b, 0) / values.length;

    console.log(`  ${name}${desc ? ` - ${desc}` : ''}`);
    console.log(`    Avg rate: ${avgRate.toFixed(2)}`);

    const spark = sparkline(values, 50);
    console.log(`    ${spark}`);
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('');
}

// ============================================================
// Display Functions — Projection
// ============================================================

function displayProjectionScenarios(result) {
  console.log('═'.repeat(60));
  console.log(`  SCENARIO COMPARISON — ${result.focusName.toUpperCase()} FORAGE (kg/ac)`);
  console.log('═'.repeat(60));

  for (const r of result.scenarios) {
    const change = r.endForage - r.startForage;
    const changeStr = change >= 0 ? `+${change.toFixed(0)}` : change.toFixed(0);
    const changePct = ((change / r.startForage) * 100).toFixed(0);

    console.log(`\n  ${r.name}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Start: ${r.startForage.toFixed(0)} → End: ${r.endForage.toFixed(0)} kg/ac (${changeStr}, ${changePct}%)`);
    console.log(`  Min: ${r.minForage.toFixed(0)} | Max: ${r.maxForage.toFixed(0)}`);
    console.log(`  ${sparkline(r.forage, 50)}`);

    // Milestones
    const milestones = [
      [500, r.daysTo500, 'Minimum viable'],
      [800, r.daysTo800, 'Low-marginal'],
      [1200, r.daysTo1200, 'Marginal-healthy'],
      [1500, r.daysTo1500, 'Healthy'],
    ];

    console.log('  Milestones:');
    for (const [threshold, days, label] of milestones) {
      if (r.startForage >= threshold) {
        console.log(`    ${label} (${threshold}): Already there`);
      } else if (days === -1) {
        console.log(`    ${label} (${threshold}): Not reached in ${result.days} days`);
      } else {
        console.log(`    ${label} (${threshold}): Day ${days}`);
      }
    }
  }
}

function displayProjectionTimeline(result) {
  console.log('\n\n' + '═'.repeat(60));
  console.log(`  TIMELINE — ${result.focusName.toUpperCase()} FORAGE AT KEY INTERVALS`);
  console.log('═'.repeat(60));

  const maxDay = result.days;
  const checkDays = [0, 7, 14, 21, 28, 42, 56, 70, 90].filter(d => d <= maxDay);

  console.log('\n  Day | Pure Recovery | Hay Supplement | No Supplement');
  console.log('  ----|---------------|----------------|---------------');

  for (const day of checkDays) {
    const idx = Math.min(day, result.scenarios[0].forage.length - 1);
    const a = result.scenarios[0].forage[idx].toFixed(0).padStart(13);
    const b = result.scenarios[1].forage[idx].toFixed(0).padStart(14);
    const c = result.scenarios[2].forage[idx].toFixed(0).padStart(13);
    console.log(`  ${String(day).padStart(3)} |${a} |${b} |${c}`);
  }
}

function displayProjectionEndState(result) {
  console.log('\n\n' + '═'.repeat(60));
  console.log(`  ALL-PADDOCK END STATE (Day ${result.days})`);
  console.log('═'.repeat(60));

  console.log('\n  Paddock             | Recovery | Hay Suppl. | No Suppl.');
  console.log('  --------------------|----------|------------|----------');
  for (const key of PADDOCK_KEYS) {
    const name = (PADDOCKS[key].name).padEnd(19);
    const a = result.scenarios[0].allEndState[`${key}_forage`].toFixed(0).padStart(8);
    const b = result.scenarios[1].allEndState[`${key}_forage`].toFixed(0).padStart(10);
    const c = result.scenarios[2].allEndState[`${key}_forage`].toFixed(0).padStart(9);
    console.log(`  ${name} |${a} |${b} |${c}`);
  }
}

function displayProjectionTakeaways(result) {
  const recoveryEnd = result.scenarios[0].endForage;
  const hayEnd = result.scenarios[1].endForage;
  const noHayEnd = result.scenarios[2].endForage;
  const haySavings = hayEnd - noHayEnd;

  console.log('\n\n  📋 KEY TAKEAWAYS:');
  console.log(`  • Hay supplement saves ${haySavings.toFixed(0)} kg/ac of forage over ${result.days} days vs. unsupplemented grazing`);
  console.log(`  • Pure recovery reaches ${recoveryEnd.toFixed(0)} kg/ac — ${((recoveryEnd - hayEnd) / recoveryEnd * 100).toFixed(0)}% more than hay-supplemented grazing`);

  if (hayEnd >= 1200) {
    console.log(`  • With hay supplement, ${result.focusName} reaches healthy levels by day ${result.days}`);
  } else if (hayEnd >= 800) {
    console.log(`  • With hay supplement, ${result.focusName} reaches marginal levels by day ${result.days}`);
  } else {
    console.log(`  • Even with hay supplement, ${result.focusName} stays low — consider moving herd off`);
  }
}

// ============================================================
// Display Functions — Planting
// ============================================================

function displayPlantingWindow(result) {
  const wa = result.windowAnalysis;

  console.log('  HISTORICAL PLANTING WINDOW ANALYSIS');
  console.log('  ' + '─'.repeat(50));

  if (result.season === 'cool') {
    console.log(`  Average cooldown below 70°F: ${wa.averages.cooldownDateApprox}`);
    console.log(`  Average Oct 15 – Nov 15 precip: ${wa.averages.windowPrecipMm} mm`);
    console.log('');
    console.log('  Year | Cooldown Date | Window Precip | First Frost');
    console.log('  -----|---------------|---------------|------------');
    for (const yr of wa.yearResults) {
      const cd = yr.cooldownDate ? yr.cooldownDate.slice(5) : '  N/A';
      const precip = `${yr.windowPrecip} mm`.padStart(13);
      const frost = yr.firstFrost ? yr.firstFrost.slice(5) : '  N/A';
      console.log(`  ${yr.year} | ${cd.padEnd(13)} |${precip} | ${frost}`);
    }
  } else {
    console.log(`  Average soil warm enough (>60°F): ${wa.averages.soilWarmDateApprox}`);
    console.log(`  Average May-Jun precip: ${wa.averages.windowPrecipMm} mm`);
    console.log('');
    console.log('  Year | Soil Warm Date | May-Jun Precip');
    console.log('  -----|----------------|---------------');
    for (const yr of wa.yearResults) {
      const wd = yr.soilWarmDate ? yr.soilWarmDate.slice(5) : '  N/A';
      const precip = `${yr.windowPrecip} mm`.padStart(14);
      console.log(`  ${yr.year} | ${wd.padEnd(14)} |${precip}`);
    }
  }
  console.log('');
}

function displayPaddockPlantingStatus(result) {
  console.log('  PADDOCK STATUS');
  console.log('  ' + '─'.repeat(50));
  console.log('  Paddock             | Status      | Plant Date | Days');
  console.log('  --------------------|-------------|------------|------');

  for (const p of result.paddockStatus) {
    const name = p.name.padEnd(19);
    const status = p.isPlanted ? 'Planted' : p.isPlanned ? 'Planned' : 'No data';
    const date = p.plantDate ? p.plantDate.slice(5) : '  N/A';
    const days = p.daysSincePlanting !== null ? String(p.daysSincePlanting).padStart(5) : '  N/A';
    console.log(`  ${name} | ${status.padEnd(11)} | ${date.padEnd(10)} |${days}`);
  }
  console.log('');
}

function displayPlantingScenarios(result) {
  console.log('  PLANTING DATE SCENARIOS');
  console.log('  ' + '─'.repeat(50));

  const header = result.season === 'cool' ? 'Cool-season' : 'Warm-season';
  console.log(`  ${header} establishment comparison:\n`);

  console.log('  Plant Date  | Grazeable | Wk 6  | Wk 8  | Wk 10 | Wk 12 | Peak Start');
  console.log('  ------------|-----------|-------|-------|-------|-------|----------');

  for (const s of result.scenarios) {
    const pd = s.plantDate.slice(5);
    const grazeDays = s.daysToGrazeable !== null ? `Day ${s.daysToGrazeable}`.padEnd(9) : 'N/A'.padEnd(9);
    const wk6 = s.weekMultipliers.week6 !== null ? s.weekMultipliers.week6.toFixed(2).padStart(5) : '  N/A';
    const wk8 = s.weekMultipliers.week8 !== null ? s.weekMultipliers.week8.toFixed(2).padStart(5) : '  N/A';
    const wk10 = s.weekMultipliers.week10 !== null ? s.weekMultipliers.week10.toFixed(2).padStart(5) : '  N/A';
    const wk12 = s.weekMultipliers.week12 !== null ? s.weekMultipliers.week12.toFixed(2).padStart(5) : '  N/A';
    const peak = s.peakStartDate ? s.peakStartDate.slice(5) : '  N/A';

    console.log(`  ${pd.padEnd(11)} | ${grazeDays} | ${wk6} | ${wk8} | ${wk10} | ${wk12} | ${peak}`);
  }

  // Sparkline comparison of combined growth multipliers
  console.log('\n  Growth trajectory (temp × lifecycle):');
  for (const s of result.scenarios) {
    const label = s.plantDate.slice(5).padEnd(6);
    console.log(`    ${label} ${sparkline(s.combined.slice(0, 90), 45)}`);
  }
  console.log('');
}

function displayTransitionGap(result) {
  console.log('  TRANSITION GAP ANALYSIS (Cool → Warm)');
  console.log('  ' + '─'.repeat(50));
  console.log('  Paddock             | Cool Dies  | Warm Ready | Gap    | Severity');
  console.log('  --------------------|------------|------------|--------|----------');

  for (const g of result.transitionGap) {
    if (g.error) {
      console.log(`  ${g.name.padEnd(19)} | ${g.error}`);
      continue;
    }
    const name = g.name.padEnd(19);
    const coolDies = g.coolDeath ? g.coolDeath.slice(5) : 'N/A';
    const warmReady = g.warmGrazeReady ? g.warmGrazeReady.slice(5) : 'N/A';
    const gap = g.gapDays !== null ? `${g.gapDays}d`.padStart(6) : '  N/A';
    const severity = (g.gapSeverity || 'unknown').padEnd(12);
    console.log(`  ${name} | ${coolDies.padEnd(10)} | ${warmReady.padEnd(10)} | ${gap} | ${severity}`);
  }

  // Summary
  const gaps = result.transitionGap.filter(g => g.gapDays !== null);
  if (gaps.length > 0) {
    const maxGap = Math.max(...gaps.map(g => g.gapDays));
    const minGap = Math.min(...gaps.map(g => g.gapDays));
    console.log(`\n  Gap range: ${minGap}-${maxGap} days across paddocks`);
    if (maxGap > 30) {
      console.log('  Consider: interseeding warm-season into cool-season stands in late April');
      console.log('  to reduce the transition gap, or plan hay reserves for the gap period.');
    }
  }
  console.log('');
}
