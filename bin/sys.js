#!/usr/bin/env node

/**
 * sysdyn CLI
 *
 * Command-line interface for system dynamics modeling.
 *
 * Usage:
 *   sys run <model>          Run a simulation
 *   sys list                 List available models
 *   sys new <name>           Create a new model
 *   sys validate <model>     Validate a model
 *   sys help                 Show this help
 */

import { simulate, validateModel, summarize, sparkline } from '../lib/engine.js';
import { loadModel, listModels, saveModel, createModelScaffold } from '../lib/loader.js';
import { startServer } from '../lib/web/server.js';

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
  sys run <model> [steps] [dt]    Run a simulation (CLI output)
  sys serve <model> [port]        Launch web dashboard
  sys list                        List available models
  sys new <name> [template]       Create a new model
  sys validate <model>            Validate a model
  sys help                        Show this help

EXAMPLES:
  sys run farm-water              Run the farm-water model
  sys run farm-water 200 0.5      Run 200 steps with dt=0.5
  sys serve farm-water            Open interactive dashboard
  sys serve farm-water 8080       Use custom port
  sys list                        Show all models
  sys new irrigation basic        Create a new basic model
  sys validate farm-water         Check model for errors

TEMPLATES:
  basic     Simple stock and flow
  growth    Exponential growth
  decay     Exponential decay

MODELS:
  Models are stored in: ~/lab/sysdyn/models/
  Use YAML format for easy editing

LEARN MORE:
  cat ~/lab/sysdyn/README.md
  cat ~/lab/sysdyn/docs/ADVANCED.md
  cat ~/lab/sysdyn/docs/ROADMAP.md

`);
}

// ============================================================
// Display Functions
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
