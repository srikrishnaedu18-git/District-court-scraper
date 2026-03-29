# Jurident eCourts Party Name API

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
