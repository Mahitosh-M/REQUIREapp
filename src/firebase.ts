import { getApp, getApps, initializeApp } from 'firebase/app';

export const firebaseConfig = {
  apiKey: 'AIzaSyBegJGub5m5WLJphS8UaQ3JlyicdCCogwo',
  authDomain: 'requireapp-b74b3.firebaseapp.com',
  projectId: 'requireapp-b74b3',
  storageBucket: 'requireapp-b74b3.firebasestorage.app',
  messagingSenderId: '562484935452',
  appId: '1:562484935452:web:d87d9150468f32404f18d9'
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
