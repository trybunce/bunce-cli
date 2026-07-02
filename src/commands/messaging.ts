import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import {
  requireClient,
  print,
  success,
  fail,
  handleError,
} from '../lib/output.js';

/** Parses --variables JSON into an object, failing on non-objects. */
function parseVariables(
  raw: string | undefined,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`Invalid --variables JSON: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('--variables must be a JSON object.');
  }
  return parsed as Record<string, unknown>;
}

/** Assembles the optional Bunce `customer` object from CLI flags; undefined if empty. */
function buildCustomer(opts: {
  customerId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}): Record<string, unknown> | undefined {
  const customer: Record<string, unknown> = {};
  if (opts.customerId) customer.customer_id = opts.customerId;
  if (opts.email) customer.email = opts.email;
  if (opts.firstName) customer.first_name = opts.firstName;
  if (opts.lastName) customer.last_name = opts.lastName;
  if (opts.phone) customer.phone_no = opts.phone;
  return Object.keys(customer).length > 0 ? customer : undefined;
}

export function registerMessaging(program: Command): void {
  const messaging = program
    .command('messaging')
    .description('Send transactional messages via Bunce');

  messaging
    .command('send-email')
    .description('Send a transactional email')
    .requiredOption('--sender-email <email>', 'Sender email')
    .requiredOption('--sender-name <name>', 'Sender name')
    .requiredOption('--email <email>', 'Recipient email')
    .requiredOption('--subject <subject>', 'Email subject')
    .requiredOption(
      '--message-type <type>',
      'Message type (e.g. otp, transactional)',
    )
    .option('--text <text>', 'Plain-text body')
    .option('--html <file>', 'Path to an HTML body file')
    .option('--template-id <id>', 'Template ID')
    .option('--email-template-id <id>', 'Email template ID')
    .option('--variables <json>', 'Template variables as JSON object')
    .option('--customer-id <id>', 'Associate with a customer ID')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(async (opts: Record<string, string | boolean | undefined>) => {
      try {
        const html = opts.html
          ? readFileSync(opts.html as string, 'utf8')
          : undefined;
        const text = opts.text as string | undefined;
        if (!html && !text && !opts.emailTemplateId && !opts.templateId) {
          fail('Provide --text, --html, --template-id, or --email-template-id.');
        }

        let variables: unknown;
        if (opts.variables) {
          try {
            variables = JSON.parse(opts.variables as string);
          } catch (err) {
            fail(`Invalid --variables JSON: ${(err as Error).message}`);
          }
        }

        const client = requireClient({ env: opts.env as string | undefined });
        const res = await client.request('/messaging/transactional/send/email', {
          method: 'POST',
          body: {
            sender_email: opts.senderEmail,
            sender_name: opts.senderName,
            email: opts.email,
            subject: opts.subject,
            message_type: opts.messageType,
            text,
            html,
            template_id: opts.templateId,
            email_template_id: opts.emailTemplateId,
            customer_id: opts.customerId,
            variables,
          },
        });
        if (opts.json) print(res, true);
        else success(res.message ?? 'Email sent.');
      } catch (err) {
        handleError(err);
      }
    });

  messaging
    .command('send-sms')
    .description('Send a transactional SMS')
    .requiredOption('--sender-id <id>', 'Sender ID')
    .requiredOption('--subject <subject>', 'Message subject')
    .option('--message <text>', 'Message text (required unless --template-id)')
    .option('--email <email>', 'Recipient email (required unless --customer-id)')
    .option(
      '--customer-id <id>',
      'Recipient customer ID (required unless --email)',
    )
    .option('--phone <number>', 'Recipient phone number (international format)')
    .option('--first-name <name>', 'Customer first name')
    .option('--last-name <name>', 'Customer last name')
    .option('--template-id <id>', 'Template ID')
    .option('--variables <json>', 'Template variables as JSON object')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        senderId: string;
        subject: string;
        message?: string;
        email?: string;
        customerId?: string;
        phone?: string;
        firstName?: string;
        lastName?: string;
        templateId?: string;
        variables?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          if (!opts.email && !opts.customerId) {
            fail('Provide --email or --customer-id to identify the recipient.');
          }
          if (!opts.message && !opts.templateId) {
            fail('Provide --message or --template-id.');
          }
          const variables = parseVariables(opts.variables);
          const customer = buildCustomer(opts);

          const client = requireClient({ env: opts.env });
          const res = await client.request('/messaging/transactional/send/sms', {
            method: 'POST',
            body: {
              sender_id: opts.senderId,
              subject: opts.subject,
              message: opts.message,
              email: opts.email,
              customer_id: opts.customerId,
              phone_no: opts.phone,
              template_id: opts.templateId,
              variables,
              customer,
            },
          });
          if (opts.json) print(res, true);
          else success(res.message ?? 'SMS sent.');
        } catch (err) {
          handleError(err);
        }
      },
    );

  messaging
    .command('send-push')
    .description('Send a transactional push notification')
    .requiredOption('--title <title>', 'Notification title')
    .requiredOption('--message <text>', 'Message text')
    .option('--provider <provider>', 'Push provider', 'firebase')
    .option('--email <email>', 'Recipient email (required unless --customer-id)')
    .option(
      '--customer-id <id>',
      'Recipient customer ID (required unless --email)',
    )
    .option('--device-token <token>', 'Recipient device token')
    .option('--device-type <type>', 'Device type: android, ios, or windows')
    .option('--first-name <name>', 'Customer first name')
    .option('--last-name <name>', 'Customer last name')
    .option('--phone <number>', 'Customer phone number')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        title: string;
        message: string;
        provider: string;
        email?: string;
        customerId?: string;
        deviceToken?: string;
        deviceType?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          if (!opts.email && !opts.customerId) {
            fail('Provide --email or --customer-id to identify the recipient.');
          }
          const deviceTypes = ['android', 'ios', 'windows'];
          if (opts.deviceType && !deviceTypes.includes(opts.deviceType)) {
            fail(`--device-type must be one of: ${deviceTypes.join(', ')}.`);
          }
          const customer = buildCustomer(opts);

          const client = requireClient({ env: opts.env });
          const res = await client.request(
            '/messaging/transactional/send/push-notification',
            {
              method: 'POST',
              body: {
                title: opts.title,
                message: opts.message,
                provider: opts.provider,
                email: opts.email,
                customer_id: opts.customerId,
                device_token: opts.deviceToken,
                device_type: opts.deviceType,
                customer,
              },
            },
          );
          if (opts.json) print(res, true);
          else success(res.message ?? 'Push notification sent.');
        } catch (err) {
          handleError(err);
        }
      },
    );

  messaging
    .command('send-whatsapp')
    .description('Send a transactional WhatsApp message')
    .requiredOption(
      '--phone <number>',
      'Recipient phone number (international format)',
    )
    .requiredOption('--whatsapp-template-id <id>', 'WhatsApp template ID')
    .option(
      '--message <text>',
      'Required for authentication templates (pass the OTP code)',
    )
    .option('--customer-id <id>', 'Recipient customer ID')
    .option('--email <email>', 'Customer email')
    .option('--first-name <name>', 'Customer first name')
    .option('--last-name <name>', 'Customer last name')
    .option('--variables <json>', 'Template variables as JSON object')
    .option('--json', 'Output raw JSON')
    .option('-e, --env <environment>', 'Override environment')
    .action(
      async (opts: {
        phone: string;
        whatsappTemplateId: string;
        message?: string;
        customerId?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        variables?: string;
        json?: boolean;
        env?: string;
      }) => {
        try {
          const variables = parseVariables(opts.variables);
          const customer = buildCustomer({ ...opts, phone: undefined });

          const client = requireClient({ env: opts.env });
          const res = await client.request(
            '/messaging/transactional/send/whatsapp',
            {
              method: 'POST',
              body: {
                phone_no: opts.phone,
                whatsapp_template_id: opts.whatsappTemplateId,
                message: opts.message,
                customer_id: opts.customerId,
                email: opts.email,
                variables,
                customer,
              },
            },
          );
          if (opts.json) print(res, true);
          else success(res.message ?? 'WhatsApp message sent.');
        } catch (err) {
          handleError(err);
        }
      },
    );
}
