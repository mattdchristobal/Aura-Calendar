import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import config from '../firebase-applet-config.json';

// Initialize Firebase with the provisioned project config
const app = getApps().length > 0 ? getApp() : initializeApp(config);

// Connect to the provisioned Firestore database
export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth(app);
export default app;
