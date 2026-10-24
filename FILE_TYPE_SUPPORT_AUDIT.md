# CampusNotes — Multi-Format File Support Audit & Specification

## 1. Executive Summary
CampusNotes has been upgraded from a PDF-only architecture to a comprehensive, secure multi-format material and private assignment sharing platform supporting **15 industry-standard file formats**.

All tiers of the application—from the Admin Dashboard upload modals, client-side validation, Cloudflare Workers, Cloudflare R2 object storage, to the public material viewer and zero-login private sharing recipient page—have been verified and hardened with strict binary magic byte inspection and anti-traversal security.

---

## 2. Complete Supported Formats Matrix

| Extension | Category | Official MIME Type | In-Browser Preview | Content-Disposition Default | Magic Byte / Signature Validation |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **.pdf** | Document | `application/pdf` | Yes (`<iframe>`) | `inline` | `%PDF-` (`0x25 0x50 0x44 0x46`) |
| **.doc** | Document | `application/msword` | No (Card + Download) | `attachment` | OLE Compound (`0xD0 0xCF 0x11 0xE0`) |
| **.docx** | Document | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | No (Card + Download) | `attachment` | PK Zip Header (`0x50 0x4B 0x03 0x04`) |
| **.txt** | Document | `text/plain; charset=utf-8` | Yes (Text View) | `inline` | Printable UTF-8 / ASCII, null-byte rejection |
| **.rtf** | Document | `application/rtf` | No (Card + Download) | `attachment` | `{\rtf` (`0x7B 0x5C 0x72 0x74 0x66`) |
| **.ppt** | Presentation | `application/vnd.ms-powerpoint` | No (Card + Download) | `attachment` | OLE Compound (`0xD0 0xCF 0x11 0xE0`) |
| **.pptx** | Presentation | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | No (Card + Download) | `attachment` | PK Zip Header (`0x50 0x4B 0x03 0x04`) |
| **.xls** | Spreadsheet | `application/vnd.ms-excel` | No (Card + Download) | `attachment` | OLE Compound (`0xD0 0xCF 0x11 0xE0`) |
| **.xlsx** | Spreadsheet | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | No (Card + Download) | `attachment` | PK Zip Header (`0x50 0x4B 0x03 0x04`) |
| **.csv** | Spreadsheet | `text/csv; charset=utf-8` | Yes (Text View) | `inline` | Printable text, null-byte rejection |
| **.jpg** | Image | `image/jpeg` | Yes (`<img>`) | `inline` | SOI (`0xFF 0xD8 0xFF`) |
| **.jpeg** | Image | `image/jpeg` | Yes (`<img>`) | `inline` | SOI (`0xFF 0xD8 0xFF`) |
| **.png** | Image | `image/png` | Yes (`<img>`) | `inline` | PNG Signature (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`) |
| **.webp** | Image | `image/webp` | Yes (`<img>`) | `inline` | RIFF Container (`RIFF....WEBP`) |
| **.zip** | Archive | `application/zip` | No (Card + Download) | `attachment` | PK Zip Header (`0x50 0x4B 0x03 0x04`) |

---

## 3. Architecture & File Pipeline Implementation

### 3.1. Client-Side Validation (`src/utils/fileTypes.ts`)
- **Accepted Extensions:** Single source of truth constant `ACCEPTED_FILE_EXTENSIONS` (`.pdf,.doc,.docx,.txt,.rtf,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.zip`).
- **File Input Pickers:** Updated in `AdminDashboardPage.tsx`, `MaterialFormModal.tsx`, and `ReplacePdfModal.tsx` with dynamic format labels and size indicators.
- **Client Validation Function (`validateClientFile`):**
  - Enforces extension matching against the supported format registry.
  - Rejects dangerous executables and scripts.
  - Enforces file size limits (50 MB default for R2, 6 MB for RTDB fallback).
  - Inspects file array buffer using `validateMagicBytes` before initiating network upload.

### 3.2. Cloudflare Worker Validation & Delivery (`worker/src/index.ts` & `worker/src/fileTypes.ts`)
- **Worker Supported Formats Registry (`WORKER_SUPPORTED_FORMATS`):**
  - Matches the client format definitions with canonical MIME types.
- **Magic Byte Validation (`validateMagicBytes`):**
  - Validates binary signatures for all binary formats.
  - Strictly rejects Windows PE (`MZ` header: `0x4D 0x5A`) and Linux ELF (`0x7F 0x45 0x4C 0x46`) executables even if renamed with a valid extension (e.g., `payload.exe` renamed to `payload.pdf`).
  - Rejects text files containing null bytes (`0x00`).
- **Dynamic Content Headers:**
  - Sets exact `Content-Type` matching the detected file format.
  - Previewable formats (PDF, PNG, JPG, WEBP, TXT, CSV) default to `inline; filename="..."`.
  - Non-previewable formats (DOCX, PPTX, XLSX, RTF, ZIP) default to `attachment; filename="..."`.
  - When `?download=1` query parameter is present on any route, forces `Content-Disposition: attachment; filename="..."`.
- **Filename Sanitization (`sanitizeWorkerFilename` & `sanitizeSafeFilename`):**
  - Strips path traversal sequences (`../`, `..\`), slashes, and control characters.
  - Preserves legitimate safe extensions (e.g., `.docx`, `.pptx`, `.xlsx`, `.zip`).
  - Maintains backward compatibility with legacy tests via `sanitizeFilename`.

### 3.3. Firebase Realtime Database Metadata Schema (`src/types/index.ts`)
- Added optional `mimeType?: string;` field to the `StudyMaterial` interface.
- Preserves backwards compatibility with existing legacy records without `mimeType`, resolving dynamically via filename extension using `getFileFormatInfo`.

### 3.4. Public Viewing Experience (`src/components/materials/PdfViewer.tsx` & `MaterialDetailPage.tsx`)
- **Integrated Universal Viewer:**
  - **PDF:** Rendered via interactive `<iframe>` with full paging and zooming controls.
  - **Images (PNG, JPG, WEBP):** Rendered with a high-resolution, centered image canvas with zoom and background framing.
  - **Text & CSV:** Rendered with syntax-friendly monospace container.
  - **Office Documents & Archives (DOC, DOCX, PPT, PPTX, XLS, XLSX, RTF, ZIP):** Displays a polished card showcasing the format badge, file size, format description, and a direct download button.
- **Card Badges:**
  - `MaterialCard.tsx` displays an uppercase format badge (e.g., `[DOCX]`, `[PPTX]`, `[ZIP]`) alongside the file size.

### 3.5. Zero-Login Private Assignment & Notes Sharing
- **Zero-Login Guarantee:**
  - Recipient accesses the private link (`https://campusnotes.space/private-assignment/<token>`) with zero barriers: **no account, no login, no password, no OTP, no app install**.
- **Cryptographic Security:**
  - Uses 32-byte cryptographically secure random tokens (`generateSecureToken` with 256 bits of entropy).
  - Raw tokens are hashed with SHA-256 before storage; the raw token is never persisted in database records.
  - Endpoints (`/private-shares/:token/info` and `/private-shares/:token/file`) perform constant-time lookup and rate limiting.
- **Direct Multi-Format Download:**
  - Recipients can download any of the 15 supported formats directly via the "Download Assignment" button.
  - Binary files stream with full Range request support and strict `Cache-Control: private, no-store`.

---

## 4. Dangerous File Rejection & Security Protections

### 4.1. Prohibited Extensions
The system strictly rejects all executable and script file types at both the client and server levels:
- Executables: `.exe`, `.msi`, `.dll`, `.com`, `.scr`, `.bin`, `.app`, `.dmg`, `.pkg`, `.iso`
- Scripts & Shells: `.bat`, `.cmd`, `.sh`, `.bash`, `.ps1`, `.psm1`, `.vbs`, `.vbe`, `.wsf`, `.js`, `.mjs`, `.cjs`, `.py`, `.php`, `.pl`, `.rb`
- Office Macros: `.docm`, `.xlsm`, `.pptm`
- Java & Systems: `.jar`, `.class`, `.apk`

### 4.2. Magic Byte Spoofing Defense
Attackers attempting to disguise dangerous binaries by appending an accepted extension (e.g. `malware.exe -> lecture_notes.pdf`) are intercepted:
1. Checked for Windows Portable Executable signature (`MZ` / `0x4D 0x5A`) -> **REJECTED**.
2. Checked for Linux Executable and Linkable Format (`\x7fELF` / `0x7F 0x45 0x4C 0x46`) -> **REJECTED**.
3. Checked for matching header magic bytes of the declared extension -> **REJECTED** if non-matching.

---

## 5. Automated Verification Results

All automated test suites pass with 100% success rate:

```
======================================================================
  CAMPUSNOTES — COMPREHENSIVE MULTI-FORMAT FILE TYPE SUPPORT AUDIT
======================================================================

--- Test Suite 1: Format Matrix & MIME Specification ---
  [PASS] All 15 required formats are defined in SUPPORTED_FILE_FORMATS
  [PASS] All 15 required formats are defined in WORKER_SUPPORTED_FORMATS with exact MIME types
  [PASS] Previewable flag is correctly designated (PDF, Images, Text/CSV: true; Office & Archives: false)

--- Test Suite 2: Magic Byte Signature Verification ---
  [PASS] Valid test buffer succeeds signature checks on client and worker for each format
  [PASS] Rejects spoofed Windows executable (MZ header) disguised as any format
  [PASS] Rejects spoofed Linux executable (ELF header) disguised as any format
  [PASS] Rejects PDF with invalid magic byte header (e.g. text masquerading as PDF)
  [PASS] Rejects Office OpenXML (.docx, .pptx, .xlsx) without valid PK archive header
  [PASS] Rejects text file containing binary null bytes

--- Test Suite 3: Dangerous Format Rejection & Sanitization ---
  [PASS] Strictly identifies dangerous executable and script extensions
  [PASS] sanitizeSafeFilename neutralizes directory traversal and dangerous extensions
  [PASS] Worker sanitizeWorkerFilename preserves original safe format extensions

--- Test Suite 4: Cloudflare R2 Multi-Format Upload Simulation ---
  [PASS] Worker PUT upload handles all 15 formats with accurate Content-Type and original filename

--- Test Suite 5: Zero-Login Private Sharing Across All Formats ---
  [PASS] Recipient downloads any supported format directly without login, password, or code

--- Test Suite 6: Public Material Download & Legacy Compatibility ---
  [PASS] Legacy PDF at materials/:id.pdf continues to download seamlessly

======================================================================
  MULTI-FORMAT AUDIT RESULTS: 15 PASSED, 0 FAILED
======================================================================
```

- **Typecheck (Client):** `tsc -b` -> **0 errors**
- **Typecheck (Worker):** `npm --prefix worker run typecheck` -> **0 errors**
- **Worker Tests:** `npm --prefix worker test` -> **36/36 passed**
- **Overall Project Tests:** `npm test` -> **186/186 passed**

---

## 6. Guardrail Status
- **Zero-Login Experience:** Verified and guaranteed.
- **Production Push / Deployment:** Awaiting user explicit confirmation. No code pushed to GitHub, no deploy commands executed.
