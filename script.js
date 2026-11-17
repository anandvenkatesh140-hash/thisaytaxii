
import { auth } from "./firebase.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const ADMIN_UID = "nTn8xOy84jfWcOo9BjrYIqMagCC3";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const message = document.getElementById("authMessage");

let registerMode = false;

onAuthStateChanged(auth, (user) => {
    if (user) {
        if (user.uid === ADMIN_UID) {
            location.href = "admin.html";
        } else {
            location.href = "home.html";
        }
    }
});

document.getElementById("switchBtn").onclick = () => {

    registerMode = !registerMode;

    loginForm.classList.toggle("hidden", registerMode);
    registerForm.classList.toggle("hidden", !registerMode);

    document.getElementById("formTitle").textContent =
        registerMode ? "Create Account" : "Welcome Back!";

    document.getElementById("switchLabel").textContent =
        registerMode ? "Already have an account?" : "New customer?";

    document.getElementById("switchBtn").textContent =
        registerMode ? "Login" : "Register";

    message.textContent = "";
};

loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    message.textContent = "Logging in...";

    try {

        await signInWithEmailAndPassword(
            auth,
            document.getElementById("loginEmail").value.trim(),
            document.getElementById("loginPassword").value
        );

    } catch (error) {

        message.textContent = error.message;

    }

});

registerForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    message.textContent = "Creating account...";

    try {

        await createUserWithEmailAndPassword(
            auth,
            document.getElementById("registerEmail").value.trim(),
            document.getElementById("registerPassword").value
        );

    } catch (error) {

        message.textContent = error.message;

    }

});
