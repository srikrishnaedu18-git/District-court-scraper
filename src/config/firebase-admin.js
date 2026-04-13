"use strict";

/**
 * Firebase Admin SDK — initialised using Application Default Credentials (ADC).
 *
 * On GCP (Cloud Run, GKE, App Engine, Compute Engine):
 *   - No configuration needed. The metadata server provides credentials
 *     automatically via the service account attached to the GCP resource.
 *
 * For local development:
 *   1. Download a service account JSON from GCP Console → IAM → Service Accounts.
 *   2. Set the path in your .env:
 *        GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   3. Firebase Admin picks it up automatically via ADC.
 *
 * Never commit the service account JSON to git.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  // initializeApp() with no arguments uses ADC — works out-of-the-box on GCP.
  admin.initializeApp();
}

module.exports = admin;
