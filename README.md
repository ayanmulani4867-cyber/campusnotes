# CampusNotes — CSE Semester 5 Study Hub

> **Strict Academic Scope**: Exclusively dedicated to **Computer Science and Engineering (CSE)** — **Semester 5**.  
> **Target Concurrency**: Validated architecture for ~500 concurrent visitors.

---

## 1. Project Overview

**CampusNotes** is a modern, high-speed, educational SaaS web application designed to provide frictionless, free access to academic study materials for 5th Semester Computer Science & Engineering students.

### Academic Taxonomy
```text
CSE
└── Semester 5
    └── Subjects (Official Semester V Curriculum)
        ├── 23CS3501 — Advanced Java Programming
        ├── 23CS3502 — Design Analysis and Algorithms
        ├── 23CS3503 — Advanced Database Engineering
        ├── 23CS3504 — Advanced Java Programming Laboratory
        ├── 23CS3505 — Design Analysis and Algorithms Laboratory
        ├── 23CS3506 — Advanced Database Engineering Laboratory
        ├── 23CS3507 — Program Elective Course-I
        ├── 23CSMDXX — Multidisciplinary Minor-III
        └── 23OECS31 — Open Elective III
        (Excludes: Aptitude Skills-III, Language Skills-III, Mini Project – III)
        ├── Notes (Unit-wise theory notes and lecture slides)
        ├── Assignments (Weekly problem sheets)
        ├── Experiments / Practicals (Lab manuals and source write-ups)
        ├── Previous Year Question Papers (PYQs)
        ├── Question Banks
        ├── Syllabus & Course Outcomes
        └── Reference Materials
```

### Key Architectural Tenets
- **Zero Student Registration**: Students browse, search, preview, and download published materials without creating accounts, logging in, or dealing with college ERP features.
- **Strict Administrator Governance**: Only authorized maintainers and professors may sign in at `/admin/login` to upload files, manage subjects, edit metadata, and publish/unpublish resources.
- **Partitioned Data Architecture**: Public queries read from `/publicMaterials` (which only contains `published: true` items). This eliminates the risk of leaking draft or unpublished materials since Firebase Realtime Database rules are permissions, not filters.
- **Direct Cloud Storage Delivery**: PDFs are served directly from Firebase Cloud Storage with byte-range caching for maximum throughput during high-traffic examination rushes.

---

## 2. Technology Stack

- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Tailwind CSS v4, Plus Jakarta Sans, JetBrains Mono
- **Routing**: React Router 7 (Single Page Application architecture)
- **Icons**: Lucide React
- **Backend & Database**: Firebase Realtime Database
  - Dedicated Database URL: `https://campusnotes-e62cf-default-rtdb.firebaseio.com/`
- **File Storage**: Firebase Cloud Storage (PDF files up to 25 MB)
- **Authentication**: Firebase Authentication (Email/Password with custom claim / RTDB admin verification)
- **Hosting / Deployment Target**: Vercel

---

## 3. Directory Structure

```text
campusnotes/
├── load-test/
│   └── load-test.js            # Concurrency & load benchmark script
├── public/
│   └── favicon.svg             # Graduation cap branding icon
├── src/
│   ├── config/
│   │   └── firebase.ts         # Firebase modular SDK initialization & diagnostics
│   ├── types/
│   │   ├── index.ts            # TypeScript definitions (Subject, Material, Category)
│   │   └── declarations.d.ts   # Module declarations
│   ├── services/
│   │   ├── firebaseService.ts  # RTDB & Storage CRUD, safe replace, orphan cleanup
│   │   ├── authService.ts      # Strict admin login & authorization verification
│   │   └── cacheService.ts     # In-memory & SessionStorage caching for 500-user peaks
│   ├── context/
│   │   ├── AuthContext.tsx     # Admin authentication session provider
│   │   └── ToastContext.tsx    # Toast notifications provider
│   ├── components/
│   │   ├── common/
│   │   │   ├── Navbar.tsx      # Responsive header with live search & mobile drawer
│   │   │   ├── Footer.tsx      # Academic scope disclaimer & category navigation
│   │   │   ├── Skeleton.tsx    # Card, table, and list loading skeletons
│   │   │   ├── EmptyState.tsx  # Dynamic empty state display
│   │   │   └── Modal.tsx       # Accessible dialog wrapper
│   │   ├── materials/
│   │   │   ├── MaterialCard.tsx   # Study material card with badges, view, download
│   │   │   ├── MaterialFilter.tsx # Category pills, subject dropdown, year selector
│   │   │   └── PdfViewer.tsx      # Cross-browser embedded PDF preview reader
│   │   └── admin/
│   │       ├── AdminAuthGuard.tsx   # Route guard verifying admin status
│   │       ├── SubjectManager.tsx   # Subject CRUD table & standard seeder
│   │       ├── MaterialFormModal.tsx# PDF upload & metadata modal (Max 25 MB)
│   │       └── ReplacePdfModal.tsx  # Safe PDF replacement workflow
│   ├── pages/
│   │   ├── HomePage.tsx           # Hero, categories, dynamic subjects, recent uploads
│   │   ├── MaterialsPage.tsx      # All materials directory with multi-filters
│   │   ├── SubjectsPage.tsx       # CSE Sem 5 subjects catalog
│   │   ├── SubjectDetailPage.tsx  # Dedicated subject hub with category tabs
│   │   ├── CategoryPage.tsx       # Category views (Notes, PYQs, Practicals...)
│   │   ├── MaterialDetailPage.tsx # Dedicated view with reader & related files
│   │   ├── AboutPage.tsx          # Scope explanation & student FAQ
│   │   ├── NotFoundPage.tsx       # Custom 404 handler
│   │   └── admin/
│   │       ├── AdminLoginPage.tsx # Strict admin login & setup instructions
│   │       └── AdminDashboardPage.tsx # Master admin dashboard & live metrics
│   ├── App.tsx                    # Route definitions with React.lazy code splitting
│   ├── main.tsx                   # React root entrypoint
│   └── index.css                  # Tailwind styles and smooth transitions
├── database.rules.json            # Production Realtime Database Security Rules
├── storage.rules                  # Production Cloud Storage Security Rules
├── vercel.json                    # Vercel SPA routing and cache headers
├── .env.example                   # Environment variable template
└── package.json                   # Dependencies and build scripts
```

