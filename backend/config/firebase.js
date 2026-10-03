import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let db = null;
let auth = null;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;
const apiKey = process.env.FIREBASE_API_KEY;

// Check if credentials are set
const hasServiceAccountJson = serviceAccountPath && fs.existsSync(serviceAccountPath);
const hasEnvironmentCredentials = projectId && clientEmail && privateKey && !privateKey.includes('placeholder');

let isFirebaseEnabled = false;

if (hasServiceAccountJson || hasEnvironmentCredentials) {
  try {
    if (hasServiceAccountJson) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('🔥 Firebase Admin SDK initialized successfully via Service Account JSON.');
    } else {
      const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedPrivateKey
        })
      });
      console.log('🔥 Firebase Admin SDK initialized successfully via environment variables.');
    }

    db = admin.firestore();
    auth = admin.auth();
    isFirebaseEnabled = true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
  }
} else {
  console.warn('⚠️ Firebase Admin SDK is NOT initialized: service account credentials missing in .env');
}

export { admin, db, auth, isFirebaseEnabled };

