# Firebase Integration & Live Testing Guide — CampusNotes (CSE Semester 5)

This guide provides the exact steps to connect CampusNotes to your live Firebase project (`campusnotes-e62cf`), configure Authentication, Realtime Database, and Cloud Storage, provision the first administrator, apply security rules, and test all features before deploying to Vercel.

---

## 1. Project Configuration Summary

| Service | Target Configuration |
| :--- | :--- |
| **Firebase Project ID** | `campusnotes-e62cf` |
| **Realtime Database URL** | `https://campusnotes-e62cf-default-rtdb.firebaseio.com/` |
| **Default Storage Bucket** | `campusnotes-e62cf.firebasestorage.app` |
| **Auth Domain** | `campusnotes-e62cf.firebaseapp.com` |
| **Academic Department** | Department of Computer Science & Engineering (CSE) |
| **Curriculum Scope** | **Semester 5 ONLY** (Exact 9 subjects) |
| **Initial Dev Login** | Username: `admin` / Password: `admin` |
| **Canonical Admin Email** | `admin@campusnotes.internal` |

---

## 2. Obtain Your Real Firebase Web App Configuration

Firebase Web App credentials (`apiKey`, `appId`, `messagingSenderId`) must come from your Firebase Console. Never commit or invent credentials.

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`campusnotes-e62cf`**.
3. In the left navigation, click the **Settings gear icon (⚙️) -> Project settings**.
4. In the **General** tab, scroll down to the **Your apps** section.
5. If you haven't registered a Web App yet:
   - Click the **Web (`</>`)** icon.
   - Enter App nickname: `CampusNotes Web`.
   - Leave "Also set up Firebase Hosting" unchecked for now.
   - Click **Register app**.
6. Under **Firebase SDK snippet**, select **Config**.
7. Copy the configuration object values into your local `.env` file located at:
   `campusnotes/.env`

```env
# =============================================================================
# CampusNotes — CSE Semester 5 Study Hub (Local Development Environment)
# Connected to Real Firebase Project: campusnotes-e62cf
# =============================================================================

VITE_FIREBASE_API_KEY=AIzaSy...Your_Real_Web_API_Key
VITE_FIREBASE_AUTH_DOMAIN=campusnotes-e62cf.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://campusnotes-e62cf-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=campusnotes-e62cf
VITE_FIREBASE_STORAGE_BUCKET=campusnotes-e62cf.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=Your_Messaging_Sender_Id
VITE_FIREBASE_APP_ID=1:Your_App_Id:web:...
```

> **Note**: `.env` is included in `.gitignore` and is strictly excluded from version control.

---

## 3. Enable Email/Password Authentication in Firebase Console

CampusNotes authenticates administrators through Firebase Authentication, mapping the username `admin` to `admin@campusnotes.internal`.

1. In the Firebase Console left menu, navigate to **Build -> Authentication**.
2. If Authentication is not yet enabled, click **Get started**.
3. Click on the **Sign-in method** tab.
4. Under **Sign-in providers**, click **Email/Password**.
5. Toggle **Enable** to ON (leave "Email link (passwordless sign-in)" disabled).
6. Click **Save**.

---

## 4. Configure Firebase Cloud Storage

CampusNotes stores study material PDFs up to 25 MB in Firebase Cloud Storage.

1. In the Firebase Console left menu, navigate to **Build -> Storage**.
2. If Storage is not yet enabled:
   - Click **Get started**.
   - Choose a storage bucket location (e.g. `asia-south1` or `us-central1`).
   - Select **Start in test mode** temporarily or apply the custom security rules provided below.
   - Click **Done**.
3. Verify the bucket name matches `campusnotes-e62cf.firebasestorage.app`.
   - If your bucket has the legacy suffix `.appspot.com`, update `VITE_FIREBASE_STORAGE_BUCKET` in your `.env` to match your actual bucket name.
4. **Billing Check**: Firebase Spark (free tier) includes 5 GB of Cloud Storage and 1 GB/day download bandwidth, which is more than sufficient for testing.

---

## 5. Provision the First Administrator Safely

To ensure strict administrative security, Firebase does not grant admin access by default to arbitrary accounts. Authorization requires adding the user's UID to the `/admins` registry in the Realtime Database.

### Step 1: Create the Admin Account in Firebase Authentication
1. In Firebase Console, go to **Authentication -> Users** tab.
2. Click **Add user**.
3. Enter:
   - **Email**: `admin@campusnotes.internal`
   - **Password**: Enter your secure administrator password (minimum 6 characters, e.g., `CampusAdmin@2026`).
4. Click **Add user**.
5. Once created, hover over the newly created user and **copy the User UID** (e.g., `aBcDeFg12345...`).

### Step 2: Authorize the Administrator UID in Realtime Database
1. Go to **Build -> Realtime Database -> Data** tab.
2. Locate the root node or click the `+` button on the root node to add a child.
3. Add the node:
   - **Name**: `admins`
4. Under `admins`, add a child:
   - **Name**: `<Paste your User UID here>`
   - **Value**: `true` (as boolean or string `"true"`)
5. Click **Add**.

Now your account is fully authorized. When logging in at `/admin/login`, you can simply enter:
- **Admin ID**: `admin`
- **Password**: `<Your secure administrator password>`

The frontend automatically resolves `admin` to `admin@campusnotes.internal` and validates the user against `/admins/{uid}`.

