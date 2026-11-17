
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import { getDatabase } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const firebaseConfig = {
    
  apiKey: "AIzaSyCOn-Y5ll_MN7Hf58Mnx1dcBvhU_Vsy_UA",
  authDomain: "thisay-taxii.firebaseapp.com",
  databaseURL: "https://thisay-taxii-default-rtdb.firebaseio.com",
  projectId: "thisay-taxii",
  storageBucket: "thisay-taxii.firebasestorage.app",
  messagingSenderId: "522195892379",
  appId: "1:522195892379:web:fc890ba62ed8d60da2ae3e",
  measurementId: "G-LP7XLCC1EK"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