---

## 4. Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate `.env` with the Web App keys from your Firebase Console (**Project Settings &rarr; General &rarr; Your apps**):
```ini
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=campusnotes-e62cf.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://campusnotes-e62cf-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=campusnotes-e62cf
VITE_FIREBASE_STORAGE_BUCKET=campusnotes-e62cf.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Start Local Development Server
```bash
npm run dev
```
Navigate to `http://127.0.0.1:5173/`.

### 4. Build Production Bundle
```bash
npm run build
```

---

## 5. Firebase Configuration & Deployment

### Step A: Deploy Realtime Database Security Rules
Open **Firebase Console &rarr; Realtime Database &rarr; Rules**, paste the contents of `database.rules.json`, and click **Publish**:
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

### Step B: Deploy Cloud Storage Security Rules
Open **Firebase Console &rarr; Storage &rarr; Rules**, paste `storage.rules`, and click **Publish**:
```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /materials/{subjectId}/{materialId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size <= 25 * 1024 * 1024
                   && request.resource.contentType == 'application/pdf';
      allow delete: if request.auth != null;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Step C: Administrator Provisioning & Login

#### 1. Initial Local Development Setup (Quick Start)
For local development and testing, you can sign in directly at `/admin/login` with:
- **Admin ID / Username:** `admin`
- **Admin Password:** `admin`

When signed in via default development credentials, the system marks the session with a security advisory banner prompting credential updates prior to production deployment.

#### 2. Production Firebase Provisioning
1. Run the provisioning helper:
   ```bash
   node scripts/init-admin.mjs --email=admin@campusnotes.internal --password=YourSecurePassword123!
   ```
2. Or in Firebase Console:
   - Go to **Authentication &rarr; Users** and click **Add user**.
   - Email: `admin@campusnotes.internal` (the username `admin` maps to this canonical email automatically).
   - Password: Your strong production password.
   - Copy the generated **UID**.
3. In Realtime Database (`https://campusnotes-e62cf-default-rtdb.firebaseio.com/`):
   - Add a node: `admins/<UID>: true`.
4. Log in at `/admin/login` using either `admin` or `admin@campusnotes.internal`. The application securely authenticates with Firebase Auth and verifies the `/admins/{uid}` authorization record. Ordinary users without this record are immediately blocked.

---

## 6. Vercel Deployment Guide

1. Push your repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/), click **Add New Project** and import the repository.
3. Configure the **Environment Variables** in Vercel settings matching your `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL` (`https://campusnotes-e62cf-default-rtdb.firebaseio.com/`)
   - `VITE_FIREBASE_PROJECT_ID` (`campusnotes-e62cf`)
   - `VITE_FIREBASE_STORAGE_BUCKET` (`campusnotes-e62cf.firebasestorage.app`)
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Deploy. The included `vercel.json` automatically handles Single Page Application routing (`rewrites`) and long-term asset caching.

---

## 7. Performance & 500 Concurrent Users Validation

### Optimizations Implemented:
1. **Tiered Client Caching**: `cacheService.ts` caches public subjects and materials in memory and `sessionStorage` with a 2-minute TTL, eliminating repetitive database reads across tab navigations.
2. **Partitioned Reads**: Public visitors only query `/publicMaterials`, which is indexed on `createdAt`, `subjectId`, `category`, and `academicYear`.
3. **Bounded Datasets**: Public queries apply `.limitToLast(100)` preventing full database scans.
4. **Debounced Search**: Client-side filtering executes with 300ms debounce over pre-fetched bounded datasets.
5. **Code Splitting**: Route-level dynamic imports (`React.lazy`) minimize initial JavaScript parse times.

### Running the Load Test Benchmark
To simulate concurrent students:
```bash
# 50 Concurrent Users
node load-test/load-test.js --concurrency=50 --duration=10

# 250 Concurrent Users
node load-test/load-test.js --concurrency=250 --duration=15

# 500 Concurrent Users Peak Test
node load-test/load-test.js --concurrency=500 --duration=20
```

---

## 8. Backup & Maintenance

1. **Database Backups**:
   - In Google Cloud Console or Firebase Console, enable automated daily backups for Realtime Database.
   - For ad-hoc backups, export JSON directly from the Firebase RTDB Console.
2. **Cloud Storage Backups**:
   - Enable Object Versioning on the Firebase Cloud Storage bucket to prevent accidental file loss.
3. **Orphan Cleanup**:
   - In `firebaseService.ts`, all operations use transactional workflows: if metadata writing fails after uploading a file, the orphaned storage file is deleted immediately. During file replacement, the new file is uploaded and verified before the old file is removed.
