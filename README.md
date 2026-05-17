# Jurident eCourts Party Name API

## Index

- [Render Deployment Guide](./Render-deploy.md)
- [Base URLs](#base-urls)
- [Run Locally](#run-locally)
- [API Flow](#api-flow)
- [Important Implementation Notes](#important-implementation-notes)
- [Frontend Integration Using `mainport1.js`](#frontend-integration-using-mainport1js)
  - [Court Complex and Establishment Mapping](#court-complex-and-establishment-mapping)
  - [How Frontend Should Handle `Y` and `N`](#how-frontend-should-handle-y-and-n)
  - [Recommended UI Rule for Showing the Establishment Division](#recommended-ui-rule-for-showing-the-establishment-division)
  - [When to Trigger `/api/common/set-fields`](#when-to-trigger-apicommonset-fields)
  - [Mapping to `mainport1.js` Search Functions](#mapping-to-mainport1js-search-functions)
- [Formal Frontend Mapping](#formal-frontend-mapping)
- [Business Detail API and Frontend Printing](#business-detail-api-and-frontend-printing)
  - [Recommended Frontend Business Detail Flow](#recommended-frontend-business-detail-flow)
  - [Recommended Print Strategy](#recommended-print-strategy)
- [Formal Mapping for the Establishment Division](#formal-mapping-for-the-establishment-division)
- [Common APIs](#common-apis)
  - [1. Initialize Session](#1-initialize-session)
  - [2. Get Captcha JSON](#2-get-captcha-json)
  - [3. Get Captcha Image Stream](#3-get-captcha-image-stream)
  - [4. Get Districts](#4-get-districts)
  - [5. Get Courts](#5-get-courts)
  - [6. Get Establishments](#6-get-establishments)
  - [7. Set Court Context](#7-set-court-context)
- [Party Name APIs](#party-name-apis)
  - [1. Search by Party Name](#1-search-by-party-name)
  - [2. Get Case Detail](#2-get-case-detail)
  - [3. IA Business](#3-ia-business)
  - [4. Business Detail](#4-business-detail)
  - [5. Order PDF Metadata](#5-order-pdf-metadata)
  - [6. Order PDF Binary Proxy](#6-order-pdf-binary-proxy)
- [Error Handling](#error-handling)
- [Frontend Mapping Notes](#frontend-mapping-notes)
- [Health Check](#health-check)
- [Security Hardening](#security-hardening)
- [1. Purpose and Scope](#1-purpose-and-scope)
- [2. Security Architecture (Current)](#2-security-architecture-current)
- [3. Request Flow (End-to-End)](#3-request-flow-end-to-end)
- [4. Controls and What They Prevent](#4-controls-and-what-they-prevent)
- [5. Threat Model Coverage](#5-threat-model-coverage)
- [6. Required Environment Variables](#6-required-environment-variables)
- [7. Deployment Boundary Rules](#7-deployment-boundary-rules)
- [8. Verification Checklist](#8-verification-checklist)
- [9. Operational Notes](#9-operational-notes)
- [Curl Examples](#curl-examples)
- [1) Initialize Session](#1-initialize-session-1)
- [2) Get Districts](#2-get-districts)
- [3) Get Courts](#3-get-courts)
- [4) Get Establishments](#4-get-establishments)
- [5) Set Fields](#5-set-fields)
- [6) Get Captcha](#6-get-captcha)
- [7) Case Data by Party Name](#7-case-data-by-party-name)
- [8) Case Detail](#8-case-detail)
- [9) IA Business](#9-ia-business)
- [10) Business Detail](#10-business-detail)
- [11) Order PDF](#11-order-pdf)


Express service for integrating with the Indian eCourts portal and exposing a cleaner API for:

- session bootstrap
- state / district / court / establishment discovery
- captcha retrieval
- party-name case search
- case-detail parsing
- IA business parsing
- business detail parsing
- order PDF lookup and proxying

This README documents the implemented API behavior, important payloads, response shapes, and a few portal-specific parsing decisions that matter on the frontend.

## Base URLs

- App routes are mounted under `http://<host>:<port>/api`
- Health route: `GET /health`
- Default local port: `3000`

Examples below use:

```txt
{{baseUrl}} = http://localhost:3000
```

## Run Locally

Install dependencies:

```bash
npm install
```

Start in dev mode:

```bash
npm run dev
```

Environment:

```env
PORT=3000
```

## API Flow

Typical frontend flow:

1. `POST /api/common/init`
2. `GET /api/common/captcha?sessionId=...` or `GET /api/common/captcha-image?sessionId=...`
3. `GET/POST /api/common/districts`
4. `GET/POST /api/common/courts`
5. `GET/POST /api/common/establishments`
6. `POST /api/common/set-fields`
7. `POST /api/partyname/case-data`
8. `POST /api/partyname/case-detail`
9. Optional:
   - `POST /api/partyname/ia-business`
   - `POST /api/partyname/business-detail`
   - `GET /api/partyname/order-pdf?...`

## Important Implementation Notes

- Sessions are server-side and represented by `sessionId`.
- Captcha is session-bound. If captcha fails, fetch a new captcha and retry.
- `set-fields` accepts `estCode` as optional.
- `/api/common/courts` returns extra fields derived from the portal option value:
  - `complex_number`
  - `court_codes`
  - `differ_mast_est`
- `differ_mast_est` is the key frontend flag for deciding whether establishment selection is mandatory.
  - `Y` means the frontend must show the establishment selector and send `estCode` when submitting searches.
  - `N` means the frontend can hide the establishment selector and proceed without `estCode`.
- `/api/partyname/case-data` no longer returns `sampleCases`.
- `/api/partyname/case-detail` now returns a grouped, portal-like structure in `result`.
- Empty fields are preserved in `case-detail`; they are not stripped out.
- `case-detail` sanitizes internal portal click handlers from the response:
  - removed: `business_on_date_onclick`
  - removed: `order_onclick`
  - removed: `order_href`
  - removed: `pdf_params`
  - removed: `ia_onclick`
- Order rows keep `pdfProxy` so the frontend can open order PDFs directly.
- `GET /api/partyname/business-detail` and `GET /api/partyname/business-detail/print` were intentionally removed.
  Frontend printing should now be done client-side after calling `POST /api/partyname/business-detail`.

## Frontend Integration Using `mainport1.js`

This backend is designed to support the same functional flow used in [mainport1.js](/home/krishna/Desktop/Code/Jurident%20Backend%20(%20Shared%20)/partyname2/mainport1.js).

Important frontend references from that file:

- court complex selector:
  - `#court_complex_code`
- establishment selector:
  - `#court_est_code`
- establishment container div:
  - `#est_codes`
- party-name submit function:
  - `submit_party_name()`
- case-number submit function:
  - `submitCaseNo()`
- filing-number submit function:
  - `submit_filing_no()`
- advocate submit function:
  - `submit_adv_name()`
- FIR submit function:
  - `submitFirNumber()`
- business-detail UI handler:
  - `viewBusiness(...)`
- IA business UI handler:
  - `viewIABusiness(...)`

### Court Complex and Establishment Mapping

In `mainport1.js`, the selected court complex value is split like this:

```js
var courtArr = $('#court_complex_code').val();
var court_est_arr = courtArr.split('@');
var court_complex = court_est_arr[0];
var differ_mast_est = court_est_arr[2];
```

That same pattern is now exposed by the backend in a cleaner form through `/api/common/courts`.

Instead of parsing only the raw encoded value on the frontend, use:

- `code`
  - actual `courtComplexCode` for API calls
- `complex_number`
  - full raw combined portal value
- `court_codes`
  - allowed court codes under that complex
- `differ_mast_est`
  - frontend decision flag for establishment behavior

Example court item:

```json
{
  "code": "1260008",
  "options": "Rouse Avenue District Court",
  "complex_number": "1260008@5,6,7@Y",
  "court_codes": ["5", "6", "7"],
  "differ_mast_est": "Y"
}
```

### How Frontend Should Handle `Y` and `N`

This is the most important frontend rule.

When the selected court from `/api/common/courts` has:

- `differ_mast_est = "Y"`
  - show the establishment selection div
  - call `/api/common/establishments`
  - require the user to choose an establishment
  - pass `estCode` in `/api/common/set-fields`
  - also pass `estCode` in search APIs when needed

- `differ_mast_est = "N"`
  - hide the establishment selection div
  - do not force establishment selection
  - call `/api/common/set-fields` without `estCode`

This matches the behavior seen in `mainport1.js`, where all search submit functions check:

```js
if (differ_mast_est == 'Y' && (est_code == '' || est_code == 0)) {
  errorAlert(alerts_array[71]);
  return false;
}
```

### Recommended UI Rule for Showing the Establishment Division

Use the backend response from `/api/common/courts`:

```js
if (selectedCourt.differ_mast_est === "Y") {
  showEstablishmentDiv();
  await fetchEstablishments();
} else {
  hideEstablishmentDiv();
  clearSelectedEstablishment();
}
```

Equivalent UI behavior for the legacy HTML in `mainport1.js`:

- show `[mainport1.js](/home/krishna/Desktop/Code/Jurident%20Backend%20(%20Shared%20)/partyname2/mainport1.js):2447` style container `#est_codes` only when `differ_mast_est === 'Y'`
- hide `#est_codes` when `differ_mast_est === 'N'`

### When to Trigger `/api/common/set-fields`

Frontend developers should call `set-fields` after the user has selected:

1. state
2. district
3. court complex
4. establishment only if `differ_mast_est === 'Y'`

Recommended sequence:

1. user selects state
2. call `/api/common/districts`
3. user selects district
4. call `/api/common/courts`
5. user selects court complex
6. inspect `differ_mast_est`
7. if `Y`, show establishment dropdown and call `/api/common/establishments`
8. after final selection is ready, call `/api/common/set-fields`

Recommended `set-fields` payload when `differ_mast_est = "Y"`:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "stateCode": "26",
  "distCode": "8",
  "complexCode": "1260008",
  "estCode": "5"
}
```

Recommended `set-fields` payload when `differ_mast_est = "N"`:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "stateCode": "26",
  "distCode": "8",
  "complexCode": "1260008"
}
```

### Mapping to `mainport1.js` Search Functions

The backend supports the same state/district/court/establishment dependency used by these frontend functions:

- `submit_party_name()`
- `submitCaseNo()`
- `submit_filing_no()`
- `submit_adv_name()`
- `submitFirNumber()`

Each of these functions in `mainport1.js` does the same logical preparation:

1. read `state_code`
2. read `dist_code`
3. split `court_complex_code`
4. read `est_code`
5. block submission if `differ_mast_est === 'Y'` and no establishment is selected
6. submit the final form payload

That same frontend rule should be preserved with this backend.

## Formal Frontend Mapping

Recommended frontend state mapping:

```ts
type SelectedCourt = {
  code: string;
  options: string;
  complex_number?: string;
  court_codes?: string[];
  differ_mast_est?: "Y" | "N";
};
```

Recommended derived UI state:

```ts
const requiresEstablishment = selectedCourt?.differ_mast_est === "Y";
```

Recommended request mapping:

- `stateCode` = selected state code
- `distCode` = selected district code
- `complexCode` = selected court `code`
- `courtComplexCode` = selected court `code`
- `complex_number` = selected court `complex_number`
- `estCode` = selected establishment code only when required

## Business Detail API and Frontend Printing

The original portal flow in `mainport1.js` uses `viewBusiness(...)` to:

1. fetch business detail HTML
2. inject that HTML into a visible business-detail div
3. show a print button
4. trigger browser printing through frontend code

Relevant frontend references in `mainport1.js`:

- `viewBusiness(...)`
- `printContent(id)`

The backend now intentionally supports that same pattern in a cleaner way:

- use `POST /api/partyname/business-detail` to fetch the parsed business detail and the raw HTML
- render the returned `rawHtml` or a formatted UI on the frontend
- trigger `window.print()` or your own print component from the frontend

Important:

- the backend does not generate printable business-detail PDFs anymore
- the removed routes are:
  - `GET /api/partyname/business-detail`
  - `GET /api/partyname/business-detail/print`

### Recommended Frontend Business Detail Flow

1. user clicks a row in `case_history`
2. frontend reads `business_params`
3. frontend calls `POST /api/partyname/business-detail`
4. frontend renders:
   - parsed `result`
   - or `rawHtml`
5. frontend shows a print button
6. frontend triggers browser print

Recommended payload source:

```json
{
  "sessionId": "{{sessionId}}",
  "cino": "{{caseCino}}",
  "court_code": "{{history.business_params.court_code}}",
  "state_code": "{{history.business_params.state_code}}",
  "dist_code": "{{history.business_params.dist_code}}",
  "court_complex_code": "{{selectedCourt.code}}",
  "nextdate1": "{{history.business_params.nextdate1}}",
  "case_number1": "{{history.business_params.case_number1}}",
  "disposal_flag": "{{history.business_params.disposal_flag}}",
  "businessDate": "{{history.business_params.businessDate}}",
  "national_court_code": "{{history.business_params.national_court_code}}",
  "court_no": "{{history.business_params.court_no}}",
  "search_by": "{{history.business_params.search_by}}",
  "srno": "{{history.business_params.srno}}"
}
```

### Recommended Print Strategy

Two valid frontend approaches:

- render `rawHtml` inside a print container and call `window.print()`
- map the parsed `result` into your own React/Vue/HTML component and print that component

For most UI teams, the best option is:

- use parsed `result` for regular screen UI
- keep `rawHtml` as a fallback when exact portal formatting is required

## Formal Mapping for the Establishment Division

If your frontend has a dedicated establishment wrapper like the legacy `#est_codes` div, the rule should be:

```js
const shouldShowEstablishmentDivision =
  selectedCourt?.differ_mast_est === "Y";
```

Behavior:

- if `true`
  - show the establishment division
  - fetch establishments
  - make establishment selection mandatory before submit

- if `false`
  - hide the establishment division
  - clear establishment value
  - do not require `estCode`

## Common APIs

### 1. Initialize Session

`POST /api/common/init`

Payload:

```json
{}
```

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Session initialized successfully",
  "result": {
    "sessionId": "sess_1774780000000_abcd1234"
  }
}
```

### 2. Get Captcha JSON

`GET /api/common/captcha?sessionId={{sessionId}}`

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Captcha fetched successfully",
  "result": {
    "captcha": "https://services.ecourts.gov.in/ecourtindia_v6/vendor/securimage/securimage_show.php?...",
    "contentType": "image/png"
  }
}
```

### 3. Get Captcha Image Stream

`GET /api/common/captcha-image?sessionId={{sessionId}}`

Returns the image stream directly.

Backward-compatible aliases also exist:

- `GET /api/partyname/captcha?sessionId={{sessionId}}`
- `GET /api/partyname/captcha-image?sessionId={{sessionId}}`

### 4. Get Districts

`GET /api/common/districts?sessionId={{sessionId}}&stateCode=26`

Also supports `POST`.

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Districts fetched successfully",
  "result": {
    "state_code": "26",
    "districts": [
      {
        "code": "8",
        "options": "Central"
      }
    ],
    "name": {
      "Central": "8"
    }
  },
  "rawHtml": "<option value=\"8\">Central</option>"
}
```

### 5. Get Courts

`GET /api/common/courts?sessionId={{sessionId}}&stateCode=26&distCode=8`

Also supports `POST`.

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Courts fetched successfully",
  "result": {
    "state_code": "26",
    "dist_code": "8",
    "courts": [
      {
        "code": "1260008",
        "options": "Rouse Avenue District Court",
        "complex_number": "1260008@5,6,7@Y",
        "court_codes": ["5", "6", "7"],
        "differ_mast_est": "Y"
      }
    ],
    "name": {
      "Rouse Avenue District Court": "1260008"
    }
  },
  "rawHtml": "<option ...>"
}
```

### 6. Get Establishments

`GET /api/common/establishments?sessionId={{sessionId}}&stateCode=26&distCode=8&courtComplexCode=1260008`

Also supports `POST`.

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Establishments fetched successfully",
  "result": {
    "state_code": "26",
    "dist_code": "8",
    "court_complex_code": "1260008",
    "establishments": [
      {
        "code": "5",
        "options": "District and Sessions Judge cum Special Judge PC Act CBI, Rouse Avenue"
      }
    ],
    "name": {
      "District and Sessions Judge cum Special Judge PC Act CBI, Rouse Avenue": "5"
    }
  },
  "rawHtml": "<option ...>"
}
```

### 7. Set Court Context

`POST /api/common/set-fields`

Payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "stateCode": "26",
  "distCode": "8",
  "complexCode": "1260008",
  "estCode": "5"
}
```

Notes:

- `estCode` is optional.
- `complexCode`, `complex_code`, and `complex_number` are accepted aliases.

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Fields set successfully",
  "result": {
    "stateCode": "26",
    "distCode": "8",
    "complexCode": "1260008",
    "estCode": "5"
  }
}
```

## Party Name APIs

### 1. Search by Party Name

`POST /api/partyname/case-data`

Required payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "petresName": "RAHUL",
  "rgyearP": "2024",
  "caseStatus": "Disposed",
  "captchaCode": "A1B2C"
}
```

Optional payload:

```json
{
  "stateCode": "26",
  "distCode": "8",
  "courtComplexCode": "1260008",
  "estCode": "5",
  "fetchDetails": false,
  "fetchIABusiness": false,
  "fetchBusiness": false,
  "fetchPdf": false
}
```

Notes:

- If `stateCode/distCode/courtComplexCode` are omitted, the API uses the values stored by `set-fields`.
- `fetchDetails=true` enriches each case row with parsed case details.
- `fetchIABusiness=true` only applies when `fetchDetails=true`.
- `fetchBusiness=true` only applies when `fetchDetails=true`.
- `fetchPdf=true` only applies when `fetchDetails=true`.

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Valid party-name search result parsed from raw.party_data",
  "result": {
    "metadata": {
      "totalEstablishments": 3,
      "totalCases": 37,
      "courtName": "District and Sessions Judge cum Special Judge PC Act CBI, Rouse Avenue: 13",
      "searchBy": "partyName",
      "searchType": "CSpartyName",
      "stateCode": "26",
      "distCode": "8",
      "complexCode": "1260008"
    },
    "courtBreakdown": [
      {
        "courtName": "District and Sessions Judge cum Special Judge PC Act CBI, Rouse Avenue",
        "caseCount": 13
      }
    ],
    "parsedCases": [
      {
        "serialNumber": "1",
        "caseTypeNumberYear": "BAIL MATTERS/280/2024",
        "petitionerRespondent": "RAHUL MEENA Vs CBI",
        "viewDetails": {
          "caseNo": "207100002802024",
          "cino": "DLCT110012472024",
          "courtCode": "5",
          "hideparty": "",
          "searchFlag": "CScaseNumber",
          "stateCode": "26",
          "distCode": "8",
          "complexCode": "1260008",
          "searchBy": "CSpartyName",
          "rawOnClick": "viewHistory(...)"
        }
      }
    ],
    "nextCaptcha": {
      "captcha": "https://services.ecourts.gov.in/..."
    },
    "div_captcha": "<div class=\"form-inline text-left\">...</div>"
  },
  "rawHtml": "<div id='res_party'>...</div>"
}
```

### 2. Get Case Detail

`POST /api/partyname/case-detail`

Payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "caseNo": "207100002802024",
  "cino": "DLCT110012472024",
  "courtCode": "5",
  "hideparty": "",
  "searchFlag": "CScaseNumber",
  "stateCode": "26",
  "distCode": "8",
  "complexCode": "1260008",
  "searchBy": "CSpartyName"
}
```

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Case details fetched successfully",
  "result": {
    "court_header": {
      "court_name": "District and Sessions Judge cum Special Judge PC Act CBI, Rouse Avenue"
    },
    "case_details": {
      "case_type": "BAIL MATTERS",
      "filing_number": "1234/2024",
      "filing_date": "20-12-2024",
      "registration_number": "280/2024",
      "registration_date": "21-12-2024",
      "cnr_number": "DLCT110012472024 (Note the CNR number for future reference)",
      "e_filing_number": "",
      "e_filing_date": "-"
    },
    "case_status": {
      "first_hearing_date": "21st December 2024",
      "decision_date": "14th January 2025",
      "next_hearing_date": "",
      "case_status": "Case disposed",
      "nature_of_disposal": "Contested--ALLOWED",
      "case_stage": "",
      "court_number_and_judge": "6-Special Judge (PC Act) (CBI)"
    },
    "petitioner_and_advocate": {
      "entries": [
        "1) RAHUL MEENA",
        "Advocate- SIDHARTH SINGH"
      ]
    },
    "respondent_and_advocate": {
      "entries": [
        "1) CBI"
      ]
    },
    "acts": [
      {
        "under_act": "The Prevention of Corruption Act 1988",
        "under_section": "7"
      }
    ],
    "ia_status": [],
    "case_history": [
      {
        "judge": "Special Judge (PC Act) (CBI)",
        "business_on_date": "14-01-2025",
        "hearing_date": "",
        "purpose_of_hearing": "Disposed",
        "business_params": {
          "court_code": "5",
          "dist_code": "8",
          "nextdate1": "",
          "case_number1": "DLCT110012472024",
          "state_code": "26",
          "disposal_flag": "Disposed",
          "businessDate": "14-01-2025",
          "court_no": "6",
          "national_court_code": "DLCT11",
          "search_by": "CSpartyName",
          "srno": "0"
        }
      }
    ],
    "interim_orders": [
      {
        "order_number": "1",
        "order_date": "24-12-2024",
        "order_details": "COPY OF JUDICIAL PROCEEDINGS",
        "pdfProxy": "/api/partyname/order-pdf?sessionId=...&normal_v=...&case_val=...&court_code=...&filename=..."
      }
    ],
    "final_orders": [
      {
        "order_number": "3",
        "order_date": "14-01-2025",
        "order_details": "COPY OF ORDER",
        "pdfProxy": "/api/partyname/order-pdf?sessionId=...&normal_v=...&case_val=...&court_code=...&filename=..."
      }
    ],
    "connected_cases": []
  },
  "rawHtml": "<h2 ...>...</h2>"
}
```

Case detail parsing notes:

- `Case Status` is parsed from the dedicated status table only.
- Final orders are parsed separately from interim orders.
- Petitioner / respondent blocks are split into frontend-friendly line entries.
- Empty fields remain present as empty strings.

### 3. IA Business

`POST /api/partyname/ia-business`

Payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "ia_no": "300000012025",
  "cinoia": "TNCH010195842025",
  "ia_case_type_name": "IA",
  "ia_filno": "1",
  "ia_filyear": "2025",
  "national_court_code": "TNCH01",
  "search_by": "CSpartyName"
}
```

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "IA business fetched successfully",
  "result": {
    "case_no": "AS/127/2026",
    "entries": [
      {
        "ia_no": "IA/1/2025",
        "business_on_date": "25-03-2026",
        "hearing_date": "30-03-2026",
        "business": ""
      }
    ]
  },
  "rawHtml": "<table class='table table-bordered'>Case No:- AS/127/2026...</table>"
}
```

Parsing note:

- The parser handles malformed portal HTML where `Case No:- ...` appears directly inside the table wrapper instead of a normal cell.

### 4. Business Detail

`POST /api/partyname/business-detail`

Payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "cino": "TNCH010195842025",
  "court_code": "1",
  "state_code": "10",
  "dist_code": "13",
  "court_complex_code": "1100124",
  "nextdate1": "20260330",
  "case_number1": "TNCH010195842025",
  "disposal_flag": "Pending",
  "businessDate": "25-03-2026",
  "national_court_code": "TNCH01",
  "court_no": "1",
  "search_by": "CSpartyName",
  "srno": "1"
}
```

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Business details fetched successfully",
  "result": {
    "court_of": "PRINCIPAL JUDGE",
    "cnr_number": "TNCH010195842025",
    "case_number": "AS/127/2026",
    "date": "25-03-2026",
    "parties": "A.Sujatha versus Leela Kumari Surana",
    "business": "Service Pending",
    "next_purpose": "Service Pending",
    "next_hearing_date": "30-03-2026"
  },
  "rawHtml": "<center>...</center>"
}
```

Important:

- Printing is now expected to be handled by the frontend.
- Removed APIs:
  - `GET /api/partyname/business-detail`
  - `GET /api/partyname/business-detail/print`

### 5. Order PDF Metadata

`POST /api/partyname/order-pdf`

Payload:

```json
{
  "sessionId": "sess_1774780000000_abcd1234",
  "normal_v": "cl+sGJoSJ58oyVespa8VHg==",
  "case_val": "LSrhY6cU9FX1/kEaaTYf3wVe74QzTqkMBxlr9t2i0Mo=",
  "court_code": "nqiuSM0AkgdvpVg64f0N3g==",
  "filename": "LU07CPYto9jjJWJ/kaDeF4MGvG5k+Nb3bvqBBzGal+3j3POwi8YM69kM/Wh1mcgv",
  "appFlag": ""
}
```

Sample response:

```json
{
  "success": true,
  "status": 1,
  "message": "Order PDF metadata fetched successfully",
  "result": {
    "pdf_url": "https://services.ecourts.gov.in/ecourtindia_v6/...pdf",
    "raw_path": "/ecourtindia_v6/..."
  }
}
```

### 6. Order PDF Binary Proxy

`GET /api/partyname/order-pdf?sessionId=...&normal_v=...&case_val=...&court_code=...&filename=...&appFlag=...`

Returns the PDF stream directly.

This route is used by `case-detail` order items through `pdfProxy`.

## Error Handling

Typical error shape:

```json
{
  "success": false,
  "status": 0,
  "error": "Some error message"
}
```

Common error cases:

- missing `sessionId`
- missing required payload fields
- invalid captcha
- stale session
- empty upstream response from eCourts

Special note for captcha failure in `case-data`:

- response may include `nextCaptcha`
- frontend should refresh captcha and retry

## Frontend Mapping Notes

Recommended frontend mapping for `case-detail.result`:

- `court_header.court_name`
- `case_details`
- `case_status`
- `petitioner_and_advocate.entries`
- `respondent_and_advocate.entries`
- `acts`
- `ia_status`
- `case_history`
- `interim_orders`
- `final_orders`
- `connected_cases`

Examples:

- render `petitioner_and_advocate.entries` as one line per array item
- render `case_history[*].business_params` as hidden metadata for later detail fetch
- render order rows with `pdfProxy`
- use `business-detail` response HTML or parsed result to trigger browser print from the frontend

## Health Check

`GET /health`

Response:

```json
{
  "ok": true
}
```

---

## Security Hardening

# District-court-scraper Security Hardening Walkthrough

## 1. Purpose and Scope
This document covers the complete security-hardening implementation for District-court-scraper and the threats it addresses.

## 2. Security Architecture (Current)
- Frontend sends all traffic to District Gateway.
- Gateway signs `/api/*` requests with HMAC server-side.
- Internal District backend verifies HMAC before protected routes.
- Existing API contracts remain unchanged.

## 3. Request Flow (End-to-End)
1. Gateway receives client request.
2. Gateway applies security headers/CORS/rate controls.
3. Gateway generates `x-timestamp` and `x-signature` for `/api/*`.
4. Gateway forwards request to internal backend.
5. Backend applies Helmet, CORS, rate limiting, and request logging.
6. Backend verifies HMAC and timestamp validity.
7. Route/controller logic executes.
8. Not-found/error handlers return controlled output.

## 4. Controls and What They Prevent
- Helmet headers:
  Strengthens browser-side security posture.
- CORS allow-list:
  Prevents unauthorized browser origins in production.
- Rate limiting:
  Reduces high-volume abuse and scraping bursts.
- Gateway-only secret handling:
  Prevents frontend secret exposure.
- Backend HMAC verification:
  Prevents unsigned direct backend calls.
- Replay-window timestamp checks:
  Prevents reuse of captured signatures.
- Timing-safe signature comparison:
  Reduces timing attack risk in compare operation.
- Request logging + burst alerts:
  Detects suspicious traffic patterns early.
- Safe error handling:
  Prevents internal implementation leakage.

## 5. Threat Model Coverage
- Direct access to internal backend endpoints:
  Denied without valid gateway signature.
- Replay of old signed requests:
  Denied by timestamp expiration logic.
- Frontend reverse engineering for secret theft:
  No HMAC secret on client side.
- Automated scraping bursts:
  Rate-limited and logged.

## 6. Required Environment Variables
Gateway:
- `GATEWAY_PORT`
- `INTERNAL_SERVICE_URL`
- `INTERNAL_HMAC_SECRET` (preferred) or `HMAC_SECRET`

Backend:
- `PORT`
- `INTERNAL_HMAC_SECRET` (preferred) or `HMAC_SECRET`
- existing District envs (`ALLOWED_ORIGINS`, service config)

## 7. Deployment Boundary Rules
- Public endpoint = Gateway only.
- Backend must stay internal-only.
- Gateway/backend secret must match for that service pair.
- Rotate and audit secrets/signature failures periodically.

## 8. Verification Checklist
- Gateway `/health` returns `200`.
- Gateway `/api/*` succeeds without client HMAC headers.
- Direct backend `/api/*` without signature returns `401`.
- Tampered/expired signatures are rejected.

## 9. Operational Notes
- API names, payload keys, and frontend flow remain stable.
- Hardening is implemented by gateway + backend middleware layers.

---

## Curl Examples

# District Court API - cURL + Postman Raw JSON

Base URL:
`https://district-court-scraper.onrender.com`

## 1) Initialize Session
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/common/init" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Postman Body:
```json
{}
```

## 2) Get Districts
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/common/districts" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "stateCode": "26"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "stateCode": "26"
}
```

## 3) Get Courts
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/common/courts" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "stateCode": "10",
    "distCode": "13"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "stateCode": "10",
  "distCode": "13"
}
```

## 4) Get Establishments
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/common/establishments" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "stateCode": "10",
    "distCode": "13",
    "courtComplexCode": "1100124"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "stateCode": "10",
  "distCode": "13",
  "courtComplexCode": "1100124"
}
```

## 5) Set Fields
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/common/set-fields" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "complexCode": "1100124@1,3,4,5,9,14,15,16,24,26@N",
    "stateCode": "10",
    "distCode": "13",
    "estCode": ""
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "complexCode": "1100124@1,3,4,5,9,14,15,16,24,26@N",
  "stateCode": "10",
  "distCode": "13",
  "estCode": ""
}
```

## 6) Get Captcha
```bash
curl -X GET "https://district-court-scraper.onrender.com/api/common/captcha?sessionId={{session_id}}"
```

## 7) Case Data by Party Name
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/partyname/case-data" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "petresName": "kumar",
    "rgyearP": "2026",
    "caseStatus": "Both",
    "captchaCode": "mmtrmb"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "petresName": "kumar",
  "rgyearP": "2026",
  "caseStatus": "Both",
  "captchaCode": "mmtrmb"
}
```

## 8) Case Detail
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/partyname/case-detail" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "caseNo": "230200001272026",
    "cino": "TNCH010195842025",
    "courtCode": "1",
    "hideparty": "",
    "searchFlag": "CScaseNumber",
    "stateCode": "10",
    "distCode": "13",
    "complexCode": "1100124",
    "searchBy": "CSpartyName"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "caseNo": "230200001272026",
  "cino": "TNCH010195842025",
  "courtCode": "1",
  "hideparty": "",
  "searchFlag": "CScaseNumber",
  "stateCode": "10",
  "distCode": "13",
  "complexCode": "1100124",
  "searchBy": "CSpartyName"
}
```

## 9) IA Business
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/partyname/ia-business" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "ia_no": "300000012025",
    "cinoia": "TNCH010195842025",
    "ia_case_type_name": "IA",
    "ia_filno": "1",
    "ia_filyear": "2025",
    "national_court_code": "TNCH01",
    "search_by": "CSpartyName"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "ia_no": "300000012025",
  "cinoia": "TNCH010195842025",
  "ia_case_type_name": "IA",
  "ia_filno": "1",
  "ia_filyear": "2025",
  "national_court_code": "TNCH01",
  "search_by": "CSpartyName"
}
```

## 10) Business Detail
```bash
curl -X POST "https://district-court-scraper.onrender.com/api/partyname/business-detail" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{{session_id}}",
    "cino": "TNCH010195842025",
    "court_code": "1",
    "dist_code": "13",
    "nextdate1": "20260330",
    "case_number1": "TNCH010195842025",
    "state_code": "10",
    "disposal_flag": "Pending",
    "businessDate": "25-03-2026",
    "court_no": "1",
    "national_court_code": "TNCH01",
    "search_by": "CSpartyName",
    "srno": "1"
  }'
```
Postman Body:
```json
{
  "sessionId": "{{session_id}}",
  "cino": "TNCH010195842025",
  "court_code": "1",
  "dist_code": "13",
  "nextdate1": "20260330",
  "case_number1": "TNCH010195842025",
  "state_code": "10",
  "disposal_flag": "Pending",
  "businessDate": "25-03-2026",
  "court_no": "1",
  "national_court_code": "TNCH01",
  "search_by": "CSpartyName",
  "srno": "1"
}
```

## 11) Order PDF
```bash
curl -X GET "https://district-court-scraper.onrender.com/api/partyname/order-pdf?sessionId={{session_id}}&normal_v={{normal_v}}&case_val={{case_val}}&court_code={{court_code}}&filename={{filename}}&appFlag={{appFlag}}"
```
