import admin from "firebase-admin";

let app = null;

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

try {
  if (projectId && clientEmail && privateKey && !admin.apps.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey
      })
    });
  }
} catch (error) {
  console.warn(`Firebase Admin tidak aktif: ${error.message}`);
}

export const firebaseAdmin = admin;
export const firebaseReady = Boolean(app);
export const firestore = app ? admin.firestore() : null;
