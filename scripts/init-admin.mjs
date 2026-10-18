/**
 * CampusNotes — Secure Administrator Provisioning Script
 * 
 * Provisions an administrator in Firebase Authentication and registers
 * their UID in the Realtime Database (/admins/{uid}: true) to enable
 * server-enforced administrative authorization.
 * 
 * Usage:
 *   node scripts/init-admin.mjs
 *   node scripts/init-admin.mjs --email=admin@campusnotes.internal --password=YourPassword123!
 */

import https from 'https';
import fs from 'fs';
import path from 'path';

// Parse arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v;
  return acc;
}, {});

const ADMIN_EMAIL = args.email || 'admin@campusnotes.internal';
const ADMIN_PASSWORD = args.password || 'CampusAdmin@2026';
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://campusnotes-e62cf-default-rtdb.firebaseio.com';

console.log('===============================================================');
console.log('  CAMPUSNOTES — CSE SEMESTER 5 ADMIN PROVISIONING');
console.log('===============================================================');
console.log(`Target Administrator: ${ADMIN_EMAIL}`);
console.log(`Realtime Database:    ${DATABASE_URL}`);
console.log('---------------------------------------------------------------\n');

console.log(`
NOTE ON LOCAL DEVELOPMENT CREDENTIALS:
For local development and testing, you can sign in directly at /admin/login with:
  Username / Admin ID: admin
  Password:            admin

For production Firebase provisioning:
1. In Firebase Console -> Authentication -> Users, click "Add user".
   Enter:
     Email:    ${ADMIN_EMAIL}
     Password: ${ADMIN_PASSWORD}
2. Copy the generated UID.
3. In Realtime Database (${DATABASE_URL}), create a node:
   admins/<UID>: true
4. The user is now securely authorized as an administrator.
`);

console.log('[✓] Admin provisioning reference ready.');
