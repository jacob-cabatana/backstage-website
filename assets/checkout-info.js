import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOftoMjETRbr3v7zncb-kVvLewkpmE2n0",
  authDomain: "backstageapp-27cb3.firebaseapp.com",
  projectId: "backstageapp-27cb3",
  storageBucket: "backstageapp-27cb3.firebasestorage.app",
  messagingSenderId: "148403387572",
  appId: "1:148403387572:web:98e9369e385a8449046be1"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, "us-central1");

const tickets = JSON.parse(sessionStorage.getItem("checkout_tickets") || "[]");
const eventId = sessionStorage.getItem("checkout_event_id");

if (!tickets.length || !eventId) {
  window.location.href = "/";
}

const firstName = document.getElementById("first-name");
const lastName = document.getElementById("last-name");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const button = document.getElementById("final-pay-button");
const photoInput = document.getElementById("profile-photo");
const photoPreview = document.getElementById("profile-preview");
const photoPlus = document.querySelector(".photo-plus");

const promoDigits = document.querySelectorAll(".promo-digit");
const promoFeedback = document.getElementById("promo-feedback");
const applyButton = document.getElementById("apply-promo");
const discountRow = document.getElementById("discount-row");

const uiPanels = document.querySelectorAll(".step-panel");
const uiBackButton = document.getElementById("ui-back-button");
const uiNextButton = document.getElementById("ui-next-button");
const finalPayButton = document.getElementById("final-pay-button");

const stepTitle = document.getElementById("step-title");
const stepPill = document.getElementById("step-pill");
const stepSubtitle = document.getElementById("step-subtitle");
const progressFill = document.getElementById("progress-fill");

const reviewName = document.getElementById("review-name");
const reviewEmail = document.getElementById("review-email");
const reviewPhone = document.getElementById("review-phone");
const reviewPromo = document.getElementById("review-promo");

let currentUser = null;
let profilePhotoFile = null;

let promoIsValid = false;
let promoChecked = false;
let promoDiscountPercent = 0;

let checkoutUiStep = 0;

const checkoutSteps = [
  {
    title: "Send your ticket",
    pill: "Step 2 of 4",
    subtitle: "Add your info so your ticket code can be tied to you.",
    progress: "50%"
  },
  {
    title: "Add a code",
    pill: "Step 3 of 4",
    subtitle: "Use a promoter code, or keep moving without one.",
    progress: "75%"
  },
  {
    title: "Final check",
    pill: "Step 4 of 4",
    subtitle: "Review your info before secure checkout.",
    progress: "100%"
  }
];

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  }
});