> **Local Development Fallback**: If you run locally before provisioning the Firebase account, you can sign in directly using:
> - **Username**: `admin`
> - **Password**: `admin`
> This activates an initial development session with an advisory banner reminding you to configure live credentials before deployment.

---

## 6. Apply Security Rules & Database Indexes

### Apply Realtime Database Rules
1. In Firebase Console, go to **Build -> Realtime Database -> Rules** tab.
2. Copy the entire contents of `database.rules.json`:

```json
{
  "rules": {
    "admins": {
      ".read": "auth != null",
      ".write": false
    },
    "subjects": {
      ".read": true,
      ".write": "auth != null && (root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["code", "active"]
    },
    "categories": {
      ".read": true,
      ".write": "auth != null && (root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)"
    },
    "publicMaterials": {
      ".read": true,
      ".write": "auth != null && (root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["subjectId", "category", "academicYear", "createdAt"]
    },
    "materials": {
      ".read": "auth != null && (root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".write": "auth != null && (root.child('admins').child(auth.uid).val() === true || auth.token.admin === true)",
      ".indexOn": ["subjectId", "category", "academicYear", "createdAt"]
    }
  }
}
```
3. Click **Publish**.

**Why this structure is secure:**
- Firebase Realtime Database rules do not filter queries automatically.
- Materials are securely partitioned: public visitors query `/publicMaterials` (published only).
- Drafts and unpublished materials remain in `/materials`, where unauthenticated reading is strictly denied (`auth != null && ...`).

### Apply Cloud Storage Rules
1. In Firebase Console, go to **Build -> Storage -> Rules** tab.
2. Copy the entire contents of `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
    // Study Materials Storage (CSE Semester 5)
    match /materials/{subjectId}/{materialId}/{fileName} {
      // Public visitors may only read published study materials.
      // Authenticated administrators can read all files (including drafts).
      allow read: if request.auth != null || resource.metadata.published == 'true';

      // Only authenticated administrators may upload or overwrite
      // Strict constraints: Content-Type must be PDF, max file size 25MB (26214400 bytes)
      allow write: if request.auth != null
                   && request.resource.size <= 25 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';

      // Only administrators may delete
      allow delete: if request.auth != null;
    }

    // Default deny for all other locations
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```
3. Click **Publish**.

**Why this Storage rule is secure:**
- Only authenticated administrators can upload or delete.
- Files must have `Content-Type: application/pdf` and cannot exceed 25 MB.
- Public reading is permitted only when `resource.metadata.published == 'true'`, protecting draft PDFs from unauthorized access.

---

## 7. How to Run Locally on Windows

Execute the following commands in PowerShell from the project folder:

```powershell
# 1. Navigate to the project directory
cd C:\Users\ayanm\.gemini\antigravity-ide\scratch\campusnotes

# 2. Install dependencies (if not already installed)
npm install

# 3. Start the Vite local development server
npm run dev -- --host 127.0.0.1
```

### Local URLs:
- **Public Portal**: `http://127.0.0.1:5173/`
- **Admin Login**: `http://127.0.0.1:5173/admin/login`
- **Admin Dashboard**: `http://127.0.0.1:5173/admin/dashboard`

---

## 8. Backup & Restore Realtime Database Before Destructive Testing

To protect any existing data before testing deletions or migrations:

### Backup (Export JSON)
1. Go to Firebase Console -> **Build -> Realtime Database -> Data** tab.
2. Click the three dots icon (`⋮`) in the top right of the data viewer.
3. Select **Export JSON**.
4. Save the backup file to your computer.

### Restore (Import JSON)
1. In the same menu (`⋮`), select **Import JSON**.
2. Select your previously exported JSON file to restore all subjects and materials immediately.

---

## 9. End-to-End Live Verification Checklist

Once your credentials are in `.env`, test the complete workflow:

| Step | Action | Expected Result |
| :---: | :--- | :--- |
| **1** | Open `/admin/login` and log in with `admin` / your password | Redirects to `/admin/dashboard` with admin session active. |
| **2** | Go to **Subjects** tab and edit a subject (e.g., `23CS3501`) | Subject description updates in real time in the database. |
| **3** | Click **Upload Material**, attach a valid PDF (<25 MB), and submit | Progress bar tracks upload; file appears in Storage under `/materials/...`. |
| **4** | Mark the material as **Published** | Material appears simultaneously in `/materials` and `/publicMaterials`. |
| **5** | Open `http://127.0.0.1:5173/` in an Incognito / private window | The new material appears instantly on the public home page via WebSocket listener. |
| **6** | Click **Preview** and **Download** on the public material card | PDF opens in viewer and downloads with original file name. |
| **7** | In Admin Dashboard, edit the material title and click Save | Title changes immediately on the public website without page refresh. |
| **8** | Click the **Unpublish** toggle in Admin Dashboard | Material disappears immediately from public listings. |
| **9** | Try accessing the unpublished download URL in Incognito | Access is blocked (`resource.metadata.published == 'false'`). |
| **10** | Click **Delete Material** in Admin Dashboard | Both database records and the Cloud Storage PDF file are cleaned up safely. |
| **11** | Try uploading a non-PDF file (.exe, .jpg) or a file > 25 MB | Client validation and Cloud Storage rules immediately reject the operation. |
| **12** | Refresh the browser (`F5`) | All saved database subjects and published materials remain fully persistent. |
