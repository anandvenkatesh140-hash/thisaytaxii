import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

import {
    ref,
    get,
    push,
    set
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";


// ======================================
// TSY TAXI SETTINGS
// ======================================

const CENTER = {
    lat: 8.33557,
    lng: 77.86682
};

const SEARCH_RADIUS = 10;
const FIXED_RATE_PER_KM = 18;

let currentUser = null;

let map;
let pickupPoint = null;
let dropPoint = null;

let pickupMarker = null;
let dropMarker = null;
let routeLine = null;

let ratePerKm = FIXED_RATE_PER_KM;
let distanceKm = 0;
let calculatedFare = 0;

let nearbyPlaces = [];
let searchController = null;

const $ = id => document.getElementById(id);


// ======================================
// LOGIN CHECK
// ======================================

onAuthStateChanged(auth, async user => {

    if (!user) {
        window.location.href = "index.html";
        return;
    }

    currentUser = user;

    initializeMap();

    await loadRate();

    await loadNearbyPlaces();

    detectLocation();

});


// ======================================
// LOGOUT
// ======================================

$("logoutBtn").addEventListener("click", async () => {

    await signOut(auth);

    window.location.href = "index.html";

});


// ======================================
// MAP INITIALIZATION
// ======================================

function initializeMap() {

    map = L.map("map").setView(
        [CENTER.lat, CENTER.lng],
        12
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);

}


// ======================================
// DISTANCE CALCULATION
// ======================================

function getDistanceKm(lat1, lng1, lat2, lng2) {

    const rad = value => value * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) *
        Math.cos(rad(lat2)) *
        Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
    );

}


// ======================================
// LOAD NEARBY VILLAGES
// OPENSTREETMAP OVERPASS
// ======================================

async function loadNearbyPlaces() {

    $("locationStatus").textContent =
        "Loading nearby village names...";

    const query = `
        [out:json][timeout:25];
        (
          node(around:10000,${CENTER.lat},${CENTER.lng})["place"];
          way(around:10000,${CENTER.lat},${CENTER.lng})["place"];
          relation(around:10000,${CENTER.lat},${CENTER.lng})["place"];
        );
        out center tags;
    `;

    try {

        const response = await fetch(
            "https://overpass-api.de/api/interpreter",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({
                    data: query
                })
            }
        );

        if (!response.ok) {
            throw new Error("Village database unavailable");
        }

        const data = await response.json();

        nearbyPlaces = data.elements
            .map(element => {

                const tags = element.tags || {};

                const lat =
                    element.lat ?? element.center?.lat;

                const lng =
                    element.lon ?? element.center?.lon;

                const name =
                    tags.name ||
                    tags["name:en"] ||
                    tags["name:ta"];

                if (!name || lat == null || lng == null) {
                    return null;
                }

                const distance = getDistanceKm(
                    CENTER.lat,
                    CENTER.lng,
                    lat,
                    lng
                );

                if (distance > SEARCH_RADIUS) {
                    return null;
                }

                return {
                    name,
                    tamilName: tags["name:ta"] || "",
                    lat,
                    lng,
                    distance,
                    type: tags.place || "locality"
                };

            })
            .filter(Boolean);

        // Remove duplicate places

        nearbyPlaces = [
            ...new Map(
                nearbyPlaces.map(place => [
                    `${place.name.toLowerCase()}-${place.lat}-${place.lng}`,
                    place
                ])
            ).values()
        ];

        $("locationStatus").textContent =
            "Nearby places are ready. Select your Drop location.";

    } catch (error) {

        console.error("Nearby places error:", error);

        nearbyPlaces = [];

        $("locationStatus").textContent =
            "Online village search will be used when you type.";

    }

}


// ======================================
// DROP LOCATION SEARCH
// FIRST TWO LETTERS
// ======================================

$("dropName").addEventListener("input", function () {

    const text = this.value.trim();

    const box = $("dropSuggestions");

    clearFare();

    dropPoint = null;

    if (dropMarker) {
        map.removeLayer(dropMarker);
        dropMarker = null;
    }

    box.innerHTML = "";

    if (text.length < 2) {
        return;
    }

    box.innerHTML =
        "<div class='suggestion-item'>Searching nearby villages...</div>";

    if (searchController) {
        searchController.abort();
    }

    searchController = new AbortController();

    searchDropPlaces(text);

});


