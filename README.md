# Salesforce Dashboard App

Displays Salesforce dashboards on your Screenly digital signage screens using the Salesforce Reports & Dashboards REST API.

![Salesforce Dashboard App Preview](screenshots/3840x2160.webp)

## Prerequisites

- [Bun](https://bun.sh/) 1.2.2+
- [Screenly CLI](https://developer.screenly.io/edge-apps/#getting-started)
- A Salesforce account (a free [Developer Edition](https://www.salesforce.com/products/free-trial/developer/) account works)

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

For local development without depending on the Screenly backend, use the [mock-authenticator](mock-authenticator/README.md). It simulates the Screenly OAuth service by running a local Device Flow against Salesforce and serving the resulting tokens to the Edge App.

After `mock-data.yml` is generated, fill in your values under `settings`:

```yaml
settings:
  dashboard_id: '<your Salesforce Dashboard ID>'
  display_errors: 'false'
  refresh_interval: '300'
  screenly_app_auth_token: mock-token
  screenly_oauth_tokens_url: 'http://localhost:3000/'
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

This generates screenshots for all supported resolutions into the `screenshots/` directory using mocked API data. It produces dashboard screenshots (`<width>x<height>.webp`) for all standard Screenly resolutions, showing a fully rendered dashboard with bar, donut, line, and table widgets.

![Auth screen screenshot](screenshots/auth-3840x2160.webp)

## Deployment

```bash
screenly edge-app create --name salesforce-app --in-place
bun run deploy
screenly edge-app instance create
```

## Configuration

| Setting            | Type   | Required | Description                                                                    |
| ------------------ | ------ | -------- | ------------------------------------------------------------------------------ |
| `access_token`     | secret | No       | For testing only. In production, the token is fetched dynamically via the API. |
| `dashboard_id`     | string | Yes      | Salesforce Dashboard ID to display                                             |
| `refresh_interval` | string | No       | How often (in seconds) to refresh dashboard data. Default: `300`               |
| `display_errors`   | string | No       | Display errors on screen for debugging (`true`/`false`). Default: `false`      |

## Authentication

This app uses the Screenly OAuth service to obtain a Salesforce access token at runtime. For local development, the `mock-authenticator` acts as a stand-in for that service.

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
