# Mock Authenticator

A temporary local OAuth helper for the Salesforce Dashboard Edge App POC. It handles the Salesforce OAuth 2.0 Device Flow, stores the resulting tokens in SQLite, and exposes them via an endpoint that mimics the Screenly OAuth service.

## Prerequisites

- [Bun](https://bun.sh/) 1.2.2+
- A Salesforce Connected App with Device Flow enabled (see below)

## Setting Up a Salesforce Connected App

1. In Salesforce, go to **Setup &rarr; Apps &rarr; App Manager**
2. Click **New External Client App**
3. Fill in **External Client App Name** (e.g. `screenly-salesforce-edge-app`) and **Contact Email**
4. Expand **API (Enable OAuth Settings)** and check **Enable OAuth**
5. Set **Callback URL** to `https://localhost/callback` (required by the form but not used for Device Flow)
6. Under **OAuth Scopes**, add: `Manage user data via APIs (api)` and `Perform requests at any time (refresh_token, offline_access)`
7. Leave **Introspect all Tokens** and **Configure ID token** unchecked
8. Under **Flow Enablement**, check **Enable Device Flow** only; leave all others unchecked
9. Under **Security**, leave the three pre-checked options as-is
10. Click **Create**
11. On the app detail page, go to **Settings &rarr; OAuth Settings &rarr; Consumer Key and Secret** (requires identity verification) and copy the **Consumer Key** — this is your `SF_CLIENT_ID`.

## Getting Started

```bash
cp .env.example .env
```

Fill in your Salesforce Connected App Consumer Key in `.env`:

```
SF_CLIENT_ID=your_salesforce_consumer_key_here
```

Then install dependencies and start the server:

```bash
bun install
bun run dev
```

Open `http://localhost:3000` in a browser and click **Authenticate with Salesforce**.

## How It Works

1. The server initiates a Device Flow with Salesforce and displays a verification URL and user code.
2. You open the URL in any browser, enter the code, and log in with your Salesforce credentials.
3. The server polls Salesforce and stores the `access_token`, `refresh_token`, and `instance_url` in a local SQLite database (`auth.db`).
4. The access token is automatically refreshed every 25 minutes in the background.
5. The Edge App calls `GET /access_token/` to retrieve the current token at runtime.

## Endpoints

| Endpoint             | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `GET /`              | UI showing auth status, tokens, and controls                     |
| `POST /start`        | Initiates a new Device Flow                                      |
| `POST /poll`         | Polls Salesforce for token (used internally by HTMX)             |
| `GET /access_token/` | Returns `{ token, metadata: { instance_url } }` for the Edge App |
| `POST /clear`        | Clears stored tokens                                             |

## Connecting to the Edge App

In `mock-data.yml` (at the repository root), set:

```yaml
settings:
  screenly_oauth_tokens_url: 'http://localhost:3000/'
  screenly_app_auth_token: mock-token
```

The Edge App will call `GET /access_token/` on startup and whenever `getCredentials()` is invoked.
