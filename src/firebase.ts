import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../firebase-applet-config.json';

// Initialize Firebase with the provisioned project config
const app = getApps().length > 0 ? getApp() : initializeApp(config);

// Connect to the provisioned Firestore database with long-polling enabled.
// In browser/iframe environments, forcing long-polling prevents HTTP/2 RST_STREAM
// Code 13 disconnects on the GrpcConnection 'Listen' stream.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    config.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, config.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);

// Connection test on boot per Firebase skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection().catch(() => {});

export default app;

