# Report Support — Research & Design Notes

## Background

The app currently only supports Salesforce **dashboards**. This document summarises the research and design discussion around adding **report** support.

## Salesforce API

Both dashboards and reports are accessible via the Salesforce Reports & Dashboards REST API:

| Content type | Endpoint                                             |
| ------------ | ---------------------------------------------------- |
| Dashboard    | `GET /services/data/vXX.0/analytics/dashboards/{id}` |
| Report       | `GET /services/data/vXX.0/analytics/reports/{id}`    |

Salesforce IDs have deterministic 3-character key prefixes:

| Content type | ID prefix | Example              |
| ------------ | --------- | -------------------- |
| Dashboard    | `01Z`     | `01Zg5000002iDwTEAU` |
| Report       | `00O`     | `00Og5000004NOlhEAG` |

This means the content type **can be auto-detected from the ID alone** without any additional input from the user.

## Reference: PowerBI Edge App

The [PowerBI Edge App](https://github.com/Screenly/Playground/tree/master/edge-apps/powerbi) in `Screenly/Playground` supports both dashboards and reports via a **single unified setting** (`embed_url`). The content type is derived from the URL itself:

```javascript
function getEmbedTypeFromUrl(url) {
  switch (true) {
    case url.indexOf('/dashboard') !== -1:
      return 'dashboard'
    default:
      return 'report'
  }
}
```

There is no separate type selector — the URL carries the type implicitly.

## UX Discussion

### Option 1: Auto-detect from ID prefix

- User pastes a single ID; the app detects the type from the `01Z`/`00O` prefix.
- Pros: no extra setting, no user error possible on the type field.
- Cons: users still have to find and copy an 18-character ID from the Salesforce URL, which is friction for most people.

### Option 2: Type selector dropdown + ID field

- User selects "Dashboard" or "Report" from a dropdown, then pastes the corresponding ID.
- Consistent with what the fullstack developer will implement.
- Pros: explicit, easy to understand in the settings UI.
- Cons: slight redundancy if auto-detection is possible.

### Option 3: Dynamic dropdown (list from API)

- App queries `GET /analytics/dashboards` and `GET /analytics/reports` and presents a picker showing human-readable names.
- Best UX — user never sees an ID.
- **Blocked** on whether the Screenly Edge Apps platform supports dynamic (API-driven) dropdowns in the settings UI. Needs confirmation from the backend developer.

## Decision

- **Pending fullstack developer input** on the settings UI approach (static dropdown vs dynamic).
- For now, plan to add a **type selector setting** (Dashboard / Report) alongside the existing ID field, consistent with what the fullstack developer will implement.
- Auto-detection from ID prefix is technically viable as a fallback or future simplification.

## TODO

- [ ] Confirm with fullstack developer whether dynamic dropdowns are supported in the Screenly settings UI.
- [ ] Add a `content_type` setting (dropdown: Dashboard / Report) to `screenly.yml`.
- [ ] Rename `dashboard_id` setting to a more generic name (e.g. `content_id`) or keep separate `dashboard_id` / `report_id` fields — decide with the team.
- [ ] Implement report rendering: the Reports API response has a flat `factMap` with no `dashboardMetadata`/`componentData` wrapper, so it renders as a single chart or table rather than a multi-widget grid.
