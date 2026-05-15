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
