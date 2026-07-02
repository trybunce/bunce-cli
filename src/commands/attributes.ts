import { Command } from 'commander';
import {
  requireClient,
  print,
  success,
  info,
  fail,
  handleError,
} from '../lib/output.js';
import type { BunceResponse } from '../lib/client.js';

const DATA_TYPES = ['text', 'timestamp', 'numeric'] as const;
type DataType = (typeof DATA_TYPES)[number];

interface Attribute {
  id: string;
  name: string;
  data_type: string;
}

export function registerAttributes(program: Command): void {
  const attributes = program
    .command('attributes')
    .description('Manage Bunce customer attributes');

  attributes
    .command('create')
    .description('Create an attribute')
    .requiredOption('--name <name>', 'Attribute name')
    .requiredOption(
      '--data-type <type>',
      `Attribute data type (${DATA_TYPES.join(', ')})`,
    )
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        name: string;
        dataType: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          if (!DATA_TYPES.includes(opts.dataType as DataType)) {
            fail(`--data-type must be one of: ${DATA_TYPES.join(', ')}.`);
          }
          const client = requireClient({ env: opts.env });
          const res = await client.request<Attribute>('/attributes', {
            method: 'POST',
            body: { name: opts.name, data_type: opts.dataType },
          });
          if (opts.json) print(res, true);
          else success(res.message ?? 'Attribute created.');
        } catch (err) {
          handleError(err);
        }
      },
    );

  attributes
    .command('list')
    .description('List attributes (paginated)')
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
          const res = await client.request<Attribute[]>('/attributes', {
            query: { per_page: Number(opts.perPage) || 20, cursor: opts.cursor },
          });
          if (opts.json) {
            print(res, true);
            return;
          }
          const rows = res.data ?? [];
          if (rows.length === 0) {
            info('No attributes found.');
            return;
          }
          print(rows, false);
          const cursor = (res as BunceResponse<Attribute[]>).meta
            ?.next_page_cursor;
          if (cursor) info(`\nNext page: --cursor ${cursor}`);
        } catch (err) {
          handleError(err);
        }
      },
    );

  attributes
    .command('delete <id>')
    .description('Delete an attribute by ID')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(async (id: string, opts: { json?: boolean; env?: string }) => {
      try {
        const client = requireClient({ env: opts.env });
        const res = await client.request<boolean>(
          `/attributes/${encodeURIComponent(id)}`,
          { method: 'DELETE' },
        );
        if (opts.json) print(res, true);
        else success(res.message ?? 'Attribute deleted.');
      } catch (err) {
        handleError(err);
      }
    });
}
