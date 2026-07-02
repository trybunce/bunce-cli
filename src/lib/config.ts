import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from 'node:fs';

export type Environment = 'live' | 'sandbox';

export interface Profile {
  apiKey: string;
  environment: Environment;
}

export interface BunceConfig {
  activeProfile?: string;
  profiles?: Record<string, Profile>;
  // Legacy top-level credentials (pre-profiles). Treated as a default profile.
  apiKey?: string;
  environment?: Environment;
}

const CONFIG_DIR =
  process.env.BUNCE_CONFIG_DIR ??
  join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'bunce');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function loadConfig(): BunceConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as BunceConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: BunceConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
}

export function clearConfig(): void {
  if (existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, '{}', { mode: 0o600 });
  }
}

export function configPath(): string {
  return CONFIG_PATH;
}

/** Returns the named profiles, folding any legacy top-level credential into "default". */
export function listProfiles(config: BunceConfig): Record<string, Profile> {
  const profiles: Record<string, Profile> = { ...config.profiles };
  if (config.apiKey && !profiles.default) {
    profiles.default = {
      apiKey: config.apiKey,
      environment: config.environment ?? 'live',
    };
  }
  return profiles;
}

/** Name of the active profile, honoring BUNCE_PROFILE, then activeProfile, then legacy default. */
export function activeProfileName(config: BunceConfig): string | undefined {
  const fromEnv = process.env.BUNCE_PROFILE;
  if (fromEnv) return fromEnv;
  if (config.activeProfile) return config.activeProfile;
  if (config.apiKey) return 'default';
  return undefined;
}

export function getProfile(
  config: BunceConfig,
  name: string,
): Profile | undefined {
  return listProfiles(config)[name];
}

/** Resolves the credential in effect: explicit name → active profile → legacy top-level. */
export function resolveProfile(
  config: BunceConfig,
  name?: string,
): { name: string; profile: Profile } | undefined {
  const target = name ?? activeProfileName(config);
  if (!target) return undefined;
  const profile = getProfile(config, target);
  if (!profile) return undefined;
  return { name: target, profile };
}

/**
 * API key resolution: BUNCE_API_KEY wins, then the resolved profile.
 * `profileName` (from --profile) overrides the active profile.
 */
export function resolveApiKey(
  config: BunceConfig,
  profileName?: string,
): string | undefined {
  if (process.env.BUNCE_API_KEY) return process.env.BUNCE_API_KEY;
  return resolveProfile(config, profileName)?.profile.apiKey;
}

export function resolveEnvironment(
  config: BunceConfig,
  profileName?: string,
): Environment {
  const fromEnv = process.env.BUNCE_ENV as Environment | undefined;
  if (fromEnv) return fromEnv;
  return resolveProfile(config, profileName)?.profile.environment ?? 'live';
}