async function searchDropPlaces(text) {

    const box = $("dropSuggestions");

    const searchText = text.toLocaleLowerCase();

    try {

        // Search downloaded 10 KM places first

        let results = nearbyPlaces.filter(place => {

            return (
                place.name.toLocaleLowerCase().startsWith(searchText) ||
                place.tamilName.toLocaleLowerCase().startsWith(searchText)
            );

        });

        // Online search if local database has no matching name

        if (results.length === 0) {

            const url = new URL(
                "https://photon.komoot.io/api/"
            );

            url.searchParams.set("q", text);

            url.searchParams.set("lat", CENTER.lat);
            url.searchParams.set("lon", CENTER.lng);

            url.searchParams.set(
                "bbox",
                "77.77,8.245,77.96,8.426"
            );

            url.searchParams.set("limit", "50");

            const response = await fetch(url, {
                signal: searchController.signal
            });

            if (!response.ok) {
                throw new Error("Search failed");
            }

            const data = await response.json();

            results = data.features.map(feature => {

                const [lng, lat] =
                    feature.geometry.coordinates;

                const name = feature.properties.name;

                return {
                    name,
                    lat,
                    lng,
                    distance: getDistanceKm(
                        CENTER.lat,
                        CENTER.lng,
                        lat,
                        lng
                    )
                };

            }).filter(place => {

                return (
                    place.name &&
                    place.name.toLocaleLowerCase().startsWith(searchText) &&
                    place.distance <= SEARCH_RADIUS
                );

            });

        }

        showDropSuggestions(results);

    } catch (error) {

        if (error.name === "AbortError") return;

        console.error(error);

        box.innerHTML =
            "<div class='suggestion-item'>Search unavailable. Please try again.</div>";

    }

}


// ======================================
// SHOW DROP SUGGESTIONS
// ======================================

function showDropSuggestions(places) {

    const box = $("dropSuggestions");

    box.innerHTML = "";

    places.sort((a, b) => a.distance - b.distance);

    if (places.length === 0) {

        box.innerHTML =
            "<div class='suggestion-item'>No matching village found within 10 KM</div>";

        return;

    }

    places.forEach(place => {

        const button = document.createElement("button");

        button.type = "button";
        button.className = "suggestion-item";

        const title = document.createElement("strong");

        title.textContent = "📍 " + place.name;

        const detail = document.createElement("small");

        detail.textContent =
            place.distance.toFixed(1) +
            " KM from Thisaiyanvilai";

        button.append(title, detail);

        button.addEventListener("click", () => {

            $("dropName").value = place.name;

            dropPoint = {
                lat: place.lat,
                lng: place.lng
            };

            if (dropMarker) {
                map.removeLayer(dropMarker);
            }

            dropMarker = L.marker([
                place.lat,
                place.lng
            ]).addTo(map);

            dropMarker.bindPopup(
                "Drop: " + place.name
            ).openPopup();

            map.setView(
                [place.lat, place.lng],
                14
            );

            box.innerHTML = "";

            clearFare();

        });

        box.appendChild(button);

    });

}


// ======================================
// CURRENT GPS LOCATION
// PICKUP ONLY
// ======================================

$("detectBtn").addEventListener(
    "click",
    detectLocation
);

