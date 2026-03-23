import { db, auth, storage, functions } from "../js/firebase.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* ------------------ STATE ------------------ */
let selectedCoords = null;
let selectedAddress = "";
let locationConfirmed = false;
let autocompleteEl = null;

/* ------------------ DOM ------------------ */
const form = document.getElementById("hostEventForm");
const submitBtn = document.getElementById("submitBtn");
const loadingOverlay = document.getElementById("loadingOverlay");
const titleInput = document.getElementById("title");

const pricingRadios = document.querySelectorAll("input[name=pricingMode]");
const singlePrice = document.getElementById("singlePrice");
const genderPrices = document.getElementById("genderPrices");

const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const media = document.getElementById("media");

const admissionPrice = document.getElementById("admissionPrice");
const maleTicketPrice = document.getElementById("maleTicketPrice");
const femaleTicketPrice = document.getElementById("femaleTicketPrice");

const doorPriceMen = document.getElementById("doorPriceMen");
const doorPriceWomen = document.getElementById("doorPriceWomen");

const guestList = document.getElementById("guestList");
const lowkeyMode = document.getElementById("lowkeyMode");

const skipEnabled = document.getElementById("skipEnabled");
const skipPrice = document.getElementById("skipPrice");

const freeTicketsEnabled = document.getElementById("freeTicketsEnabled");
const freeMaleCount = document.getElementById("freeMaleCount");
const freeFemaleCount = document.getElementById("freeFemaleCount");

const capacityLimit = document.getElementById("capacityLimit");

/* ------------------ PLACES AUTOCOMPLETE ------------------ */
const initPlaces = async () => {
  await google.maps.importLibrary("places");

  const container = document.getElementById("location-autocomplete");
  container.innerHTML = "";

  autocompleteEl = new google.maps.places.PlaceAutocompleteElement({
    types: ["establishment", "geocode"],
  });

  autocompleteEl.placeholder = "Location";
  container.appendChild(autocompleteEl);

  autocompleteEl.addEventListener("gmp-select", async ({ placePrediction }) => {
    const place = placePrediction.toPlace();

    await place.fetchFields({
      fields: ["formattedAddress", "location"],
    });

    if (!place.location) {
      selectedCoords = null;
      selectedAddress = "";
      locationConfirmed = false;
      return;
    }

    selectedAddress = place.formattedAddress;
    selectedCoords = {
      lat: place.location.lat(),
      lng: place.location.lng(),
    };

    locationConfirmed = true;
  });

  autocompleteEl.addEventListener("input", () => {
    selectedCoords = null;
    selectedAddress = "";
    locationConfirmed = false;
  });
};

window.addEventListener("load", initPlaces);

/* ------------------ UI LOGIC ------------------ */
pricingRadios.forEach(r =>
  r.addEventListener("change", () => {
    const mode = document.querySelector("input[name=pricingMode]:checked").value;
    singlePrice.hidden = mode !== "single";
    genderPrices.hidden = mode !== "gender";
  })
);

/* ------------------ SUBMIT ------------------ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  submitBtn.disabled = true;
  loadingOverlay.hidden = false;

if (!locationConfirmed || !selectedCoords) {
  alert("Select a location from the dropdown list");
  submitBtn.disabled = false;
  loadingOverlay.hidden = true;
  return;
}

  const user = auth.currentUser;
  if (!user) {
    alert("Not logged in");
    return;
  }

  const title = titleInput.value.trim();
  const location = selectedAddress;

  const start = new Date(startDate.value);
  const end = new Date(endDate.value);
  if (end <= start) {
    alert("End must be after start");
    return;
  }

  const pricingMode = document.querySelector("input[name=pricingMode]:checked").value;
  const genderPricing = pricingMode === "gender";

  let mediaUrl = null;
  const file = media.files[0];
  if (file) {
    const path = `events/${user.uid}/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    mediaUrl = await getDownloadURL(fileRef);
  }

try {
  const docRef = await addDoc(collection(db, "parties"), {
    fraternityOwnerUid: user.uid,
    hostUid: user.uid,

    title,
    location,
    coords: selectedCoords,

    startsAt: Timestamp.fromDate(start),
    endsAt: Timestamp.fromDate(end),
    expireAt: Timestamp.fromDate(end),

    mediaUrl,

    genderTicketPricing: genderPricing,
    admissionPrice: genderPricing ? null : Number(admissionPrice.value || 0),
    maleTicketPrice: genderPricing ? Number(maleTicketPrice.value || 0) : null,
    femaleTicketPrice: genderPricing ? Number(femaleTicketPrice.value || 0) : null,

    doorPriceMen: Number(doorPriceMen.value || 0),
    doorPriceWomen: Number(doorPriceWomen.value || 0),

    guestAccess: guestList.checked ? "guestlist" : "auto",
    capacityLimit: capacityLimit.value ? Number(capacityLimit.value) : null,

    lowkeyMode: lowkeyMode.checked,

    skipTheLineEnabled: skipEnabled.checked,
    skipPrice: skipEnabled.checked ? Number(skipPrice.value || 0) : null,

    freeTicketsEnabled: freeTicketsEnabled.checked,
    freeMaleTotal: freeTicketsEnabled.checked ? Number(freeMaleCount.value || 0) : 0,
    freeMaleClaimed: 0,
    freeFemaleTotal: freeTicketsEnabled.checked ? Number(freeFemaleCount.value || 0) : 0,
    freeFemaleClaimed: 0,

    createdAt: serverTimestamp(),
  });

  const createDoorCode = httpsCallable(functions, "createDoorCode");
  await createDoorCode({ partyId: docRef.id });

  window.location.href = "/dashboard.html";

} catch (err) {
  console.error(err);
  alert("Failed to publish event. Try again.");

  submitBtn.disabled = false;
  loadingOverlay.hidden = true;
}

  const createDoorCode = httpsCallable(functions, "createDoorCode");
  await createDoorCode({ partyId: docRef.id });

  alert("Event published");
  window.location.href = "/dashboard.html";
});