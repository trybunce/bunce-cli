import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import {
  requireClient,
  print,
  success,
  info,
  fail,
  handleError,
} from '../lib/output.js';
import { parseCsv } from '../lib/csv.js';
import type { BunceResponse } from '../lib/client.js';

interface Customer {
  customer_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_no?: string;
  [key: string]: unknown;
}

interface CustomerList {
  data: Customer[];
  meta?: unknown;
}

export function registerCustomers(program: Command): void {
  const customers = program
    .command('customers')
    .description('Manage Bunce customers');

  customers
    .command('search <email>')
    .description('Find a customer by email')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(async (email: string, opts: { json?: boolean; env?: string }) => {
      try {
        const client = requireClient({ env: opts.env });
        const res = await client.request<CustomerList | Customer[]>('/customers', {
          query: { emails: email, per_page: 20 },
        });
        const rows = normalizeList(res);
        if (rows.length === 0) {
          if (opts.json) print([], true);
          else info(`No customer found for ${email}.`);
          return;
        }
        print(rows, Boolean(opts.json));
      } catch (err) {
        handleError(err);
      }
    });

  customers
    .command('list')
    .description('List customers (paginated)')
    .option('--per-page <n>', 'Records per page', '20')
    .option('--cursor <cursor>', 'Pagination cursor from a previous page')
    .option('--emails <list>', 'Comma-separated emails to filter by')
    .option('--customer-ids <list>', 'Comma-separated customer IDs to filter by')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        perPage: string;
        cursor?: string;
        emails?: string;
        customerIds?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          const client = requireClient({ env: opts.env });
          const res = await client.request<CustomerList | Customer[]>(
            '/customers',
            {
              query: {
                per_page: Number(opts.perPage) || 20,
                cursor: opts.cursor,
                emails: opts.emails,
                customer_ids: opts.customerIds,
              },
            },
          );
          if (opts.json) {
            print(res, true);
            return;
          }
          const rows = normalizeList(res);
          print(rows, false);
          const cursor = extractNextCursor(res);
          if (cursor) info(`\nNext page: --cursor ${cursor}`);
        } catch (err) {
          handleError(err);
        }
      },
    );

  customers
    .command('create')
    .description('Create a single customer')
    .requiredOption('--first-name <name>')
    .requiredOption('--last-name <name>')
    .requiredOption('--phone <number>')
    .option('--email <email>', 'Required if --customer-id is absent')
    .option('--customer-id <id>', 'Required if --email is absent')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(async (opts: Record<string, string | boolean | undefined>) => {
      try {
        if (!opts.email && !opts.customerId) {
          fail('Provide --email or --customer-id.');
        }
        const client = requireClient({ env: opts.env as string | undefined });
        const res = await client.request<Customer>('/customers', {
          method: 'POST',
          body: {
            customer_id: opts.customerId,
            email: opts.email,
            first_name: opts.firstName,
            last_name: opts.lastName,
            phone_no: opts.phone,
          },
        });
        if (opts.json) print(res, true);
        else success(res.message ?? 'Customer created.');
      } catch (err) {
        handleError(err);
      }
    });

  customers
    .command('import <file>')
    .description('Import customers from a CSV file')
    .option('--dry-run', 'Validate and preview without sending', false)
    .option('--confirm', 'Actually create the customers', false)
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (
        file: string,
        opts: {
          dryRun?: boolean;
          confirm?: boolean;
          json?: boolean;
          env?: string;
        },
      ) => {
        try {
          if (!opts.dryRun && !opts.confirm) {
            fail('Pass --dry-run to preview or --confirm to import.');
          }
          const raw = readFileSync(file, 'utf8');
          const rows = parseCsv(raw);
          if (rows.length === 0) fail('CSV contains no data rows.');

          const { valid, errors } = validateRows(rows);

          if (opts.dryRun) {
            const summary = {
              file,
              total: rows.length,
              valid: valid.length,
              invalid: errors.length,
              errors,
              preview: valid.slice(0, 5),
            };
            if (opts.json) print(summary, true);
            else {
              info(`Dry run for ${file}`);
              info(
                `  ${rows.length} rows, ${valid.length} valid, ${errors.length} invalid`,
              );
              for (const e of errors) info(`  row ${e.row}: ${e.reason}`);
              info(`\nRe-run with --confirm to import ${valid.length} customers.`);
            }
            return;
          }

          if (errors.length > 0) {
            fail(
              `${errors.length} invalid row(s). Fix them or run --dry-run for details.`,
            );
          }

          const client = requireClient({ env: opts.env });
          const results: { email?: string; ok: boolean; message: string }[] = [];
          for (const c of valid) {
            try {
              const res = await client.request<Customer>('/customers', {
                method: 'POST',
                body: c,
              });
              results.push({ email: c.email, ok: true, message: res.message });
            } catch (err) {
              results.push({
                email: c.email,
                ok: false,
                message: (err as Error).message,
              });
            }
          }
          const ok = results.filter((r) => r.ok).length;
          if (opts.json)
            print({ imported: ok, failed: results.length - ok, results }, true);
          else {
            success(`Imported ${ok}/${results.length} customers.`);
            for (const r of results.filter((x) => !x.ok)) {
              info(`  failed ${r.email}: ${r.message}`);
            }
          }
        } catch (err) {
          handleError(err);
        }
      },
    );
}

function validateRows(rows: Record<string, string>[]): {
  valid: Customer[];
  errors: { row: number; reason: string }[];
} {
  const valid: Customer[] = [];
  const errors: { row: number; reason: string }[] = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // account for header + 1-based
    const email = row.email || row.Email;
    const customerId = row.customer_id || row.customerId;
    if (!email && !customerId) {
      errors.push({ row: rowNum, reason: 'missing email and customer_id' });
      return;
    }
    if (!row.first_name && !row.firstName) {
      errors.push({ row: rowNum, reason: 'missing first_name' });
      return;
    }
    if (!row.last_name && !row.lastName) {
      errors.push({ row: rowNum, reason: 'missing last_name' });
      return;
    }
    if (!row.phone_no && !row.phone) {
      errors.push({ row: rowNum, reason: 'missing phone_no' });
      return;
    }
    valid.push({
      customer_id: customerId || undefined,
      email: email || undefined,
      first_name: row.first_name || row.firstName,
      last_name: row.last_name || row.lastName,
      phone_no: row.phone_no || row.phone,
    });
  });
  return { valid, errors };
}

function normalizeList(res: BunceResponse<CustomerList | Customer[]>): Customer[] {
  const data = res.data as CustomerList | Customer[];
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function extractNextCursor(
  res: BunceResponse<CustomerList | Customer[]>,
): string | null {
  const top = res.meta?.next_page_cursor;
  if (top) return top;
  const nested = (res.data as CustomerList | undefined)?.meta as
    | { next_page_cursor?: string | null }
    | undefined;
  return nested?.next_page_cursor ?? null;
}
