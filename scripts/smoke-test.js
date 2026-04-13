#!/usr/bin/env node
"use strict";

/**
 * smoke-test.js
 *
 * Lightweight smoke test — no test framework needed.
 * Tests the auth gate on all critical routes.
 *
 * Usage:
 *   node scripts/smoke-test.js
 *
 * Requires the server to be running (npm run dev) before executing.
 * Optionally set a valid Firebase ID Token to test authenticated paths:
 *   FIREBASE_TEST_TOKEN=<token> node scripts/smoke-test.js
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";
const TOKEN = process.env.FIREBASE_TEST_TOKEN || "";

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✅  PASS  ${label}`);
    passed++;
  } catch (err) {
    console.log(`  ❌  FAIL  ${label} — ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function get(path, headers = {}) {
  const res = await fetch(`${BASE}${path}`, { headers });
  return res;
}

async function post(path, body = {}, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res;
}

(async () => {
  console.log(`\nJurident Smoke Test  →  ${BASE}\n`);

  // ── Health check (always public) ─────────────────────────────────────────
  await check("GET /health → 200", async () => {
    const res = await get("/health");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
  });

  // ── Firebase auth gate — unauthenticated requests ────────────────────────
  await check("GET /api/auth/me without token → 401", async () => {
    const res = await get("/api/auth/me");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await check("POST /api/common/init without token → 401", async () => {
    const res = await post("/api/common/init");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await check("POST /api/partyname/case-data without token → 401", async () => {
    const res = await post("/api/partyname/case-data", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await check("POST /api/cnr/search without token → 401", async () => {
    const res = await post("/api/cnr/search", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await check("POST /api/advocatename/case-data without token → 401", async () => {
    const res = await post("/api/advocatename/case-data", {});
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // ── With a valid Firebase token (optional) ───────────────────────────────
  if (TOKEN) {
    const authHeaders = { Authorization: `Bearer ${TOKEN}` };

    await check("GET /api/auth/me with valid token → 200", async () => {
      const res = await get("/api/auth/me", authHeaders);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, "Expected success: true");
      assert(json.result?.uid, "Expected uid in result");
    });

    await check("POST /api/common/init with valid token → 200", async () => {
      const res = await post("/api/common/init", {}, authHeaders);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });
  } else {
    console.log("  ⏭   SKIP  Authenticated tests (set FIREBASE_TEST_TOKEN to enable)");
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
