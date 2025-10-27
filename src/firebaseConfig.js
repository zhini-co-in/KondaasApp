// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfFR7LedzO0opgi1HfmUyQlyLNQihkhbg",
  authDomain: "kondaas-5dfaa.firebaseapp.com",
  projectId: "kondaas-5dfaa",
  storageBucket: "kondaas-5dfaa.firebasestorage.app",
  messagingSenderId: "833207375451",
  appId: "1:833207375451:web:af566adf9c73e75e39917e",
  measurementId: "G-ZQQ5CJWED1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Firestore
export const db = getFirestore(app);
