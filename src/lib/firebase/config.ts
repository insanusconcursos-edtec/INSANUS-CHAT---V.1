/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: (import.meta.env?.VITE_FIREBASE_API_KEY as string) || "AIzaSyDk6VzstwLEvhzcdYFTgdQOX6xbBp4Jd4w",
  authDomain: (import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN as string) || "insanus-chat.firebaseapp.com",
  projectId: (import.meta.env?.VITE_FIREBASE_PROJECT_ID as string) || "insanus-chat",
  storageBucket: (import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET as string) || "insanus-chat.firebasestorage.app",
  messagingSenderId: (import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "851708850498",
  appId: (import.meta.env?.VITE_FIREBASE_APP_ID as string) || "1:851708850498:web:f3be581f1fbde52e2f18db"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Enable persistence
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export default app;
