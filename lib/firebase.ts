/**
 * Firebase initialization and configuration for Adal Nexus.
 *
 * This module initializes the Firebase Web SDK with client-side configuration.
 * All environment variables are prefixed with NEXT_PUBLIC_ (safe to expose in browser).
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const requiredConfigs = [
  'apiKey',
  'authDomain',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId',
] as const;

const hasFirebaseConfig = requiredConfigs.every((key) => Boolean(firebaseConfig[key]));

if (!hasFirebaseConfig) {
  for (const key of requiredConfigs) {
    if (!firebaseConfig[key]) {
      console.warn(`Firebase config missing: NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`);
    }
  }
}

// Initialize Firebase only when the config is available.
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

// Initialize Firebase services.
export const auth = app ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>);
export const db = app ? getFirestore(app) : (null as unknown as ReturnType<typeof getFirestore>);
export const storage = app ? getStorage(app) : (null as unknown as ReturnType<typeof getStorage>);

// Re-export Firebase Auth functions for convenience
export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
export type { User };

// Enable emulators in development (optional)
if (app && process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  try {
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      console.log('🔥 Firebase Emulators connected');
    }
  } catch (error) {
    console.warn('Firebase emulator connection skipped:', error);
  }
}

export default app;
