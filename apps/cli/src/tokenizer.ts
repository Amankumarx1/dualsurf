/**
 * Tokenizes a command line string supporting single quotes, double quotes,
 * and backslash escape sequences. Throws an error on unterminated quote.
 */
export function tokenizeCommandLine(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inDoubleQuote = false;
  let inSingleQuote = false;
  let isEscaping = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (isEscaping) {
      current += char;
      isEscaping = false;
      continue;
    }

    if (char === '\\') {
      isEscaping = true;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === ' ' || char === '\t') {
      if (inDoubleQuote || inSingleQuote) {
        current += char;
      } else if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (isEscaping) {
    current += '\\';
  }

  if (inDoubleQuote || inSingleQuote) {
    throw new Error('Unterminated quote in command input');
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

function parseValue(val: string): unknown {
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return val;
    }
  }
  return val;
}

/**
 * Parses tokens into a structured dictionary matching command positional parameter declarations.
 */
export function parseTokensToInput(
  tokens: string[],
  positionalNames: string[] = []
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const positionals: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Case 1: --key=value
    if (token.startsWith('--') && token.includes('=')) {
      const eqIdx = token.indexOf('=');
      const key = token.slice(2, eqIdx).trim();
      const val = token.slice(eqIdx + 1);

      if (!IDENTIFIER_REGEX.test(key)) {
        throw new Error(`Invalid parameter flag name: '--${key}'`);
      }
      if (key in result) {
        throw new Error(`Duplicate parameter provided: '--${key}'`);
      }
      result[key] = parseValue(val);
      continue;
    }

    // Case 2: --key or --key value
    if (token.startsWith('--')) {
      const key = token.slice(2).trim();
      if (!IDENTIFIER_REGEX.test(key)) {
        throw new Error(`Invalid parameter flag name: '--${key}'`);
      }
      if (key in result) {
        throw new Error(`Duplicate parameter provided: '--${key}'`);
      }

      // Check if next token is a value (not another flag)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('--')) {
        result[key] = parseValue(tokens[i + 1]);
        i++;
      } else {
        // Bare flag means true
        result[key] = true;
      }
      continue;
    }

    // Case 3: key=value (only when key is a plain identifier so URLs are not misread)
    if (token.includes('=')) {
      const eqIdx = token.indexOf('=');
      const candidateKey = token.slice(0, eqIdx);
      if (IDENTIFIER_REGEX.test(candidateKey)) {
        const val = token.slice(eqIdx + 1);
        if (candidateKey in result) {
          throw new Error(`Duplicate parameter provided: '${candidateKey}'`);
        }
        result[candidateKey] = parseValue(val);
        continue;
      }
    }

    // Case 4: Leftover positional argument
    positionals.push(token);
  }

  // Map positionals to declared positional argument names
  for (let idx = 0; idx < positionals.length; idx++) {
    const val = positionals[idx];
    if (idx < positionalNames.length) {
      const name = positionalNames[idx];
      if (name in result) {
        throw new Error(
          `Parameter '${name}' was provided both as a named flag and as a positional argument`
        );
      }
      result[name] = parseValue(val);
    } else {
      throw new Error(
        `Unexpected extra positional argument: '${val}' (command expects ${positionalNames.length} positionals: ${positionalNames.join(', ') || 'none'})`
      );
    }
  }

  return result;
}
