# Partyname Module

This module now uses a layered layout:

- `search/routes.js`
- `search/controller.js`
- `search/service.js`
- `search/parsers/`
- `search/utils/`
- `search/store/`

When a new partyname search type is added, create it as a sibling module here instead of extending the existing `search/` files directly.

Suggested future layout:

- `src/modules/partyname/case-number/`
- `src/modules/partyname/cnr/`
- `src/modules/partyname/filing-number/`
- `src/modules/partyname/advocate-name/`

Each new type should follow the same pattern:

- `routes.js`
- `controller.js`
- `service.js`
- `parsers/`
- `utils/`
