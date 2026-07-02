import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import {
  loadConfig,
  saveConfig,
  listProfiles,
  activeProfileName,
  type BunceConfig,
  type Environment,
  type Profile,
} from '../lib/config.js';
import { BunceClient } from '../lib/client.js';
import { print, success, info, fail, handleError } from '../lib/output.js';

const DASHBOARD_URL = 'https://app.bunce.so';

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function validateKey(
  apiKey: string,
  environment: Environment,
): Promise<void> {
  const client = new BunceClient({ apiKey, environment });
  await client.request('/customers', { query: { per_page: 1 } });
}

function openInBrowser(url: string): void {
  // Lazy import so the module stays testable and dependency-free.
  const platform = process.platform;
  const command =
    platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  import('node:child_process').then(({ spawn }) => {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  });
}

/** Shared handler for `bunce dashboard` and `bunce profile dashboard`. */
export function openDashboard(opts: { profile?: string; print?: boolean }): void {
  const config = loadConfig();
  if (opts.profile && !listProfiles(config)[opts.profile]) {
    fail(`Profile "${opts.profile}" not found. See \`bunce profile list\`.`);
  }
  if (opts.print) {
    process.stdout.write(DASHBOARD_URL + '\n');
    return;
  }
  openInBrowser(DASHBOARD_URL);
  success(`Opening ${DASHBOARD_URL}`);
}

export function registerDashboard(program: Command): void {
  program
    .command('dashboard')
    .description('Open the Bunce dashboard in your browser')
    .option('-p, --profile <name>', 'Open for a specific profile')
    .option('--print', 'Print the URL instead of opening it')
    .action(openDashboard);
}

export function registerProfile(program: Command): void {
  const profile = program
    .command('profile')
    .description('Manage multiple Bunce accounts with named profiles');

  profile
    .command('add <name>')
    .description('Add a profile (interactive unless --secret-key is given)')
    .option('-s, --secret-key <key>', 'Secret key (sk_live_... or sk_test_...)')
    .option('-e, --env <environment>', 'Environment: live or sandbox', 'live')
    .option('--no-validate', 'Skip validating the key against the API')
    .action(
      async (
        name: string,
        opts: { secretKey?: string; env?: string; validate?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const existing = config.profiles?.[name];
          if (existing) info(`Profile "${name}" exists and will be overwritten.`);

          const apiKey =
            opts.secretKey ?? (await prompt(`Secret key for "${name}": `));
          if (!apiKey) fail('No secret key provided.');

          const environment: Environment =
            opts.env === 'sandbox' ? 'sandbox' : 'live';

          if (opts.validate !== false) {
            info('Validating key...');
            await validateKey(apiKey, environment);
          }

          const profiles: Record<string, Profile> = { ...config.profiles };
          profiles[name] = { apiKey, environment };
          const next: BunceConfig = {
            ...config,
            profiles,
            // First profile added becomes active automatically.
            activeProfile: activeProfileName(config) ?? name,
          };
          saveConfig(next);
          success(`Profile "${name}" saved (${environment}).`);
          if (next.activeProfile === name)
            info(`"${name}" is the active profile.`);
        } catch (err) {
          handleError(err);
        }
      },
    );

  profile
    .command('list')
    .description('List configured profiles')
    .option('--json', 'Output raw JSON')
    .action((opts: { json?: boolean }) => {
      const config = loadConfig();
      const profiles = listProfiles(config);
      const active = activeProfileName(config);
      const names = Object.keys(profiles);

      if (opts.json) {
        print(
          {
            active: active ?? null,
            profiles: names.map((name) => ({
              name,
              active: name === active,
              environment: profiles[name]!.environment,
              secretKey: mask(profiles[name]!.apiKey),
            })),
          },
          true,
        );
        return;
      }

      if (names.length === 0) {
        info('No profiles configured. Add one with `bunce profile add <name>`.');
        return;
      }
      for (const name of names) {
        const marker = name === active ? '* ' : '  ';
        const p = profiles[name]!;
        process.stdout.write(
          `${marker}${name}  (${p.environment})  ${mask(p.apiKey)}\n`,
        );
      }
    });

  profile
    .command('use <name>')
    .description('Switch the active profile')
    .action((name: string) => {
      try {
        const config = loadConfig();
        if (!listProfiles(config)[name]) {
          fail(`Profile "${name}" not found. See \`bunce profile list\`.`);
        }
        saveConfig({ ...config, activeProfile: name });
        success(`Switched to profile "${name}".`);
      } catch (err) {
        handleError(err);
      }
    });

  profile
    .command('remove <name>')
    .alias('rm')
    .description('Remove a profile')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (name: string, opts: { yes?: boolean }) => {
      try {
        const config = loadConfig();
        const profiles: Record<string, Profile> = { ...config.profiles };
        const isLegacyDefault =
          name === 'default' && config.apiKey && !profiles.default;

        if (!profiles[name] && !isLegacyDefault) {
          fail(`Profile "${name}" not found. See \`bunce profile list\`.`);
        }

        if (!opts.yes) {
          const answer = await prompt(`Remove profile "${name}"? [y/N] `);
          if (!/^y(es)?$/i.test(answer)) {
            info('Aborted.');
            return;
          }
        }

        delete profiles[name];
        const next: BunceConfig = { ...config, profiles };
        if (isLegacyDefault) {
          delete next.apiKey;
          delete next.environment;
        }
        if (next.activeProfile === name) delete next.activeProfile;
        saveConfig(next);
        success(`Removed profile "${name}".`);
      } catch (err) {
        handleError(err);
      }
    });

  profile
    .command('dashboard')
    .description('Open the Bunce dashboard in your browser')
    .option('-p, --profile <name>', 'Open for a specific profile')
    .option('--print', 'Print the URL instead of opening it')
    .action(openDashboard);
}

function mask(key: string): string {
  if (key.length <= 11) return '****';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
