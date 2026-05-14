# Salesforce Dashboard App

Displays Salesforce dashboards on your Screenly digital signage screens using the Salesforce Reports & Dashboards REST API.

## Prerequisites

- [Bun](https://bun.sh/) 1.2.2+
- [Screenly CLI](https://developer.screenly.io/edge-apps/#getting-started)
- A Salesforce account with a Connected App configured for OAuth 2.0 Device Flow (a free [Developer Edition](https://www.salesforce.com/products/free-trial/developer/) account works)

## Setting Up a Salesforce Connected App

1. In Salesforce, go to **Setup &rarr; Apps &rarr; App Manager**
2. Click **New External Client App**
3. Fill in **External Client App Name** (e.g. `screenly-salesforce-edge-app`) and **Contact Email**
4. Expand **API (Enable OAuth Settings)** and check **Enable OAuth**
5. Set **Callback URL** to `https://localhost/callback`
6. Under **OAuth Scopes**, add: `Manage user data via APIs (api)` (may appear as `Access and manage your data (api)` in older orgs) and `Perform requests at any time (refresh_token, offline_access)`
7. Leave **Introspect all Tokens** and **Configure ID token** unchecked
8. Under **Flow Enablement**, check **Enable Device Flow** only; leave all others unchecked
9. Under **Security**, leave the three pre-checked options as-is (**Require secret for Web Server Flow**, **Require secret for Refresh Token Flow**, **Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows**)
10. Leave **Web App (Enable SAML Settings)**, **Canvas App Settings**, **Mobile App Settings**, **Push Notification Settings**, and **Notification Settings** collapsed and unconfigured
11. Click **Create**
12. On the app detail page, go to **Settings &rarr; OAuth Settings &rarr; Consumer Key and Secret** (requires identity verification) and copy the **Consumer Key** (this is your `client_id` setting). The Consumer Secret is not needed.

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

This generates a `mock-data.yml` file (gitignored), starts the dev server, and starts a local CORS proxy on `http://127.0.0.1:8080`.

After `mock-data.yml` is generated, fill in your values under `settings`:

```yaml
settings:
  client_id: '<your Salesforce Connected App Consumer Key>'
  dashboard_id: '<your Salesforce Dashboard ID>'
  refresh_interval: '300'
  display_errors: 'false'
```

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

## Authentication

This app uses the **OAuth 2.0 Device Flow**. On first load, the screen will display a URL and a short code. Open the URL on any browser, enter the code, and log in with your Salesforce credentials. The app will automatically continue once authorized and will use a refresh token to stay authenticated without requiring re-login.

## Finding Your Dashboard ID

Navigate to a dashboard in Salesforce. The Dashboard ID is in the URL:

```
/lightning/r/Dashboard/01ZXX000000XXXXX/view
                        ^^^^^^^^^^^^^^^^
                        This is your Dashboard ID
```

## Supported Visualizations

The app renders dashboard components based on the visualization type configured in Salesforce:

| Visualization Type | Rendering            | Notes                                         |
| ------------------ | -------------------- | --------------------------------------------- |
| `Bar`              | Horizontal bar chart | Grouped by report row groupings               |
| `Column`           | Vertical bar chart   | Grouped by report row groupings               |
| `Line`             | Line chart           | Grouped by report row groupings               |
| `Pie`              | Pie chart            | Grouped by report row groupings               |
| `Donut`            | Doughnut chart       | Grouped by report row groupings               |
| `Gauge`            | Gauge chart          | Requires breakpoints configured in Salesforce |
| `FlexTable`        | HTML table           | Tabular reports with detail rows              |
