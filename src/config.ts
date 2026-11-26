// Firebase web config values are public identifiers, not secrets. Access is protected by
// firestore.rules. (See https://firebase.google.com/docs/projects/api-keys)
export const firebaseConfig = {
  apiKey: 'AIzaSyDIoZKz-TtUfievwjFcw82jdRdzNPkVk7c',
  authDomain: 'heyohright.firebaseapp.com',
  projectId: 'heyohright',
  storageBucket: 'heyohright.firebasestorage.app',
  messagingSenderId: '471405755512',
  appId: '1:471405755512:web:a2b7d8e0c5a914b938418d',
  measurementId: 'G-EHRY85N76K',
};

/** `vite --mode emulator` (and the e2e tests) talk to local emulators instead of the real project. */
export const USE_EMULATOR = import.meta.env.MODE === 'emulator' || import.meta.env.VITE_USE_EMULATOR === '1';
export const EMULATOR_PROJECT_ID = 'demo-ohright';

/** Bump when the disclaimer text changes: everyone is asked to agree again. */
export const DISCLAIMER_VERSION = '2026-11-26';

export const DISCLAIMER_TEXT = [
  'Oh Right! is a shared log that helps caregivers see what medicine was given, when, and by whom. ' +
    'It does not give medical advice, check doses, or tell you whether a medicine is safe to give. ' +
    'Any reminder in the app only compares your entries with the schedule you typed in.',
  "Always follow the instructions from your child's doctor or pharmacist and the medicine label. " +
    'In an emergency, call 911. For possible poisoning or overdose, call Poison Control at 1-800-222-1222.',
];

export const DISCLAIMER_CHECKBOX = 'I understand Oh Right! is a log, not medical advice.';

export const MAX_MANAGERS = 2;
