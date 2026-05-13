# Salesforce Dashboard App

Displays Salesforce dashboards on your Screenly digital signage screens using the Salesforce Reports & Dashboards REST API.

## Prerequisites

- [Bun](https://bun.sh/) 1.2.2+
- [Screenly CLI](https://developer.screenly.io/edge-apps/#getting-started)
- A Salesforce account with a Connected App configured for OAuth 2.0 Device Flow

## Setting Up a Salesforce Connected App

1. In Salesforce, go to **Setup → Apps → App Manager → New Connected App**
2. Enable **OAuth Settings**
3. Add the following OAuth scopes: `Access and manage your data (api)`, `Perform requests on your behalf at any time (refresh_token)`
4. Enable **Enable for Device Flow**
5. Save and copy the **Consumer Key** — this is your `client_id` setting

## Getting Started

Clone the repository and install dependencies:

```bash
gh repo clone Screenly/salesforce-app -- --recurse-submodules
bun install
```

## Development

```bash
bun run dev
```

This starts the dev server alongside a local CORS proxy on `http://127.0.0.1:8080`.

## Building

```bash
bun run build
```

## Type Checking

```bash
bun run type-check
```

## Linting & Formatting

```bash
bun run lint
bun run format
```

## Testing

```bash
bun test
```

## Screenshots

```bash
bun run screenshots
```

## Deployment

```bash
screenly edge-app create --name salesforce-app --in-place
bun run deploy
screenly edge-app instance create
```

## Configuration

| Setting            | Type   | Required | Description                                                               |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------- |
| `client_id`        | secret | Yes      | Consumer Key from your Salesforce Connected App                           |
| `dashboard_id`     | string | Yes      | Salesforce Dashboard ID (found in the dashboard URL)                      |
| `refresh_interval` | string | No       | How often (in seconds) to refresh dashboard data. Default: `300`          |
| `display_errors`   | string | No       | Display errors on screen for debugging (`true`/`false`). Default: `false` |
| `enable_analytics` | string | No       | Enable analytics (`true`/`false`). Default: `true`                        |
| `tag_manager_id`   | string | No       | Google Tag Manager ID                                                     |
| `sentry_dsn`       | secret | No       | Sentry DSN for error tracking                                             |

## Authentication

This app uses the **OAuth 2.0 Device Flow**. On first load, the screen will display a URL and a short code. Open the URL on any browser, enter the code, and log in with your Salesforce credentials. The app will automatically continue once authorized and will use a refresh token to stay authenticated without requiring re-login.

## Finding Your Dashboard ID

Navigate to a dashboard in Salesforce. The Dashboard ID is in the URL:

```
/lightning/r/Dashboard/01ZXX000000XXXXX/view
                        ^^^^^^^^^^^^^^^^
                        This is your Dashboard ID
```
