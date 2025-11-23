/**
 * Argument parser for dprint-js CLI
 */

/**
 * Parse command line arguments with support for flags, options, and positional arguments
 */
export function parseArgs(args) {
  const result = {
    command: null,
    positional: [],
    options: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // First non-flag argument is the command
    if (!result.command && !arg.startsWith("-")) {
      result.command = arg;
      i++;
      continue;
    }

    // Handle help flag
    if (arg === "-h" || arg === "--help") {
      result.options.help = true;
      i++;
      continue;
    }

    // Handle -- separator (all remaining are positional)
    if (arg === "--") {
      i++;
      result.positional.push(...args.slice(i));
      break;
    }

    // Handle --flag=value syntax
    if (arg.startsWith("--") && arg.includes("=")) {
      const [flag, ...valueParts] = arg.split("=");
      const value = valueParts.join("=");
      const key = kebabToCamel(flag.slice(2));
      result.options[key] = parseValue(value);
      i++;
      continue;
    }

    // Handle short flags (-c, -L)
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length === 2) {
      const flag = arg.slice(1);
      const key = flagToKey(flag);

      // Check if next arg is a value or another flag
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        result.options[key] = args[i + 1];
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
      continue;
    }

    // Handle long flags (--config, --includes-override)
    if (arg.startsWith("--")) {
      const flag = arg.slice(2);
      const key = kebabToCamel(flag);

      // Check if this is a variadic flag (takes multiple values)
      const variadicFlags = ["includesOverride", "excludes", "excludesOverride", "plugins"];

      if (variadicFlags.includes(key)) {
        result.options[key] = result.options[key] || [];
        // Collect all values until next flag
        i++;
        while (i < args.length && !args[i].startsWith("-")) {
          result.options[key].push(args[i]);
          i++;
        }
        continue;
      }

      // Check if next arg is a value
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        result.options[key] = parseValue(args[i + 1]);
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
      continue;
    }

    // Positional argument
    result.positional.push(arg);
    i++;
  }

  return result;
}

/**
 * Map short flags to their long form keys
 */
function flagToKey(flag) {
  const mapping = {
    "c": "config",
    "L": "logLevel",
    "h": "help",
  };
  return mapping[flag] || flag;
}

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse a value string to appropriate type
 */
function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}
