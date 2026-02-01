#!/usr/bin/env node

/**
 * Rotation Management CLI
 *
 * Commands:
 *   rotation status     - Show current paddock and history
 *   rotation move <id>  - Log move to new paddock
 *   rotation event <type> - Log an event
 *
 * Examples:
 *   rotation status
 *   rotation move hog --notes "Good forage, creek moisture"
 *   rotation move cce --hay "Drought conditions"
 *   rotation event seeding --paddock south --notes "Winter rye mix"
 *   rotation event rain --amount 25 --notes "First good rain in weeks"
 */

import {
  loadRotationHistory,
  getCurrentPaddock,
  logMove,
  logEvent,
  displayRotationHistory
} from '../lib/rotation.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'status':
      case undefined:
        await displayRotationHistory();
        break;

      case 'move':
        await handleMove(args.slice(1));
        break;

      case 'event':
        await handleEvent(args.slice(1));
        break;

      case 'current':
        const current = await getCurrentPaddock();
        console.log(`\n📍 Current: ${current.name}`);
        console.log(`   Since: ${current.since} (${current.daysSince} days ago)\n`);
        break;

      case 'help':
        showHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function handleMove(args) {
  if (args.length === 0) {
    console.error('Usage: rotation move <paddock-id> [--notes "..."] [--hay]');
    console.error('Paddock IDs: cce, ccw, big, hog, south');
    process.exit(1);
  }

  const paddockId = args[0];
  const options = parseOptions(args.slice(1));

  // Handle --hay flag
  if (options.hay !== undefined) {
    options.hayFed = true;
    if (typeof options.hay === 'string') {
      options.notes = options.hay;
    }
    delete options.hay;
  }

  const result = await logMove(paddockId, options);

  console.log(`\n✅ Logged move to ${result.name}`);
  console.log(`   Date: ${result.start}`);
  if (result.hayFed) console.log('   🌾 Hay feeding noted');
  if (result.notes) console.log(`   Notes: ${result.notes}`);
  console.log('');
}

async function handleEvent(args) {
  if (args.length === 0) {
    console.error('Usage: rotation event <type> [--paddock <id>] [--notes "..."] [--amount <mm>]');
    console.error('Event types: seeding, rain, ice_storm, drought_start, drought_end, hay_delivery, vet_visit, fence_repair');
    process.exit(1);
  }

  const type = args[0];
  const options = parseOptions(args.slice(1));

  const result = await logEvent(type, options);

  console.log(`\n✅ Logged event: ${type}`);
  console.log(`   Date: ${result.date}`);
  if (result.paddock) console.log(`   Paddock: ${result.paddock}`);
  if (result.notes) console.log(`   Notes: ${result.notes}`);
  console.log('');
}

function parseOptions(args) {
  const options = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      // Check if next arg is a value or another flag
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i += 2;
      } else {
        options[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
🔄 ROTATION MANAGEMENT CLI

Commands:
  rotation status       Show current paddock and full history
  rotation current      Show only current paddock
  rotation move <id>    Log move to new paddock
  rotation event <type> Log an event (weather, seeding, etc.)
  rotation help         Show this help

Move Examples:
  rotation move hog
  rotation move hog --notes "Good forage, creek moisture"
  rotation move cce --hay "Drought conditions, supplementing"

Event Examples:
  rotation event seeding --paddock south --notes "Winter rye mix"
  rotation event rain --amount 25 --notes "First good rain"
  rotation event ice_storm --notes "Light damage, roots intact"

Paddock IDs:
  cce    Cedar Crest East
  ccw    Cedar Crest West
  big    Big Pasture
  hog    Hog Pasture
  south  Frankie's Pasture

Event Types:
  seeding, rain, ice_storm, drought_start, drought_end,
  hay_delivery, vet_visit, fence_repair
`);
}

main();
