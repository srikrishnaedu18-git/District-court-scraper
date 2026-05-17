# District Court Render Deployment Guide

## Purpose

This service is deployed on Render as a single web service that starts both:

- the internal backend on `INTERNAL_BACKEND_PORT`
- the public gateway on Render's `PORT`

The gateway signs requests with HMAC and forwards them to the internal backend.

## Render Build Settings

- Runtime: Node
- Build command: `npm ci --omit=dev`
- Start command: `npm run render:start`
- Health check path: `/health`

If you deploy with Docker, the included `Dockerfile` already runs `npm run render:start`.

## Required Environment Variables

- `NODE_ENV=production`
- `PORT=8080` or Render-provided `PORT`
- `INTERNAL_BACKEND_PORT=3000`
- `INTERNAL_SERVICE_URL=http://127.0.0.1:3000`
- `ALLOWED_ORIGINS=https://jurident.com,https://www.jurident.com`
- `HMAC_SECRET=<generated-secret>`
- `INTERNAL_HMAC_SECRET=<same-or-stronger-generated-secret>`

Service-specific variables from `.env.example` are still required, such as Firebase credentials, portal cookies, or court-specific session values.

## Request Path

1. Client calls the Render public URL.
2. Gateway receives the request on `PORT`.
3. Gateway signs `/api/*` traffic with `x-timestamp` and `x-signature`.
4. Backend verifies the signature.
5. Backend returns normal success payloads unchanged.
6. Errors return structured error payloads with `area`, `reason`, `code`, `status`, and request metadata.

## Success Response Policy

Successful controller/service responses must stay backward compatible. The refinements in this repo are limited to gateway, auth, validation, HMAC, rate-limit, not-found, body-parser, and global error responses.

## Deployment Checklist

- Set all variables from `.env.example`.
- Use `npm run render:start` as the Render start command.
- Confirm `INTERNAL_SERVICE_URL` points to `127.0.0.1`, not the public Render URL.
- Confirm `HMAC_SECRET` and `INTERNAL_HMAC_SECRET` are configured.
- Deploy and check the health endpoint.
- Test one valid success request to confirm the existing response shape is unchanged.
- Test one invalid request to confirm structured error details are returned.
