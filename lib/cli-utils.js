/**
 * lib/cli-utils.js
 *
 * Shared CLI utilities for sysdyn command-line tools.
 * Extracted from bin/rotation.js to avoid duplication across CLIs.
 */

/**
 * Parse --flag value pairs from command arguments.
 *
 * Handles three patterns:
 *   --key value   → { key: "value" }
 *   --flag        → { flag: true }
 *   positional    → ignored (caller handles positional args separately)
 *
 * @param {string[]} args - Command line arguments (after command word)
 * @returns {Object} Parsed options { key: value, flag: true, ... }
 */
export function parseOptions(args) {
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
