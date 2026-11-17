
import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
    ref,
    get,
    set,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const ADMIN_UID = "nTn8xOy84jfWcOo9BjrYIqMagCC3";

const $ = (id) => document.getElementById(id);

$("adminLoginForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    $("adminMessage").textContent = "Checking login...";

    try {

        await signInWithEmailAndPassword(
            auth,
            $("adminEmail").value.trim(),
            $("adminPassword").value
        );

    } catch (error) {

        $("adminMessage").textContent = error.message;

    }

});

onAuthStateChanged(auth, async (user) => {

    if (user && user.uid === ADMIN_UID) {

        $("adminLogin").classList.add("hidden");
        $("adminDashboard").classList.remove("hidden");
        $("adminLogout").classList.remove("hidden");

        loadRate();
        loadBookings();

    } else {

        $("adminLogin").classList.remove("hidden");
        $("adminDashboard").classList.add("hidden");
        $("adminLogout").classList.add("hidden");

        if (user) {
            await signOut(auth);
            $("adminMessage").textContent = "Admin access only.";
        }

    }

});

async function loadRate() {

    const snapshot = await get(ref(db, "settings/ratePerKm"));

    $("rateInput").value = snapshot.val() || "";

}

$("saveRateBtn").onclick = async () => {

    const rate = Number($("rateInput").value);

    if (!Number.isFinite(rate) || rate <= 0) {

        $("rateMessage").textContent =
            "Please enter a valid rate.";

        return;

    }

    try {

        await set(ref(db, "settings/ratePerKm"), rate);

        $("rateMessage").textContent =
            "KM rate updated successfully!";

    } catch (error) {

        $("rateMessage").textContent = error.message;

    }

};

function loadBookings() {

    onValue(ref(db, "bookings"), (snapshot) => {

        const bookings = snapshot.val() || {};

        const list = $("bookingList");

        list.replaceChildren();

        const entries = Object.entries(bookings).reverse();

        if (entries.length === 0) {

            list.textContent = "No bookings available.";
            return;

        }

        entries.forEach(([id, booking]) => {

            const card = document.createElement("div");
            card.className = "admin-booking";

            const title = document.createElement("h3");
            title.textContent = "🚕 New Booking";

            const details = document.createElement("p");

            details.textContent =
                `Customer: ${booking.email || "Customer"}
Pickup: ${booking.pickupName}
Drop: ${booking.dropName}
Distance: ${booking.distanceKm} KM
Fare: ₹${booking.fare}
Date: ${booking.date}
Time: ${booking.time}
Status: ${booking.status}`;

            card.append(title, details);

            const status = document.createElement("strong");
            status.textContent = booking.status;
            card.appendChild(status);

            if (booking.status === "Pending") {

                const accept = document.createElement("button");

                accept.textContent = "ACCEPT";
                accept.className = "accept-btn";

                accept.onclick = () =>
                    updateStatus(id, "Accepted");

                const reject = document.createElement("button");

                reject.textContent = "REJECT";
                reject.className = "reject-btn";

                reject.onclick = () =>
                    updateStatus(id, "Rejected");

                card.append(accept, reject);

            }

            list.appendChild(card);

        });

    });

}

async function updateStatus(id, status) {

    try {

        await update(ref(db, `bookings/${id}`), {
            status: status
        });

    } catch (error) {

        alert("Unable to update booking: " + error.message);

    }

}

$("adminLogout").onclick = async () => {

    await signOut(auth);

    location.href = "admin.html";

};
