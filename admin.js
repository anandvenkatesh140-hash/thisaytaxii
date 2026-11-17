
import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
    ref,
    onValue,
    update
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

const ADMIN_UID = "nTn8xOy84jfWcOo9BjrYIqMagCC3";

const FIXED_RATE_PER_KM = 18;

const $ = (id) => document.getElementById(id);


// ADMIN LOGIN

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


// ADMIN AUTHENTICATION

onAuthStateChanged(auth, async (user) => {

    if (user && user.uid === ADMIN_UID) {

        $("adminLogin").classList.add("hidden");
        $("adminDashboard").classList.remove("hidden");
        $("adminLogout").classList.remove("hidden");

        if ($("rateInput")) {
            $("rateInput").value = FIXED_RATE_PER_KM;
            $("rateInput").disabled = true;
        }

        if ($("rateMessage")) {
            $("rateMessage").textContent =
                "Fixed rate: ₹18 per KM";
        }

        if ($("saveRateBtn")) {
            $("saveRateBtn").disabled = true;
        }

        loadBookings();

    } else {

        $("adminLogin").classList.remove("hidden");
        $("adminDashboard").classList.add("hidden");
        $("adminLogout").classList.add("hidden");

        if (user) {

            await signOut(auth);

            $("adminMessage").textContent =
                "Admin access only.";

        }

    }

});


// LOAD BOOKINGS

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
Pickup: ${booking.pickup || "Not available"}
Drop: ${booking.drop || "Not available"}
Distance: ${booking.distance ?? "Not available"} KM
Rate: ₹${booking.ratePerKm || FIXED_RATE_PER_KM} per KM
Fare: ₹${booking.fare ?? "Not available"}
Date: ${booking.journeyDate || "Not available"}
Time: ${booking.journeyTime || "Not available"}
Status: ${booking.status || "Pending"}`;

            card.append(title, details);

            const status = document.createElement("strong");

            status.textContent = booking.status || "Pending";

            card.appendChild(status);

            if ((booking.status || "Pending") === "Pending") {

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

    }, (error) => {

        console.error("Booking loading error:", error);

        $("bookingList").textContent =
            "Unable to load bookings: " + error.message;

    });

}


// UPDATE BOOKING STATUS

async function updateStatus(id, status) {

    try {

        await update(ref(db, `bookings/${id}`), {
            status: status
        });

    } catch (error) {

        alert("Unable to update booking: " + error.message);

    }

}


// ADMIN LOGOUT

$("adminLogout").onclick = async () => {

    await signOut(auth);

    location.href = "admin.html";

};

