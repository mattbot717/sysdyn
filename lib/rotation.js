/**
 * lib/rotation.js
 *
 * Rotation history tracking and management
 *
 * Provides persistent storage for herd movements, events, and paddock status.
 * All data stored in data/rotation-history.json
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { VALID_EVENT_TYPES, getEventIcon as getEventIconFromConfig, PADDOCKS } from './config.js';

const HISTORY_PATH = join(__dirname, '../data/rotation-history.json');

/**
 * Load rotation history from JSON file
 * @returns {Promise<Object>} Full rotation history object
 */
export async function loadRotationHistory() {
  const raw = await readFile(HISTORY_PATH, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Save rotation history to JSON file
 * @param {Object} history - Full rotation history object (not mutated)
 */
export async function saveRotationHistory(history) {
  // Clone to avoid mutating the input object
  const toSave = JSON.parse(JSON.stringify(history));
  toSave.metadata.lastUpdated = new Date().toISOString().split('T')[0];
  await writeFile(HISTORY_PATH, JSON.stringify(toSave, null, 2));
}

/**
 * Get current paddock info
 * @returns {Promise<Object>} { id, name, since, daysSince }
 */
export async function getCurrentPaddock() {
  const history = await loadRotationHistory();
  const current = history.currentPaddock;

  const since = new Date(current.since);
  const today = new Date();
  const daysSince = Math.floor((today - since) / (1000 * 60 * 60 * 24));

  return {
    ...current,
    daysSince
  };
}

/**
 * Log a herd move to a new paddock
 * @param {string} paddockId - Paddock ID (cce, ccw, big, hog, south)
 * @param {Object} options - { notes, hayFed }
 */
export async function logMove(paddockId, options = {}) {
  const history = await loadRotationHistory();
  const today = new Date().toISOString().split('T')[0];

  // Validate paddock ID
  if (!history.metadata.paddocks[paddockId]) {
    throw new Error(`Unknown paddock: ${paddockId}. Valid: ${Object.keys(history.metadata.paddocks).join(', ')}`);
  }

  // Close out current rotation
  const lastRotation = history.rotations[history.rotations.length - 1];
  if (lastRotation && lastRotation.end === null) {
    lastRotation.end = today;
    const start = new Date(lastRotation.start);
    const end = new Date(lastRotation.end);
    lastRotation.days = Math.floor((end - start) / (1000 * 60 * 60 * 24));
  }

  // Add new rotation
  const newRotation = {
    paddock: paddockId,
    name: history.metadata.paddocks[paddockId],
    start: today,
    end: null,
    days: null,
    hayFed: options.hayFed || false,
    notes: options.notes || ''
  };
  history.rotations.push(newRotation);

  // Update current paddock
  history.currentPaddock = {
    id: paddockId,
    name: history.metadata.paddocks[paddockId],
    since: today
  };

  await saveRotationHistory(history);

  return newRotation;
}

/**
 * Log an event (seeding, weather, hay feeding, etc.)
 * @param {string} type - Event type (must be in VALID_EVENT_TYPES)
 * @param {Object} options - { paddock, notes, amount_mm, ... }
 * @throws {Error} If type is not a valid event type
 */
export async function logEvent(type, options = {}) {
  // Validate event type
  if (!VALID_EVENT_TYPES.includes(type)) {
    throw new Error(`Unknown event type: "${type}". Valid types: ${VALID_EVENT_TYPES.join(', ')}`);
  }

  const history = await loadRotationHistory();
  const today = new Date().toISOString().split('T')[0];

  const event = {
    date: options.date || today,
    type,
    ...options
  };
  delete event.date; // Remove if was in options
  event.date = options.date || today; // Re-add at start

  history.events.push(event);
  await saveRotationHistory(history);

  return event;
}

/**
 * Get rotation schedule as array for simulation
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @returns {Promise<Array>} Schedule with { paddock, name, startDay, duration }
 */
export async function getRotationSchedule(startDate) {
  const history = await loadRotationHistory();
  const start = new Date(startDate + 'T12:00:00Z');

  const schedule = [];

  for (const rotation of history.rotations) {
    const rotStart = new Date(rotation.start + 'T12:00:00Z');
    const rotEnd = rotation.end ? new Date(rotation.end + 'T12:00:00Z') : new Date();

    // Skip rotations before our start date
    if (rotEnd < start) continue;

    // Calculate day offset from start date
    const startDay = Math.max(0, Math.floor((rotStart - start) / (1000 * 60 * 60 * 24)));
    const duration = rotation.days || Math.floor((rotEnd - rotStart) / (1000 * 60 * 60 * 24));

    // Map paddock ID to number (for legacy compatibility)
    const paddockMap = { cce: 1, ccw: 2, big: 3, hog: 4, south: 5 };

    schedule.push({
      paddock: paddockMap[rotation.paddock],
      paddockId: rotation.paddock,
      name: rotation.name,
      startDay,
      duration,
      hayFed: rotation.hayFed
    });
  }

  return schedule;
}

/**
 * Get events within a date range
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Events in range
 */
export async function getEvents(startDate, endDate) {
  const history = await loadRotationHistory();

  return history.events.filter(e => {
    return e.date >= startDate && e.date <= endDate;
  });
}

/**
 * Display rotation history summary
 */
export async function displayRotationHistory() {
  const history = await loadRotationHistory();
  const current = await getCurrentPaddock();

  console.log('\n🔄 ROTATION HISTORY');
  console.log('════════════════════════════════════════════════════════\n');

  console.log(`📍 CURRENT: ${current.name} (${current.daysSince} days)\n`);

  console.log('ROTATION LOG:\n');
  for (const rot of history.rotations) {
    const hayIcon = rot.hayFed ? '🌾' : '  ';
    const endStr = rot.end || 'ongoing';
    const daysStr = rot.days ? `${rot.days}d` : '...';
    console.log(`  ${hayIcon} ${rot.start} → ${endStr} (${daysStr}): ${rot.name}`);
    if (rot.notes) {
      console.log(`      └─ ${rot.notes}`);
    }
  }

  console.log('\nEVENTS:\n');
  for (const event of history.events) {
    const icon = getEventIcon(event.type);
    console.log(`  ${icon} ${event.date}: ${event.type}`);
    if (event.notes) {
      console.log(`      └─ ${event.notes}`);
    }
  }

  console.log('\n════════════════════════════════════════════════════════\n');
}

// Re-export getEventIcon from config for internal use
const getEventIcon = getEventIconFromConfig;
