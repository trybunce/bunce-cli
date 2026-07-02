import { Command } from 'commander';
import {
  loadConfig,
  saveConfig,
  clearConfig,
  configPath,
  resolveApiKey,
  resolveEnvironment,
  type Environment,
} from '../lib/config.js';
import { BunceClient } from '../lib/client.js';
import { success, info, fail, handleError, print } from '../lib/output.js';
import { createInterface } from 'node:readline/promises';

async function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Authenticate with Bunce');

  auth
    .command('login')
    .description('Store an API key for future commands')
    .option('-s, --secret-key <apiKey>', 'Secret key (sk_live_... or sk_test_...)')
    .option('-e, --env <environment>', 'Environment: live or sandbox')
    .action(async (opts: { secretKey?: string; env?: string }) => {
      try {
        const apiKey =
          opts.secretKey ?? (await promptSecret('Bunce secret key: '));
        if (!apiKey) fail('No secret key provided.');

        const environment: Environment =
          opts.env === 'sandbox' ? 'sandbox' : 'live';

        // Validate the key with a lightweight authenticated request.
        const client = new BunceClient({ apiKey, environment });
        info('Validating key...');
        await client.request('/customers', { query: { per_page: 1 } });

        const config = loadConfig();
        saveConfig({ ...config, apiKey, environment });
        success(`Authenticated (${environment}). Saved to ${configPath()}`);
      } catch (err) {
        handleError(err);
      }
    });

  auth
    .command('logout')
    .description('Remove the stored API key')
    .action(() => {
      clearConfig();
      success('Logged out. Stored credentials cleared.');
    });

  auth
    .command('status')
    .description('Show the current authentication state')
    .option('--json', 'Output raw JSON')
    .action((opts: { json?: boolean }) => {
      const config = loadConfig();
      const apiKey = resolveApiKey(config);
      const environment = resolveEnvironment(config);
      const masked = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : null;
      print(
        {
          authenticated: Boolean(apiKey),
          environment,
          apiKey: masked,
          source: process.env.BUNCE_API_KEY ? 'env' : apiKey ? 'config' : 'none',
          configPath: configPath(),
        },
        Boolean(opts.json),
      );
    });
}
