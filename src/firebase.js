import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken } from "firebase/messaging";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
// These values are safe to be public — they identify the project, they don't
// grant admin access. Firestore security rules (see firestore.rules) are what
// actually control who can read/write what.
const firebaseConfig = {
  apiKey: "AIzaSyB3MmPn44i3yGC5LpuxzNiaZDd6eke-mcE",
  authDomain: "whispr-v2.firebaseapp.com",
  projectId: "whispr-v2",
  storageBucket: "whispr-v2.firebasestorage.app",
  messagingSenderId: "338774310441",
  appId: "1:338774310441:web:404620c8667131b8072638",
  measurementId: "G-SXMMWSPE6Z"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ─── FIREBASE CLOUD MESSAGING ─────────────────────────────────────────────────
// Get VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = "BNIJJi-YniHrYsO5IUSUfbiB-C7wA37ZCcZtVGHwpG-nvYniQEvz7olXUH18W0Rl7U0iKan1UN0FyHyOD6RLgd8"; // 🔑 Replace with your actual VAPID key

export let messaging = null;
try { messaging = getMessaging(app); } catch (_) {}

export async function registerForPushNotifications() {
  if (!messaging || !("Notification" in window)) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    const authToken = await auth.currentUser?.getIdToken();
    if (!authToken) return;
    await fetch("https://whispr-v2-backend.onrender.com/save-fcm-token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
      body: JSON.stringify({ token }),
    });
  } catch (_) {} // push is a bonus — never break the app
}

// ─── APP CHECK (reCAPTCHA v3) ─────────────────────────────────────────────────
// Prevents external scripts from abusing your Firebase project.
// Steps to activate:
//   1. Go to Firebase Console → App Check → Register your web app
// App Check disabled for v2 development — re-enable before production deploy
