import { ErrorCodes } from '@dualsurf/ipc-protocol';

const isTTY = Boolean(process.stdout && process.stdout.isTTY);

export const colors = {
  reset: isTTY ? '\x1b[0m' : '',
  bold: isTTY ? '\x1b[1m' : '',
  dim: isTTY ? '\x1b[2m' : '',
  red: isTTY ? '\x1b[31m' : '',
  green: isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  cyan: isTTY ? '\x1b[36m' : '',
};

export function formatResult(data: unknown, asJson = false): string {
  if (asJson) {
    return JSON.stringify(data, null, 2);
  }

  if (data === null || data === undefined) {
    return `${colors.dim}(no output)${colors.reset}`;
  }

  if (typeof data === 'boolean' || typeof data === 'number') {
    return String(data);
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${colors.dim}(empty)${colors.reset}`;
    }

    // Check if array of flat objects for table formatting
    const allObjects = data.every(
      (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
    );

    if (allObjects) {
      return formatTable(data as Record<string, unknown>[]);
    }

    return data.map((item) => `- ${formatResult(item, false)}`).join('\n');
  }

  if (typeof data === 'object') {
    return formatObject(data as Record<string, unknown>);
  }

  return String(data);
}

function formatTable(rows: Record<string, unknown>[]): string {
  // Collect all unique keys
  const keysSet = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keysSet.add(key);
    }
  }
  const headers = Array.from(keysSet);
  if (headers.length === 0) return `${colors.dim}(empty)${colors.reset}`;

  // Truncate cell text at 60 characters
  const truncate = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    str = str.replace(/\r?\n/g, ' ');
    if (str.length > 60) {
      return str.slice(0, 57) + '...';
    }
    return str;
  };

  // Calculate column widths
  const colWidths: Record<string, number> = {};
  for (const h of headers) {
    colWidths[h] = h.length;
  }

  const tableData: Record<string, string>[] = [];
  for (const row of rows) {
    const formattedRow: Record<string, string> = {};
    for (const h of headers) {
      const text = truncate(row[h]);
      formattedRow[h] = text;
      colWidths[h] = Math.max(colWidths[h], text.length);
    }
    tableData.push(formattedRow);
  }

  // Format header row
  const headerLine = headers
    .map((h) => `${colors.bold}${h.padEnd(colWidths[h])}${colors.reset}`)
    .join('  ');

  // Format separator line
  const separatorLine = headers
    .map((h) => `${colors.dim}${'-'.repeat(colWidths[h])}${colors.reset}`)
    .join('  ');

  // Format data rows
  const rowLines = tableData.map((row) =>
    headers.map((h) => row[h].padEnd(colWidths[h])).join('  ')
  );

  return [headerLine, separatorLine, ...rowLines].join('\n');
}

function formatObject(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent);
  const keys = Object.keys(obj);
  if (keys.length === 0) return `${pad}${colors.dim}(empty object)${colors.reset}`;

  const lines: string[] = [];

  for (const key of keys) {
    const val = obj[key];

    if (val === null || val === undefined) {
      lines.push(`${pad}${colors.cyan}${key}:${colors.reset} ${colors.dim}null${colors.reset}`);
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${pad}${colors.cyan}${key}:${colors.reset} ${colors.dim}[]${colors.reset}`);
      } else if (val.every((item) => typeof item !== 'object' || item === null)) {
        lines.push(
          `${pad}${colors.cyan}${key}:${colors.reset} [${val.map(String).join(', ')}]`
        );
      } else {
        lines.push(`${pad}${colors.cyan}${key}:${colors.reset}`);
        for (const item of val) {
          if (typeof item === 'object' && item !== null) {
            lines.push(formatObject(item as Record<string, unknown>, indent + 1));
            lines.push(`${pad}  ${colors.dim}---${colors.reset}`);
          } else {
            lines.push(`${pad}  - ${item}`);
          }
        }
      }
    } else if (typeof val === 'object') {
      lines.push(`${pad}${colors.cyan}${key}:${colors.reset}`);
      lines.push(formatObject(val as Record<string, unknown>, indent + 1));
    } else {
      lines.push(`${pad}${colors.cyan}${key}:${colors.reset} ${val}`);
    }
  }

  return lines.join('\n');
}

export function formatError(err: any): string {
  const code = err?.code ?? ErrorCodes.COMMAND_FAILED;
  const message = err?.message || 'Command failed';

  const lines = [`${colors.red}error [${code}]:${colors.reset} ${message}`];

  if (err?.data?.issues && Array.isArray(err.data.issues)) {
    for (const issue of err.data.issues) {
      lines.push(`  - ${colors.yellow}${issue.field}:${colors.reset} ${issue.message}`);
    }
  }

  if (err?.data?.reason) {
    lines.push(`  ${colors.dim}Reason:${colors.reset} ${err.data.reason}`);
  }

  return lines.join('\n');
}