async function ensureSignedIn() {
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  currentUser = result.user;
  return result.user;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return "";
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 10);

  if (digits.length === 0) {
    return "";
  }

  if (digits.length <= 3) {
    return `(${digits}`;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function currentPromoCode() {
  return Array.from(promoDigits)
    .map((digit) => digit.value.trim())
    .join("")
    .toUpperCase();
}

function cleanPromoCodeOrNull() {
  const code = currentPromoCode();
  return code.length > 0 ? code : null;
}

function selectedTicketLabel() {
  const ticket = tickets[0] || {};

  return (
    ticket.ticketTitle ||
    ticket.ticketTypeKind ||
    ticket.ticketType ||
    "Ticket"
  );
}

function validate() {
  const valid =
    firstName.value.trim().length > 0 &&
    lastName.value.trim().length > 0 &&
    isValidEmail(email.value.trim()) &&
    normalizePhone(phone.value.trim()).length > 0 &&
    profilePhotoFile;

  button.disabled = !valid;

  if (!valid) {
    button.classList.remove("loading");
  }
}

function refreshReview() {
  const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`.trim();
  const promoCode = currentPromoCode();

  reviewName.textContent = fullName || "Missing";
  reviewEmail.textContent = email.value.trim() || "Missing";
  reviewPhone.textContent = formatPhone(phone.value.trim()) || "Missing";
  reviewPromo.textContent = promoCode || "None";
}

function canMovePastBuyerInfo() {
  return (
    firstName.value.trim().length > 0 &&
    lastName.value.trim().length > 0 &&
    isValidEmail(email.value.trim()) &&
    normalizePhone(phone.value.trim()).length > 0 &&
    profilePhotoFile
  );
}

function setButtonLoading(isLoading) {
  button.classList.toggle("loading", isLoading);
  button.disabled = isLoading || !canMovePastBuyerInfo();
}

function friendlyCheckoutError(error, fallback = "Error creating checkout session.") {
  const message = String(error?.message || error || "").toLowerCase();

  if (message.includes("sold out")) {
    return "This ticket just sold out. Go back and choose another ticket.";
  }

  if (message.includes("not enough")) {
    return "Not enough tickets are available anymore. Go back and update your quantity.";
  }

  if (message.includes("price just changed")) {
    return "This ticket price just changed. Go back, refresh, and try again.";
  }

  if (message.includes("paused")) {
    return "Ticket sales are paused for this event.";
  }

  if (message.includes("gender")) {
    return "This ticket requires a valid gender selection.";
  }

  if (message.includes("promo") || message.includes("discount")) {
    return "There was an issue with that promo code.";
  }

  return fallback;
}

async function uploadProfilePhoto(storageKey) {
  if (!profilePhotoFile) {
    return null;
  }

  const safeKey =
    storageKey ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const photoRef = ref(
    storage,
    `ticketProfiles/${eventId}/${safeKey}.jpg`
  );

  await uploadBytes(photoRef, profilePhotoFile);
  return getDownloadURL(photoRef);
}

async function saveAnonymousBuyerProfile(photoURL) {
  const user = await ensureSignedIn();

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        firstName: firstName.value.trim(),
        lastName: lastName.value.trim(),
        displayName: `${firstName.value.trim()} ${lastName.value.trim()}`.trim(),
        email: email.value.trim().toLowerCase(),
        phone: phone.value.trim(),
        phoneE164: normalizePhone(phone.value.trim()),
        photoURL: photoURL || null,
        profileImageURL: photoURL || null,
        userProfilePicture: photoURL || null,
        source: "web_checkout",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Could not save anonymous buyer profile:", error);
  }

  return user;
}

async function attachPaidTicketPhoto({ checkoutSessionId, photoURL }) {
  if (!checkoutSessionId || !photoURL) return;

  const response = await fetch(
    "https://us-central1-backstageapp-27cb3.cloudfunctions.net/attachPaidTicketPhoto",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId,
        checkoutSessionId,
        photoURL
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Could not attach ticket photo.");
  }
}

async function finalizeFreeReservation(reservationId) {
  if (!reservationId) {
    throw new Error("Missing free reservation.");
  }

  await ensureSignedIn();

  const finalizeFreeTicket = httpsCallable(functions, "finalizeFreeTicket");
  return finalizeFreeTicket({ reservationId });
}

async function verifyPromoIfNeeded() {
  const code = currentPromoCode();

  if (!code) {
    promoIsValid = false;
    promoChecked = false;
    promoDiscountPercent = 0;

    if (discountRow) {
      discountRow.style.display = "none";
    }

    if (promoFeedback) {
      promoFeedback.textContent = "";
    }

    return true;
  }

  if (code.length < 6) {
    promoFeedback.textContent = "Enter full promo code";
    promoFeedback.style.color = "#ff6b6b";
    return false;
  }

  try {
    const response = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/validatePromoCode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: code })
      }
    );

    const data = await response.json();

    promoChecked = true;
    promoIsValid = data.valid === true;

    if (promoIsValid) {
      promoDiscountPercent = Number(data.discountPercent) || 0;

      discountRow.style.display = "block";
      discountRow.textContent = `Promo Discount Applied (${Math.round(promoDiscountPercent * 100)}% Off)`;

      promoFeedback.textContent = "Promo applied";
      promoFeedback.style.color = "#4cd964";

      return true;
    }

    promoFeedback.textContent = data.error || "Invalid promo code";
    promoFeedback.style.color = "#ff6b6b";
    promoDiscountPercent = 0;

    if (discountRow) {
      discountRow.style.display = "none";
    }

    return false;
  } catch (error) {
    promoFeedback.textContent = "Error validating code";
    promoFeedback.style.color = "#ff6b6b";
    return false;
  }
}

promoDigits.forEach((input, index) => {
  input.addEventListener("input", (event) => {
    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    event.target.value = value;

    promoChecked = false;
    promoIsValid = false;
    promoDiscountPercent = 0;

    if (discountRow) {
      discountRow.style.display = "none";
    }

    if (promoFeedback) {
      promoFeedback.textContent = "";
    }

    if (value && index < promoDigits.length - 1) {
      promoDigits[index + 1].focus();
    }

    refreshReview();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) {
      promoDigits[index - 1].focus();
    }
  });
});

firstName.addEventListener("input", () => {
  validate();
  refreshReview();
});

lastName.addEventListener("input", () => {
  validate();
  refreshReview();
});

email.addEventListener("input", () => {
  validate();
  refreshReview();
});

phone.addEventListener("input", () => {
  phone.value = formatPhone(phone.value);
  validate();
  refreshReview();
});

photoInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  profilePhotoFile = file;

  const reader = new FileReader();

  reader.onload = () => {
    photoPreview.src = reader.result;
    photoPreview.style.display = "block";

    if (photoPlus) {
      photoPlus.style.display = "none";
    }

    validate();
  };

  reader.readAsDataURL(file);
});

applyButton.addEventListener("click", async () => {
  const code = currentPromoCode();

  if (!code || code.length < 6) {
    promoFeedback.textContent = "Enter full promo code";
    promoFeedback.style.color = "#ff6b6b";
    return;
  }

  applyButton.classList.add("loading");
  applyButton.disabled = true;
  promoFeedback.style.color = "rgba(255,255,255,0.6)";
  promoFeedback.textContent = "Checking code...";

  try {
    const promoOk = await verifyPromoIfNeeded();

    if (promoOk && promoIsValid) {
      applyButton.classList.remove("loading");
      applyButton.classList.add("success");
      applyButton.disabled = true;

      setTimeout(() => {
        applyButton.classList.remove("success");
        applyButton.disabled = false;
      }, 2000);

      return;
    }
  } catch (error) {
    promoFeedback.textContent = "Error validating code";
    promoFeedback.style.color = "#ff6b6b";
  }

  applyButton.classList.remove("loading");
  applyButton.disabled = false;
});

button.onclick = async () => {
  if (button.disabled || button.classList.contains("loading")) return;

  const promoOk = await verifyPromoIfNeeded();
  if (!promoOk) return;

  setButtonLoading(true);

  const buyer = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    email: email.value.trim().toLowerCase(),
    phone: phone.value.trim(),
    phoneE164: normalizePhone(phone.value.trim())
  };

  try {
    await ensureSignedIn();

    const response = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/createWebCheckoutSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          tickets,
          buyer,
          promoCode: cleanPromoCodeOrNull()
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Checkout failed.");
    }

    const photoKey =
      data.checkoutSessionId ||
      data.reservationId ||
      `${eventId}-${Date.now()}`;

    const photoURL = await uploadProfilePhoto(photoKey);

    await saveAnonymousBuyerProfile(photoURL);

    if (data.url && data.checkoutSessionId) {
      await attachPaidTicketPhoto({
        checkoutSessionId: data.checkoutSessionId,
        photoURL
      });

      window.location.href = data.url;
      return;
    }

if (data.free === true && data.reservationId) {
  const finalized = await finalizeFreeReservation(data.reservationId);
  const freeTickets = finalized?.data?.tickets || [];

  sessionStorage.setItem("checkout_free_tickets", JSON.stringify(freeTickets));

  sessionStorage.removeItem("checkout_tickets");
  sessionStorage.removeItem("checkout_event_id");
  sessionStorage.removeItem("checkout_phase");

  window.location.href =
    `/success.html?free=1&reservation_id=${encodeURIComponent(data.reservationId)}&partyId=${encodeURIComponent(eventId)}`;

  return;
}

    throw new Error("No checkout URL returned.");
  } catch (error) {
    console.error(error);

    alert(friendlyCheckoutError(error));

    button.classList.remove("loading");
    validate();
  }
};

function setCheckoutUiStep(nextStep) {
  checkoutUiStep = Math.max(0, Math.min(nextStep, checkoutSteps.length - 1));

  uiPanels.forEach((panel) => {
    panel.classList.toggle(
      "active",
      Number(panel.dataset.step) === checkoutUiStep
    );
  });

  const meta = checkoutSteps[checkoutUiStep];

  stepTitle.textContent = meta.title;
  stepPill.textContent = meta.pill;
  stepSubtitle.textContent = meta.subtitle;
  progressFill.style.width = meta.progress;

  uiBackButton.classList.toggle("hidden", checkoutUiStep === 0);
  uiNextButton.classList.toggle("hidden", checkoutUiStep === checkoutSteps.length - 1);
  finalPayButton.classList.toggle("hidden", checkoutUiStep !== checkoutSteps.length - 1);

  if (checkoutUiStep === checkoutSteps.length - 1) {
    refreshReview();
    validate();
  }
}

uiNextButton.addEventListener("click", () => {
  if (checkoutUiStep === 0 && !canMovePastBuyerInfo()) {
    alert("Add your photo, name, valid email, and phone number first.");
    return;
  }

  setCheckoutUiStep(checkoutUiStep + 1);
});

uiBackButton.addEventListener("click", () => {
  setCheckoutUiStep(checkoutUiStep - 1);
});

[firstName, lastName, email, phone].forEach((input) => {
  input.addEventListener("input", refreshReview);
});

promoDigits.forEach((input) => {
  input.addEventListener("input", refreshReview);
});

document.title = `${selectedTicketLabel()} | Backstage Checkout`;

setCheckoutUiStep(0);
validate();
refreshReview();