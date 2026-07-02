# Bunce CLI — Command Reference

Every command accepts these global options:

- `-p, --profile <name>` — use a specific profile (also via `BUNCE_PROFILE`)
- `-e, --env <live|sandbox>` — override the environment for that call
- `--json` — machine-readable output (where supported)

Credentials resolve in this order: `BUNCE_API_KEY` → `--profile` → `BUNCE_PROFILE`
→ active profile → the key stored by `bunce auth login`.

---

## Auth

| Command             | Description                     | Options                                        |
| ------------------- | ------------------------------- | ---------------------------------------------- |
| `bunce auth login`  | Validate and store a secret key | `-s, --secret-key <apiKey>`, `-e, --env <env>` |
| `bunce auth logout` | Clear stored credentials        | —                                              |
| `bunce auth status` | Show current auth state         | `--json`                                       |

## Profiles

| Command                                    | Description                                       | Options                                                      |
| ------------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| `bunce profile add <name>`                 | Add a profile (interactive unless `--secret-key`) | `-s, --secret-key <key>`, `-e, --env <env>`, `--no-validate` |
| `bunce profile list`                       | List profiles (`*` marks active)                  | `--json`                                                     |
| `bunce profile use <name>`                 | Switch the active profile                         | —                                                            |
| `bunce profile remove <name>` (alias `rm`) | Remove a profile                                  | `-y, --yes`                                                  |
| `bunce profile dashboard`                  | Open the dashboard                                | `-p, --profile <name>`, `--print`                            |

## Dashboard

| Command           | Description                              | Options                           |
| ----------------- | ---------------------------------------- | --------------------------------- |
| `bunce dashboard` | Open the Bunce dashboard in your browser | `-p, --profile <name>`, `--print` |

## Customers

| Command                          | Description               | Options                                                                                                   |
| -------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `bunce customers search <email>` | Find a customer by email  | `--json`, `-e, --env`                                                                                     |
| `bunce customers list`           | Paginated customer list   | `--per-page <n>`, `--cursor <c>`, `--emails <list>`, `--customer-ids <list>`, `--json`                    |
| `bunce customers create`         | Create a single customer  | `--first-name`, `--last-name`, `--phone` (required); `--email` / `--customer-id` (one required); `--json` |
| `bunce customers import <file>`  | Import customers from CSV | `--dry-run`, `--confirm`, `--json`                                                                        |

CSV columns: `email` (or `customer_id`), `first_name`, `last_name`, `phone_no`.

## Events

| Command               | Description                     | Options                                                                                                                                     |
| --------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `bunce events create` | Define an event schema          | `--name`, `--description` (required); `--param <name:type:required...>` or `--parameters <json>`; `--json`                                  |
| `bunce events track`  | Trigger an event for a customer | `--event-id` (required); `--email` / `--customer-id` (one required); `--first-name`, `--last-name`, `--phone`, `--details <json>`, `--json` |

## Attributes

| Command                        | Description               | Options                                                                 |
| ------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| `bunce attributes create`      | Create an attribute       | `--name`, `--data-type <text\|timestamp\|numeric>` (required); `--json` |
| `bunce attributes list`        | Paginated attribute list  | `--per-page <n>`, `--cursor <c>`, `--json`                              |
| `bunce attributes delete <id>` | Delete an attribute by ID | `--json`                                                                |

## Broadcasts

| Command                     | Description              | Options                                    |
| --------------------------- | ------------------------ | ------------------------------------------ |
| `bunce broadcasts list`     | Paginated broadcast list | `--per-page <n>`, `--cursor <c>`, `--json` |
| `bunce broadcasts get <id>` | Fetch a broadcast by ID  | `--json`                                   |

## Messaging

| Command                         | Description         | Required                                                                                     | Optional                                                                                                                               |
| ------------------------------- | ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `bunce messaging send-email`    | Transactional email | `--sender-email`, `--sender-name`, `--email`, `--subject`, `--message-type`                  | `--text`, `--html <file>`, `--template-id`, `--email-template-id`, `--variables <json>`, `--customer-id`                               |
| `bunce messaging send-sms`      | Transactional SMS   | `--sender-id`, `--subject`, and `--message` or `--template-id`; `--email` or `--customer-id` | `--phone`, `--first-name`, `--last-name`, `--variables <json>`                                                                         |
| `bunce messaging send-push`     | Push notification   | `--title`, `--message`; `--email` or `--customer-id`                                         | `--provider` (default `firebase`), `--device-token`, `--device-type <android\|ios\|windows>`, `--first-name`, `--last-name`, `--phone` |
| `bunce messaging send-whatsapp` | WhatsApp message    | `--phone`, `--whatsapp-template-id`                                                          | `--message` (auth templates), `--customer-id`, `--email`, `--first-name`, `--last-name`, `--variables <json>`                          |

---

## Endpoint mapping

| Command                       | Method & path                                          |
| ----------------------------- | ------------------------------------------------------ |
| `customers search` / `list`   | `GET /customers`                                       |
| `customers create` / `import` | `POST /customers`                                      |
| `events create`               | `POST /events`                                         |
| `events track`                | `POST /events/trigger`                                 |
| `attributes create`           | `POST /attributes`                                     |
| `attributes list`             | `GET /attributes`                                      |
| `attributes delete`           | `DELETE /attributes/{id}`                              |
| `broadcasts list`             | `GET /broadcast`                                       |
| `broadcasts get`              | `GET /broadcast/{id}`                                  |
| `messaging send-email`        | `POST /messaging/transactional/send/email`             |
| `messaging send-sms`          | `POST /messaging/transactional/send/sms`               |
| `messaging send-push`         | `POST /messaging/transactional/send/push-notification` |
| `messaging send-whatsapp`     | `POST /messaging/transactional/send/whatsapp`          |

---

_Drafted with Dia_
