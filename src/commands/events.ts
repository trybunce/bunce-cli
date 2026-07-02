import { Command } from 'commander';
import {
  requireClient,
  print,
  success,
  fail,
  handleError,
} from '../lib/output.js';

interface EventParameter {
  name: string;
  type: string;
  required: boolean;
}

export function registerEvents(program: Command): void {
  const events = program
    .command('events')
    .description('Define and manage Bunce event schemas');

  events
    .command('create')
    .description('Create an event definition with typed parameters')
    .requiredOption('--name <name>', 'Event name')
    .requiredOption('--description <text>', 'Event description')
    .option(
      '--param <spec...>',
      'Parameter as name:type[:required] (e.g. amount:numeric:false)',
    )
    .option('--parameters <json>', 'Raw JSON array of parameter objects')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        name: string;
        description: string;
        param?: string[];
        parameters?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          const parameters = buildParameters(opts.param, opts.parameters);
          if (parameters.length === 0) {
            fail(
              'Provide at least one --param name:type[:required] or --parameters JSON.',
            );
          }
          const client = requireClient({ env: opts.env });
          const res = await client.request('/events', {
            method: 'POST',
            body: { name: opts.name, description: opts.description, parameters },
          });
          if (opts.json) print(res, true);
          else success(res.message ?? 'Event created.');
        } catch (err) {
          handleError(err);
        }
      },
    );

  events
    .command('track')
    .description('Trigger an event for a customer')
    .requiredOption('--event-id <id>', 'ID of the event to trigger')
    .option('--email <email>', 'Customer email (required unless --customer-id)')
    .option('--customer-id <id>', 'Customer ID (required unless --email)')
    .option('--first-name <name>', 'Customer first name')
    .option('--last-name <name>', 'Customer last name')
    .option('--phone <number>', 'Customer phone number')
    .option(
      '--details <json>',
      'Event parameters as a JSON object (e.g. \'{"amount": 99}\')',
    )
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        eventId: string;
        email?: string;
        customerId?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        details?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          if (!opts.email && !opts.customerId) {
            fail('Provide --email or --customer-id to identify the customer.');
          }

          let details: Record<string, unknown> = {};
          if (opts.details) {
            let parsed: unknown;
            try {
              parsed = JSON.parse(opts.details);
            } catch (err) {
              fail(`Invalid --details JSON: ${(err as Error).message}`);
            }
            if (
              parsed === null ||
              typeof parsed !== 'object' ||
              Array.isArray(parsed)
            ) {
              fail('--details must be a JSON object of event parameters.');
            }
            details = parsed as Record<string, unknown>;
          }

          const customer: Record<string, unknown> = {};
          if (opts.customerId) customer.customer_id = opts.customerId;
          if (opts.email) customer.email = opts.email;
          if (opts.firstName) customer.first_name = opts.firstName;
          if (opts.lastName) customer.last_name = opts.lastName;
          if (opts.phone) customer.phone_no = opts.phone;

          const payload: Record<string, unknown> = { ...details };
          if (opts.email) payload.email = opts.email;
          payload.customer = customer;

          const client = requireClient({ env: opts.env });
          const res = await client.request<boolean>('/events/trigger', {
            method: 'POST',
            body: { event_id: opts.eventId, payload },
          });
          if (opts.json) print(res, true);
          else success(res.message ?? 'Event triggered.');
        } catch (err) {
          handleError(err);
        }
      },
    );
}

function buildParameters(
  params: string[] | undefined,
  json: string | undefined,
): EventParameter[] {
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) fail('--parameters must be a JSON array.');
      return parsed as EventParameter[];
    } catch (err) {
      fail(`Invalid --parameters JSON: ${(err as Error).message}`);
    }
  }
  if (!params) return [];
  return params.map((spec) => {
    const [name, type, required] = spec.split(':');
    if (!name || !type)
      fail(`Invalid --param "${spec}". Use name:type[:required].`);
    return {
      name: name!,
      type: type!,
      required: required === undefined ? true : required === 'true',
    };
  });
}
