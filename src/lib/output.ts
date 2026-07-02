import pc from 'picocolors';
import { loadConfig, resolveApiKey, resolveEnvironment } from './config.js';
import { BunceClient, BunceApiError } from './client.js';

let globalProfile: string | undefined;

/** Set once from the root --profile option so every command can target it. */
export function setGlobalProfile(name: string | undefined): void {
  globalProfile = name;
}

/** Builds an authenticated client or exits with a helpful message. */
export function requireClient(
  opts: { env?: string; profile?: string } = {},
): BunceClient {
  const config = loadConfig();
  const profile = opts.profile ?? globalProfile;
  const apiKey = resolveApiKey(config, profile);
  if (!apiKey) {
    const hint = profile
      ? `Profile "${profile}" not found. Run \`bunce profile add ${profile}\`.`
      : 'Not authenticated. Run `bunce auth login`, add a profile, or set BUNCE_API_KEY.';
    fail(hint);
  }
  const environment =
    opts.env === 'live' || opts.env === 'sandbox'
      ? opts.env
      : resolveEnvironment(config, profile);
  return new BunceClient({ apiKey: apiKey!, environment });
}

export function print(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else {
    process.stdout.write(formatHuman(data) + '\n');
  }
}

export function success(message: string): void {
  process.stdout.write(pc.green('✓ ') + message + '\n');
}

export function info(message: string): void {
  process.stdout.write(pc.dim(message) + '\n');
}

/** Prints an error to stderr and exits non-zero. Never returns. */
export function fail(message: string, code = 1): never {
  process.stderr.write(pc.red('✗ ') + message + '\n');
  process.exit(code);
}

export function handleError(err: unknown): never {
  if (err instanceof BunceApiError) {
    const detail =
      err.body && typeof err.body === 'object'
        ? '\n' + JSON.stringify(err.body, null, 2)
        : '';
    fail(`${err.message}${err.status ? ` (HTTP ${err.status})` : ''}${detail}`);
  }
  fail((err as Error)?.message ?? String(err));
}

function formatHuman(data: unknown): string {
  if (Array.isArray(data)) {
    return data.map((row) => formatRecord(row)).join('\n\n');
  }
  return formatRecord(data);
}

function formatRecord(record: unknown): string {
  if (record === null || typeof record !== 'object') return String(record);
  return Object.entries(record as Record<string, unknown>)
    .map(
      ([k, v]) =>
        `${pc.bold(k)}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
    )
    .join('\n');
}
