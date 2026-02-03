/**
 * lib/model-loader.js
 *
 * Simple YAML model loader (basic parser, no external dependencies)
 */

import fs from 'fs';

/**
 * Load and parse a simple YAML model file
 * Note: This is a basic parser that handles the subset of YAML we use
 *
 * @param {string} filepath - Path to YAML model file
 * @returns {object} Parsed model
 */
export function loadModel(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');

  const model = {
    name: '',
    description: '',
    params: {},
    stocks: {},
    flows: {},
  };

  let currentSection = null;
  let currentKey = null;
  let currentFlow = null;
  let multilineValue = '';
  let inMultiline = false;

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // Check for main sections
    if (trimmed === 'params:') {
      currentSection = 'params';
      continue;
    }
    if (trimmed === 'stocks:') {
      currentSection = 'stocks';
      continue;
    }
    if (trimmed === 'flows:') {
      currentSection = 'flows';
      continue;
    }

    // Parse name and description
    if (trimmed.startsWith('name:')) {
      model.name = trimmed.split('name:')[1].trim();
      continue;
    }
    if (trimmed.startsWith('description:')) {
      model.description = trimmed.split('description:')[1].trim();
      continue;
    }

    // Handle multiline strings (rate expressions)
    if (trimmed === 'rate: |' || trimmed === 'rate: >') {
      inMultiline = true;
      multilineValue = '';
      continue;
    }

    if (inMultiline) {
      // Check if we're done with multiline (next key or flow starts)
      if (line.match(/^  \w+:/) || line.match(/^  [a-z_]+_\w+:/)) {
        // Save the multiline value
        if (currentFlow) {
          model.flows[currentFlow].rate = multilineValue.trim();
        }
        inMultiline = false;
        // Process this line normally below
      } else {
        // Continue collecting multiline content
        multilineValue += line.replace(/^    /, '') + '\n';  // Remove 4-space indent
        continue;
      }
    }

    // Parse sections
    if (currentSection === 'params') {
      const match = line.match(/^  ([a-z_]+):\s*(.+)/);
      if (match) {
        const [, key, value] = match;
        model.params[key] = parseValue(value);
      }
    }

    if (currentSection === 'stocks') {
      // Stock name
      if (line.match(/^  ([a-z_]+):/)) {
        currentKey = line.match(/^  ([a-z_]+):/)[1];
        model.stocks[currentKey] = {};
      }
      // Stock properties
      else if (line.match(/^    (initial|min|max):\s*(.+)/)) {
        const [, prop, value] = line.match(/^    (initial|min|max):\s*(.+)/);
        model.stocks[currentKey][prop] = parseValue(value);
      }
    }

    if (currentSection === 'flows') {
      // Flow name
      if (line.match(/^  ([a-z_]+):/)) {
        currentFlow = line.match(/^  ([a-z_]+):/)[1];
        model.flows[currentFlow] = {};
      }
      // Flow properties
      else if (line.match(/^    (from|to):\s*(.+)/)) {
        const [, prop, value] = line.match(/^    (from|to):\s*(.+)/);
        model.flows[currentFlow][prop] = value.trim();
      }
      else if (line.match(/^    rate:\s*"(.+)"/)) {
        const [, value] = line.match(/^    rate:\s*"(.+)"/);
        model.flows[currentFlow].rate = value;
      }
      else if (line.match(/^    rate:\s*(.+)/) && !line.includes('|')) {
        const [, value] = line.match(/^    rate:\s*(.+)/);
        model.flows[currentFlow].rate = value;
      }
    }
  }

  return model;
}

function parseValue(str) {
  str = str.trim();

  // Remove comments
  if (str.includes('#')) {
    str = str.split('#')[0].trim();
  }

  // Boolean
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Number
  if (!isNaN(str) && str !== '') {
    return Number(str);
  }

  // String
  return str;
}
