import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'AIzaSyBegJGub5m5WLJphS8UaQ3JlyicdCCogwo',
  authDomain: 'requireapp-b74b3.firebaseapp.com',
  projectId: 'requireapp-b74b3',
  storageBucket: 'requireapp-b74b3.firebasestorage.app',
  messagingSenderId: '562484935452',
  appId: '1:562484935452:web:d87d9150468f32404f18d9'
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const emulatorState = globalThis as typeof globalThis & {
  __requireAppEmulatorsConnected?: boolean;
};

if (
  import.meta.env.DEV
  && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  && !emulatorState.__requireAppEmulatorsConnected
) {
  connectAuthEmulator(auth, import.meta.env.VITE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099', {
    disableWarnings: true
  });
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || '127.0.0.1',
    Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080)
  );
  emulatorState.__requireAppEmulatorsConnected = true;
}
