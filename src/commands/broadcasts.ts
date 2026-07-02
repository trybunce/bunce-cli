import { Command } from 'commander';
import { requireClient, print, info, handleError } from '../lib/output.js';
import type { BunceResponse } from '../lib/client.js';

interface Broadcast {
  id: string;
  channel: string;
  subject: string;
  message: string;
  message_type: string;
  created_at: string;
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_bounced: number;
  [key: string]: unknown;
}

export function registerBroadcasts(program: Command): void {
  const broadcasts = program
    .command('broadcasts')
    .description('Inspect Bunce broadcasts');

  broadcasts
    .command('list')
    .description('List broadcasts (paginated)')
    .option('--per-page <n>', 'Records per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor from a previous page')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        perPage: string;
        cursor?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          const client = requireClient({ env: opts.env });
          const res = await client.request<Broadcast[]>('/broadcast', {
            query: { per_page: Number(opts.perPage) || 20, cursor: opts.cursor },
          });
          if (opts.json) {
            print(res, true);
            return;
          }
          print(res.data ?? [], false);
          const cursor = (res as BunceResponse<Broadcast[]>).meta
            ?.next_page_cursor;
          if (cursor) info(`\nNext page: --cursor ${cursor}`);
        } catch (err) {
          handleError(err);
        }
      },
    );

  broadcasts
    .command('get <id>')
    .description('Fetch a single broadcast by ID')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(async (id: string, opts: { json?: boolean; env?: string }) => {
      try {
        const client = requireClient({ env: opts.env });
        const res = await client.request<Broadcast>(
          `/broadcast/${encodeURIComponent(id)}`,
        );
        print(opts.json ? res : res.data, Boolean(opts.json));
      } catch (err) {
        handleError(err);
      }
    });
}
