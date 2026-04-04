importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "AIzaSyB3MmPn44i3yGC5LpuxzNiaZDd6eke-mcE",
  authDomain: "whispr-v2.firebaseapp.com",
  projectId: "whispr-v2",
  storageBucket: "whispr-v2.firebasestorage.app",
  messagingSenderId: "338774310441",
  appId: "1:338774310441:web:404620c8667131b8072638"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification.title,
    { body: payload.notification.body, icon: '/android-chrome-192x192.png' }
  );
});