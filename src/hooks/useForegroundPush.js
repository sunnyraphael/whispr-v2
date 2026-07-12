import { useState, useEffect } from "react";
import { messaging } from "../firebase";
import { onMessage } from "firebase/messaging";

// Listens for FCM push notifications that arrive while the tab is open (foreground).
// Background pushes are handled separately by firebase-messaging-sw.js.
export function useForegroundPush() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!messaging) return;
    const unsub = onMessage(messaging, (payload) => {
      setToast({ title: payload.notification?.title || "Whispr", body: payload.notification?.body || "" });
      setTimeout(() => setToast(null), 4500);
    });
    return unsub;
  }, []);
  return toast;
}