function detectLocation() {

    if (!navigator.geolocation) {

        $("locationStatus").textContent =
            "GPS is not supported by this browser.";

        return;

    }

    $("locationStatus").textContent =
        "Detecting your current location...";

    navigator.geolocation.getCurrentPosition(

        async position => {

            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            pickupPoint = { lat, lng };

            if (pickupMarker) {
                map.removeLayer(pickupMarker);
            }

            pickupMarker = L.marker([
                lat,
                lng
            ]).addTo(map);

            pickupMarker.bindPopup(
                "Your Current Pickup Location"
            ).openPopup();

            map.setView([lat, lng], 15);

            $("locationStatus").textContent =
                "Current location detected successfully.";

            $("currentAddress").textContent =
                "Getting your address...";

            try {

                const address = await getAddress(lat, lng);

                $("currentAddress").textContent = address;

                $("pickupName").value = address;

            } catch (error) {

                $("currentAddress").textContent =
                    "Current GPS location selected";

                $("pickupName").value =
                    `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            }

            clearFare();

        },

        error => {

            $("locationStatus").textContent =
                "Please allow GPS location permission and try again.";

            console.error(error);

        },

        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }

    );

}


// ======================================
// REVERSE GEOCODING
// ======================================

async function getAddress(lat, lng) {

    const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Address not found");
    }

    const data = await response.json();

    return data.display_name ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

}


// ======================================
// FIXED RATE ₹18 PER KM
// ======================================

async function loadRate() {

    ratePerKm = FIXED_RATE_PER_KM;

    $("rateText").textContent =
        "Rate: ₹18 per KM";

}


// ======================================
// CLEAR OLD FARE AND ROUTE
// ======================================

function clearFare() {

    distanceKm = 0;
    calculatedFare = 0;

    $("distance").textContent = "-- KM";
    $("fare").textContent = "₹ --";

    $("confirmBtn").disabled = true;

    if (routeLine) {

        map.removeLayer(routeLine);

        routeLine = null;

    }

}


// ======================================
// CALCULATE ROAD DISTANCE
// OSRM ROUTING
// ======================================

$("calculateBtn").addEventListener(
    "click",
    calculateFare
);

async function calculateFare() {

    if (!pickupPoint) {

        alert("Please allow GPS and detect your Pickup location.");

        return;

    }

    if (!dropPoint) {

        alert("Please search and select your Drop location.");

        return;

    }

    if (ratePerKm <= 0) {

        alert("Rate is not available.");

        return;

    }

    $("calculateBtn").disabled = true;

    $("calculateBtn").textContent =
        "Calculating...";

    try {

        const url =
            `https://router.project-osrm.org/route/v1/driving/${pickupPoint.lng},${pickupPoint.lat};${dropPoint.lng},${dropPoint.lat}?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Route service unavailable");
        }

        const data = await response.json();

        if (
            data.code !== "Ok" ||
            !data.routes ||
            data.routes.length === 0
        ) {
            throw new Error("Route not found");
        }

        const route = data.routes[0];

        distanceKm = route.distance / 1000;

        // ₹18 PER KM FARE CALCULATION

        calculatedFare = Math.ceil(
            distanceKm * FIXED_RATE_PER_KM
        );

        $("distance").textContent =
            distanceKm.toFixed(2) + " KM";

        $("fare").textContent =
            "₹ " + calculatedFare;

        // Draw road route

        if (routeLine) {
            map.removeLayer(routeLine);
        }

        routeLine = L.geoJSON(
            route.geometry
        ).addTo(map);

        map.fitBounds(
            routeLine.getBounds(),
            { padding: [30, 30] }
        );

        $("confirmBtn").disabled = false;

        $("bookingMessage").textContent =
            "Fare calculated successfully!";

    } catch (error) {

        console.error(error);

        alert(
            "Unable to calculate route. Please try again."
        );

    } finally {

        $("calculateBtn").disabled = false;

        $("calculateBtn").textContent =
            "CALCULATE FARE";

    }

}


// ======================================
// JOURNEY DATE MINIMUM
// ======================================

const today = new Date();

const localDate =
    today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0") + "-" +
    String(today.getDate()).padStart(2, "0");

$("journeyDate").min = localDate;


// ======================================
// CONFIRM BOOKING
// FIREBASE REALTIME DATABASE
// ======================================

$("confirmBtn").addEventListener(
    "click",
    confirmBooking
);

async function confirmBooking() {

    if (!currentUser) {

        alert("Please login again.");

        return;

    }

    if (!pickupPoint || !dropPoint || calculatedFare <= 0) {

        alert("Please calculate your fare first.");

        return;

    }

    const journeyDate = $("journeyDate").value;
    const journeyTime = $("journeyTime").value;

    if (!journeyDate || !journeyTime) {

        alert("Please select Journey Date and Time.");

        return;

    }

    if (journeyDate < localDate) {

        alert("Please select a valid journey date.");

        return;

    }

    $("confirmBtn").disabled = true;

    $("confirmBtn").textContent =
        "SAVING BOOKING...";

    try {

        const bookingRef = push(
            ref(db, "bookings")
        );

        const bookingData = {

            userId: currentUser.uid,

            email: currentUser.email || "",

            pickup: $("pickupName").value,

            drop: $("dropName").value,

            pickupLat: pickupPoint.lat,
            pickupLng: pickupPoint.lng,

            dropLat: dropPoint.lat,
            dropLng: dropPoint.lng,

            distance: Number(distanceKm.toFixed(2)),

            ratePerKm: FIXED_RATE_PER_KM,

            fare: calculatedFare,

            journeyDate: journeyDate,

            journeyTime: journeyTime,

            status: "Pending",

            createdAt: Date.now()

        };

        await set(
            bookingRef,
            bookingData
        );

        $("bookingMessage").textContent =
            "Booking submitted successfully! Waiting for Admin approval.";

        $("confirmBtn").textContent =
            "BOOKING SUBMITTED";

    } catch (error) {

        console.error(error);

        alert(
            "Booking failed. Please check your internet and try again."
        );

        $("confirmBtn").disabled = false;

        $("confirmBtn").textContent =
            "CONFIRM BOOKING";

    }

}
