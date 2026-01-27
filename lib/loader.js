/**
 * Model loader - parse YAML model definitions
 *
 * YAML is nice for humans to read and write. It's like JSON but with
 * less punctuation. Perfect for model definitions.
 *
 * We're using a simple YAML parser - no external dependencies.
 * For complex YAML, you'd want the 'yaml' package from npm.
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, basename } from 'path';

// ============================================================
// Simple YAML Parser
// ============================================================

/**
 * Parse a simple YAML string into an object.
 *
 * Supports:
 * - Key: value pairs
 * - Nested objects (indentation)
 * - Numbers, strings, booleans
 * - Comments (#)
 *
 * Does NOT support:
 * - Arrays with - syntax (we'll use a different approach)
 * - Multi-line strings
 * - Complex YAML features
 *
 * For our model format, this is sufficient.
 */
export function parseYAML(yamlString) {
  const lines = yamlString.split('\n');
  const result = {};
  const stack = [{ indent: -1, obj: result }];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    // Calculate indentation
    const indent = line.search(/\S/);
    const content = line.trim();

    // Pop stack until we find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Parse key: value
    const colonIndex = content.indexOf(':');
    if (colonIndex === -1) {
      continue; // Skip lines without colons
    }

    const key = content.substring(0, colonIndex).trim();
    const valueStr = content.substring(colonIndex + 1).trim();

    if (valueStr === '' || valueStr === '|') {
      // Nested object or multi-line string
      const newObj = {};
      parent[key] = newObj;
      stack.push({ indent, obj: newObj });
    } else {
      // Simple value
      parent[key] = parseValue(valueStr);
    }
  }

  return result;
}

/**
 * Parse a YAML value string into appropriate type.
 */
function parseValue(str) {
  // Remove quotes if present
  if ((str.startsWith('"') && str.endsWith('"')) ||
      (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }

  // Boolean
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Null
  if (str === 'null' || str === '~') return null;

  // Number
  const num = Number(str);
  if (!isNaN(num) && str !== '') {
    return num;
  }

  // String (default)
  return str;
}

/**
 * Convert object to YAML string.
 */
export function toYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      yaml += toYAML(value, indent + 1);
    } else if (typeof value === 'string' && value.includes('\n')) {
      yaml += `${spaces}${key}: |\n`;
      for (const line of value.split('\n')) {
        yaml += `${'  '.repeat(indent + 1)}${line}\n`;
      }
    } else if (typeof value === 'string' && /[:#\[\]{}]/.test(value)) {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

// ============================================================
// Model File Operations
// ============================================================

/**
 * Get the models directory path.
 */
export function getModelsDir() {
  // Models stored in the sysdyn project
  return join(process.env.HOME, 'lab', 'sysdyn', 'models');
}

/**
 * Load a model from file.
 */
export async function loadModel(nameOrPath) {
  let filepath;

  if (nameOrPath.endsWith('.yaml') || nameOrPath.endsWith('.yml')) {
    filepath = nameOrPath;
  } else {
    filepath = join(getModelsDir(), `${nameOrPath}.yaml`);
  }

  if (!existsSync(filepath)) {
    throw new Error(`Model not found: ${filepath}`);
  }

  const content = await readFile(filepath, 'utf-8');
  const model = parseYAML(content);

  // Ensure model has a name
  if (!model.name) {
    model.name = basename(filepath, '.yaml');
  }

  return model;
}

/**
 * Save a model to file.
 */
export async function saveModel(model, nameOrPath) {
  let filepath;

  if (nameOrPath.endsWith('.yaml') || nameOrPath.endsWith('.yml')) {
    filepath = nameOrPath;
  } else {
    filepath = join(getModelsDir(), `${nameOrPath}.yaml`);
  }

  const yaml = toYAML(model);
  await writeFile(filepath, yaml);

  return filepath;
}

/**
 * List available models.
 */
export async function listModels() {
  const modelsDir = getModelsDir();

  if (!existsSync(modelsDir)) {
    return [];
  }

  const files = await readdir(modelsDir);
  return files
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => basename(f, '.yaml').replace('.yml', ''));
}

/**
 * Create a new model scaffold.
 */
export function createModelScaffold(name, template = 'basic') {
  const templates = {
    basic: {
      name,
      description: `A system dynamics model: ${name}`,
      params: {
        example_param: 0.1,
      },
      stocks: {
        example_stock: {
          initial: 100,
          description: 'An example stock',
        },
      },
      flows: {
        example_flow: {
          from: 'example_stock',
          to: 'external',
          rate: 'example_stock * example_param',
          description: 'An example outflow',
        },
      },
    },

    growth: {
      name,
      description: 'Exponential growth model',
      params: {
        growth_rate: 0.05,
      },
      stocks: {
        population: {
          initial: 100,
          description: 'Population size',
        },
      },
      flows: {
        births: {
          from: 'external',
          to: 'population',
          rate: 'population * growth_rate',
          description: 'New individuals',
        },
      },
    },

    decay: {
      name,
      description: 'Exponential decay model',
      params: {
        decay_rate: 0.1,
      },
      stocks: {
        quantity: {
          initial: 1000,
          description: 'Quantity remaining',
        },
      },
      flows: {
        decay: {
          from: 'quantity',
          to: 'external',
          rate: 'quantity * decay_rate',
          description: 'Loss rate',
        },
      },
    },
  };

  return templates[template] || templates.basic;
}
