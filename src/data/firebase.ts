import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { EMULATOR_PROJECT_ID, USE_EMULATOR, firebaseConfig } from '../config';

const app = initializeApp(USE_EMULATOR ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig);

export const auth = getAuth(app);

// Persistent cache = offline records survive closing the app (S3) and the SDK re-sends them.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATOR) {
  const host = location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
