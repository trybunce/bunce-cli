# @bunce/cli

A TypeScript command-line interface for the [Bunce](https://bunce.so) customer engagement API.

Modeled on the ergonomics of tools like the Bento CLI, but mapped onto Bunce's actual REST endpoints (customers, events, broadcasts, transactional messaging).

## Install

```bash
pnpm install -g @bunce/cli
```

Requires Node.js 20+ (uses the built-in `fetch`).

## Authenticate

```bash
# Prompts for the key, validates it, stores it in ~/.config/bunce/config.json (chmod 600)
bunce auth login

# Or pass it inline / pick an environment
bunce auth login --secret-key sk_test_xxx --env sandbox

bunce auth status
bunce auth logout
```

The key is read from `BUNCE_API_KEY` first if set, otherwise from the config file.
Set `BUNCE_ENV=sandbox` or pass `--env sandbox` to hit `https://sandbox.api.bunce.so`.

## Profiles

Manage multiple Bunce accounts with named profiles. Bunce only requires a **secret
key** (plus an environment), so that's all a profile stores.

```bash
# Interactive setup — prompts for the secret key
bunce profile add staging

# Non-interactive (for scripting). Bunce needs only the secret key.
bunce profile add production \
  --secret-key "sk_live_..." \
  --env live

bunce profile list          # * marks the active profile
bunce profile use staging   # switch the active profile

bunce profile remove staging        # asks for confirmation
bunce profile remove staging --yes  # skip confirmation
```

Adding a key validates it against the API first; pass `--no-validate` to skip that.
The first profile you add becomes active automatically.

Every command accepts a global `--profile <name>` to target a specific profile for
that invocation, and honors the `BUNCE_PROFILE` environment variable:

```bash
bunce customers search john@example.com --profile production
BUNCE_PROFILE=staging bunce customers list
```

Resolution order for credentials: `BUNCE_API_KEY` env → `--profile` flag →
`BUNCE_PROFILE` env → active profile → the key stored by `bunce auth login`.

## Dashboard

```bash
# Open the Bunce dashboard in your browser
bunce dashboard

# Open for a specific profile
bunce dashboard --profile staging

# Print the URL instead of opening it (useful in headless shells)
bunce dashboard --print
```

## Customers

```bash
# Find a customer by email
bunce customers search john@example.com

# List / paginate
bunce customers list --per-page 50
bunce customers list --cursor <next_page_cursor>

# Create one
bunce customers create \
  --email john@example.com \
  --first-name John --last-name Doe --phone "+2348100000001"

# Import from CSV — preview first, then confirm
bunce customers import ./examples/contacts.csv --dry-run
bunce customers import ./examples/contacts.csv --confirm
```

CSV columns: `email` (or `customer_id`), `first_name`, `last_name`, `phone_no`.
`--dry-run` validates every row and shows which would fail before anything is sent.

## Events

Bunce's events endpoint defines an event _schema_ (a name plus typed parameters):

```bash
bunce events create \
  --name "Completed Onboarding" \
  --description "Fires when a user finishes onboarding" \
  --param email:text:true \
  --param plan:text:false \
  --param amount:numeric:false
```

Once an event exists, trigger it for a customer with `track`. Pass the event's
custom parameters via `--details` (a JSON object); `timestamp` parameters must be
in `YYYY-MM-DDTHH:MM:SSZ` UTC format or the API skips them.

```bash
bunce events track \
  --event-id 9bb6215c-e2b1-4e51-abff-3a96ca185088 \
  --email user@example.com \
  --first-name John --last-name Doe \
  --details '{"plan": "pro", "amount": 99}'
```

You can identify the customer by `--email` or `--customer-id` (at least one is
required). `--first-name`, `--last-name`, and `--phone` are optional and enrich the
customer record Bunce associates with the event.

## Attributes

Attributes are typed fields you can store on customers. Data type must be one of
`text`, `timestamp`, or `numeric`.

```bash
bunce attributes create --name "Date of Birth" --data-type timestamp
bunce attributes list
bunce attributes list --cursor <next_page_cursor>
bunce attributes delete 018c76f4-01b8-7c6b-a54b-6b681fc78295
```

## Broadcasts

```bash
bunce broadcasts list
bunce broadcasts get 9e434864-899c-496a-91f7-37a721d9496f
```

## Transactional messaging

Send transactional messages across channels. Each recipient can be identified by
`--email` or `--customer-id`; optional `--first-name`, `--last-name`, and `--phone`
enrich the customer record Bunce creates or updates.

### Email

```bash
bunce messaging send-email \
  --sender-email you@company.com --sender-name "You" \
  --email user@example.com \
  --subject "Welcome!" --message-type transactional \
  --html ./email.html
```

### SMS

Requires `--sender-id`, `--subject`, and a body (`--message` or `--template-id`).

```bash
bunce messaging send-sms \
  --sender-id "Bunce" \
  --email user@example.com \
  --subject "Reset Password OTP" \
  --message "Your code is 1234"
```

### Push notification

Requires `--title`, `--message`, and a `--provider` (defaults to `firebase`). Supply
`--device-token` and `--device-type` (android/ios/windows) if the customer has no
device on file yet.

```bash
bunce messaging send-push \
  --title "Order shipped" \
  --message "Your order is on the way" \
  --customer-id 837473484584359745 \
  --device-token "fcm_token..." --device-type android
```

### WhatsApp

Requires `--phone` (international format) and `--whatsapp-template-id`. For
authentication templates, pass the OTP code via `--message`.

```bash
bunce messaging send-whatsapp \
  --phone "+2349088798657" \
  --whatsapp-template-id 9834797493459 \
  --customer-id uhviue98454309t3f \
  --message 8893
```

## JSON output

Every command accepts `--json` for machine-readable output, so you can pipe into `jq`:

```bash
bunce customers search john@example.com --json | jq '.[0].customer_id'
```

## Notes on scope

Bunce's public API does not (as documented) expose Bento-style tags or a "create
broadcast" endpoint, so this CLI does not include those commands. `events create`
defines an event _schema_; `events track` fires that event for a specific customer
via Bunce's trigger endpoint.

## Develop

```bash
pnpm install
pnpm run lint          # oxlint
pnpm run format        # oxfmt --write
pnpm run typecheck     # tsc --noEmit
pnpm run check         # lint + format check + typecheck
pnpm run build         # emits dist/index.js with a node shebang
node ./dist/index.js --help
```

Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and formatting
uses oxfmt (config in `.oxlintrc.json`). `pnpm run lint:fix` and `pnpm run format`
auto-fix where possible.

---

_Drafted with Dia_
