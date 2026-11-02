# CampusNotes — Student Contribution 404 Fix Report

## 1. Root Cause (Confirmed)

**The submission failed with `404 Not Found` because the updated Cloudflare Worker had never been deployed.**

The new contribution endpoints (`/submissions/init`, `/submissions/:id/upload`, `/submissions`, `/submissions/:id/approve`, etc.) existed only in the local working-tree source code on branch `feature/large-file-uploads-and-contributions`. The live Worker at `https://campusnotes-pdf-api.ayanmull8886.workers.dev` was still running the old pre-contribution version with no `/submissions` routes.

Additionally, a **second critical bug** was found that would have caused the Worker to crash immediately upon deployment:

> **Cloudflare Workers Runtime Error**: `Incorrect type for map entry 'MAX_FILE_SIZE_BYTES': the provided value is not of type 'function or ExportedHandler'`

The Worker source exported non-handler values at module top level:
```typescript
// index.ts — these caused a runtime crash
export const MAX_FILE_SIZE_BYTES = 52428800;       // ← invalid export for CF Workers
export const MAX_FILE_SIZE_ERROR = '...';           // ← invalid export for CF Workers
export function sanitizeFilename(...) {...}          // ← invalid export for CF Workers
export interface ParsedByteRange {...}               // ← invalid export for CF Workers
export function parseByteRange(...) {...}            // ← invalid export for CF Workers
```

The Cloudflare Workers runtime treats every `export const/function` in a Worker module as a potential named entrypoint. When it encountered `MAX_FILE_SIZE_BYTES`, a plain number, it crashed before any requests could be handled.

---

## 2. Exact Failing Endpoint and HTTP Status

| Endpoint | Method | Expected | Actual (live Worker) |
|---|---|---|---|
| `/submissions/init` | `POST` | `200 OK` with `submissionId`, `uploadToken` | `404 Not Found` |
| `/submissions/:id/upload` | `PUT` | `201 Created` | Never reached |
| `/submissions` | `GET` | `200 OK` (admin) | `404 Not Found` |
| `/submissions/:id/approve` | `POST` | `200 OK` (admin) | `404 Not Found` |
| `/submissions/:id/reject` | `POST` | `200 OK` (admin) | `404 Not Found` |
| `/submissions/:id` | `DELETE` | `200 OK` (admin) | `404 Not Found` |

The live Worker `/health` returned `200 OK` (old routes work), but all new submission routes returned `{"error":"Not found"}`.

---

## 3. Fix Implemented

### Fix 1: Extract shared utilities to `worker/src/utils.ts`

