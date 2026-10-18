# Firebase Integration & Setup Guide — CampusNotes (RTDB-Only Storage)

This guide provides the exact configuration and setup instructions for **CampusNotes** (`campusnotes-e62cf`).
CampusNotes uses **Firebase Realtime Database as the sole persistent file-storage and metadata system** (no Cloud Storage, no Blaze plan required).

---

## 1. Project Configuration Summary

| Setting | Value |
| :--- | :--- |
| **Firebase Project ID** | `campusnotes-e62cf` |
| **Realtime Database URL** | `https://campusnotes-e62cf-default-rtdb.firebaseio.com/` |
| **Auth Domain** | `campusnotes-e62cf.firebaseapp.com` |
| **Persistent File Storage** | **Firebase Realtime Database ONLY** (`/file_blobs/`) |
| **Max PDF File Size** | **6 MB** (raw PDF expands to ~8 MB Base64, safe under RTDB 10 MB limit) |
| **Academic Department** | Computer Science & Engineering (CSE) |
| **Curriculum Scope** | **Semester 5 ONLY** (Exact 9 subjects) |
| **Canonical Admin Email** | `admin@campusnotes.internal` |
| **Initial Login Alias** | Username: `admin` / Password: `admin` (or `CampusAdmin@2026`) |

---

## 2. Realtime Database Security Rules (`database.rules.json`)

To fix `PERMISSION_DENIED` and allow public access to published study materials and file blobs while securing administrative actions, copy the following rules into Firebase Console:

### How to Publish Rules:
1. Open [Firebase Console](https://console.firebase.google.com/) -> Select project **`campusnotes-e62cf`**.
2. In the left navigation, click **Build -> Realtime Database**.
3. Click the **Rules** tab at the top.
4. Replace the entire content with the JSON below and click **Publish**.

```json
{
  "rules": {
    "admins": {
      ".read": "auth != null",
      ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)"
    },
    "settings": {
      ".read": true,
      "maintenanceMode": {
        ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
        ".validate": "newData.isBoolean()"
      },
      "$other": {
        ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)"
      }
    },
    "subjects": {
      ".read": "root.child('settings').child('maintenanceMode').val() !== true || (auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true))",
      ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["code", "active"]
    },
    "categories": {
      ".read": true,
      ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)"
    },
    "publicMaterials": {
      ".read": "root.child('settings').child('maintenanceMode').val() !== true",
      ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["subjectId", "category", "academicYear", "createdAt"]
    },
    "materials": {
      ".read": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["subjectId", "category", "academicYear", "createdAt"]
    },
    "file_blobs": {
      "$blobId": {
        ".read": "root.child('settings').child('maintenanceMode').val() !== true && (data.child('published').val() === true || (auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)))",
        ".write": "auth != null && (auth.token.email === 'admin@campusnotes.internal' || auth.uid === 'xCyTNtjZdHPW7a51dlNGjBK3aAk1' || root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
        ".validate": "newData.hasChildren(['blob_id', 'material_id', 'file_name', 'file_size_bytes', 'data_base64'])"
      }
    }
  }
}
```

---

## 3. RTDB-Only PDF Storage Architecture

### Why RTDB-Only Storage?
- Completely eliminates dependencies on Cloud Storage or Blaze billing upgrades.
- Avoids Cloud Storage 404 bucket errors and stuck uploads.
- Zero extra costs, fully hosted within Firebase Spark free tier.

### Storage Structure:
- **Binary Content (`/file_blobs/{blobId}`)**:
  - `blob_id`: Unique identifier (`blob_mat_<timestamp>_<random>`)
  - `material_id`: ID of the associated study material
  - `file_name`: Original sanitized PDF file name
  - `file_size_bytes`: Raw byte size of the document
  - `mime_type`: `application/pdf`
  - `data_base64`: Base64-encoded PDF string
  - `published`: Boolean (mirrors publication status for security rules)
  - `created_at`: Unix timestamp in milliseconds

- **Metadata Partition (`/materials/{id}` and `/publicMaterials/{id}`)**:
  - Stores metadata ONLY (title, description, subjectId, category, academicYear, unitNumber/assignmentNumber, tags, blobId, fileSize, published, createdAt, updatedAt).
  - Listing queries (such as `getPublicMaterials` and `getAllMaterialsAdmin`) **NEVER load the Base64 binary**, keeping list operations lightweight, instant, and bandwidth-efficient.

### Size Limitations:
- Maximum raw PDF file size: **6 MB** (6,291,456 bytes).
- Base64 expansion: ~33.3% => ~8.0 MB Base64 string.
- Realtime Database node limit: 10 MB per individual string.
- 6 MB guarantees safe headroom for JSON wrappers and WebSocket frame transmission.

### PDF Integrity Validation:
- Validates file extension (`.pdf`) and MIME type (`application/pdf`).
- Inspects magic bytes (`%PDF-` / `[0x25, 0x50, 0x44, 0x46, 0x2D]`) before encoding to prevent invalid or disguised files.
- Decodes Base64 back into `application/pdf` binary Blob for high-fidelity native viewing and downloading.

---

## 4. Provisioning Admin Access

1. In Firebase Console, go to **Authentication -> Users**.
2. Click **Add user**:
   - Email: `admin@campusnotes.internal`
   - Password: `CampusAdmin@2026` (or your preferred admin password).
3. Copy the User UID (e.g., `xCyTNtjZdHPW7a51dlNGjBK3aAk1`).
4. In Realtime Database Data tab, ensure `/admins/{uid}: true` is added.
5. You can log in on the live site at `/admin/login` using either:
   - ID: `admin` / Password: `<Your Password>` (automatically resolves to `admin@campusnotes.internal`), or
   - ID: `admin@campusnotes.internal` / Password: `<Your Password>`.

---

## 5. Deployment Verification Checklist

| Test Item | Verification Method |
| :--- | :--- |
| **Rule Publication** | Paste rules into RTDB Rules tab and click Publish; no PERMISSION_DENIED on `/settings` or `/subjects`. |
| **PDF Upload** | In Admin Dashboard -> Upload Material, upload a PDF (<6 MB); verify upload completes and file appears in `/file_blobs/`. |
| **PDF Replacement** | Click Replace PDF on a material; verify new blob is written, verified, and old blob deleted safely. |
| **PDF Preview** | Open a material detail page (`/materials/:id`); verify PDF loads and renders in reader. |
| **PDF Download** | Click "Download PDF"; verify downloaded file size and `%PDF-` signature matches original. |
| **Maintenance Mode** | Toggle Maintenance Mode in Admin Dashboard; verify public pages redirect while admin stays accessible. |
| **Clean Listing** | Open Materials page; confirm 100+ items load instantly without downloading binary blobs. |
