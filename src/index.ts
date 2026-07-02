import { Command } from 'commander';
import { registerAuth } from './commands/auth.js';
import { registerCustomers } from './commands/customers.js';
import { registerEvents } from './commands/events.js';
import { registerAttributes } from './commands/attributes.js';
import { registerBroadcasts } from './commands/broadcasts.js';
import { registerMessaging } from './commands/messaging.js';
import { registerProfile, registerDashboard } from './commands/profile.js';
import { setGlobalProfile } from './lib/output.js';

const program = new Command();

program
  .name('bunce')
  .description('Command-line interface for the Bunce customer engagement API')
  .version('0.1.0')
  .option('-p, --profile <name>', 'Use a specific profile for this command')
  .hook('preAction', (thisCommand) => {
    setGlobalProfile(thisCommand.opts().profile as string | undefined);
  })
  .showHelpAfterError();

registerAuth(program);
registerProfile(program);
registerDashboard(program);
registerCustomers(program);
registerEvents(program);
registerAttributes(program);
registerBroadcasts(program);
registerMessaging(program);

program.parseAsync().catch((err) => {
  process.stderr.write(String(err?.message ?? err) + '\n');
  process.exit(1);
});