Created [`worker/src/utils.ts`](file:///C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/src/utils.ts) containing:
- `MAX_FILE_SIZE_BYTES` (52,428,800)
- `MAX_FILE_SIZE_ERROR`
- `ParsedByteRange` interface
- `parseByteRange()` function
- `sanitizeFilename()` function

### Fix 2: Remove invalid `export` keywords from `worker/src/index.ts`

Removed all non-handler top-level exports from [`worker/src/index.ts`](file:///C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/src/index.ts). The file now exports **only** `export default { fetch }` — the sole valid Cloudflare Workers entrypoint.

Updated the import block in `index.ts` to import the utilities from `./utils.ts`:
```typescript
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_ERROR,
  parseByteRange,
  sanitizeFilename,
} from './utils.ts';
import type { ParsedByteRange } from './utils.ts';
```

### Fix 3: Update test imports

Updated [`worker/test/worker.test.mjs`](file:///C:/Users/ayanm/.gemini/antigravity-ide/scratch/campusnotes/worker/test/worker.test.mjs) to import `parseByteRange` from `../src/utils.ts` instead of `../src/index.ts`:
```js
import worker from '../src/index.ts';
import { parseByteRange } from '../src/utils.ts';
```

---

## 4. API Route Mapping (Frontend ↔ Worker)

| Use Case | Frontend Caller | HTTP | Worker Route | Auth |
|---|---|---|---|---|
| Init anonymous submission | `contributionService.ts` | `POST` | `/submissions/init` | None |
| Upload file binary | `contributionService.ts` | `PUT` | `/submissions/:id/upload` | `X-Upload-Token` header |
| List all submissions | `contributionService.ts` | `GET` | `/submissions?status=...` | Firebase Admin Bearer |
| Preview pending file | `contributionService.ts` | `GET` | `/submissions/:id/file` | Firebase Admin Bearer |
| Approve submission | `contributionService.ts` | `POST` | `/submissions/:id/approve` | Firebase Admin Bearer |
| Reject submission | `contributionService.ts` | `POST` | `/submissions/:id/reject` | Firebase Admin Bearer |
| Delete submission | `contributionService.ts` | `DELETE` | `/submissions/:id` | Firebase Admin Bearer |

Worker base URL: `https://campusnotes-pdf-api.ayanmull8886.workers.dev` (from `src/config/firebase.ts`)

---

## 5. Files Changed

| File | Change |
|---|---|
| `worker/src/utils.ts` | **Created** — shared utilities extracted from `index.ts` |
| `worker/src/index.ts` | Removed invalid exports; added import from `./utils.ts` |
| `worker/test/worker.test.mjs` | Updated `parseByteRange` import to come from `../src/utils.ts` |
| `scripts/test-contribution-integration.mjs` | **Created** — full live integration test suite |

---

## 6. Integration Test Results (Local Wrangler Dev)

**Tested against local `wrangler dev --local --port 8787`** — this runs the exact same Worker source code that will be deployed, using local Miniflare R2 simulation.

```
======================================================================
  CAMPUSNOTES — CONTRIBUTION INTEGRATION TEST (Local Wrangler)
======================================================================

  [PASS] GET /health returns 200 with version 2.1.0
  [PASS] OPTIONS /submissions/init returns CORS 204 with correct headers
  [PASS] POST /submissions/init returns submissionId, uploadToken, uploadUrl
  [PASS] PUT /submissions/:id/upload with valid PDF returns 201 and success message
  [PASS] ZIP file submission initializes and uploads correctly
  [PASS] DOCX file (PK ZIP header) submission uploads correctly
  [PASS] PPTX file (PK ZIP header) submission uploads correctly
  [PASS] PNG image submission uploads correctly
  [PASS] 10 MB PDF submission initializes successfully
  [PASS] 49 MB file initialization is accepted
  [PASS] Exactly 50 MB (52,428,800 bytes) is accepted at init
  [PASS] 51 MB file (53,477,376 bytes) is rejected with 413 at init
  [PASS] Above 50 MB (52,428,801 bytes) is rejected with 413 at init
  [PASS] Honeypot-filled submission is rejected with 400
  [PASS] Executable file (.exe) is rejected with 400
  [PASS] Upload with missing token is rejected with 401 or 403
  [PASS] Upload with wrong token is rejected with 401 or 403
  [PASS] Pending files are NOT accessible to public (unauthenticated)
  [PASS] GET /submissions without admin auth returns 401
  [PASS] GET /unknown-route returns 404 with JSON error (not raw string)
  [PASS] /submissions/init with GET method returns 404 (method not allowed)

  INTEGRATION RESULTS: 21 PASSED, 0 FAILED
```

Worker unit test suite: **62/62 passed, 0 failed**  
Frontend production build: **`tsc -b && vite build` — clean, 0 errors**

---

## 7. Live Worker vs. Local Verification Status

| Check | Local (wrangler dev) | Live Worker |
|---|---|---|
| `/health` | ✅ 200 OK (v2.1.0) | ⚠️ 200 OK (v2.0.0, old) |
| `POST /submissions/init` | ✅ 200 OK | ❌ 404 Not Found |
| `PUT /submissions/:id/upload` | ✅ 201 Created | ❌ 404 Not Found |
| `GET /submissions` (admin) | ✅ 200 OK (admin auth) | ❌ 404 Not Found |
| CORS from localhost:5173 | ✅ Correct headers | ✅ Correct (existing) |

---

## 8. Deployment Requirement

> [!IMPORTANT]
> The fix is **completely implemented and tested locally**. All 21 integration tests and 62 unit tests pass.
>
> The **only remaining step** is to deploy the updated Worker using Wrangler:
> ```bash
> cd worker
> npx wrangler deploy
> ```
> This requires Cloudflare authentication (`wrangler login`). Per your approval gate, this has **NOT** been done.
>
> Once deployed, `POST https://campusnotes-pdf-api.ayanmull8886.workers.dev/submissions/init` will return `200 OK` and the full contribution flow will work on the live site.

