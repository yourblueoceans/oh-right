import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { EMULATOR_PROJECT_ID, USE_EMULATOR, firebaseConfig } from '../config';
import { detectInAppBrowser } from '../domain/inapp';

const app = initializeApp(USE_EMULATOR ? { ...firebaseConfig, projectId: EMULATOR_PROJECT_ID } : firebaseConfig);

export const auth = getAuth(app);

// Persistent cache = offline records survive closing the app (S3) and the SDK re-sends them.
// In-app browsers (e.g. KakaoTalk on iPhone) can't keep that storage reliably, so there we use
// memory only: everything works online, but offline records don't survive closing the page.
export const inAppBrowser = detectInAppBrowser(navigator.userAgent);
export const db = initializeFirestore(app, {
  localCache: inAppBrowser
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USE_EMULATOR) {
  const host = location.hostname || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}
