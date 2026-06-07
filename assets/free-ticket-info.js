import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  getAuth,
  signInAnonymously
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
const auth = getAuth(app);
const functions = getFunctions(app);
const storage = getStorage(app);

const params = new URLSearchParams(window.location.search);
const partyId = params.get("partyId");
const ticketType = params.get("type");

console.log("partyId:", partyId);
console.log("ticketType:", ticketType);

const formSection = document.getElementById("form-section");
const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const photoInput = document.getElementById("profile-photo");
const photoPreview = document.getElementById("profile-preview");
const photoPlus = document.querySelector(".photo-plus");
const button = document.getElementById("claim-free-button");

const ticketResult = document.getElementById("ticket-result");
const ticketQr = document.getElementById("ticket-qr");
const ticketName = document.getElementById("ticket-name");
const ticketCode = document.getElementById("ticket-code");
const copyButton = document.getElementById("copy-code-button");

let profilePhotoFile = null;
let currentRawCode = "";

if (!partyId || !ticketType) {
  alert("Missing ticket information.");
}

function formatPhoneNumber(value) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
}

function getPhoneDigits() {
  return phoneInput.value.replace(/\D/g, "");
}

function formatAcquireCode(code) {
  if (!code) return "";

  const cleanCode = String(code).replace(/\s/g, "");

  if (cleanCode.length <= 4) {
    return cleanCode;
  }

  return cleanCode.slice(0, 4) + " - " + cleanCode.slice(4);
}

function buildQrUrl(qrPayload) {
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" +
    encodeURIComponent(qrPayload)
  );
}

function validateForm() {
  const first = firstNameInput.value.trim();
  const last = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const phoneDigits = getPhoneDigits();

  const valid =
    first.length > 1 &&
    last.length > 1 &&
    email.includes("@") &&
    phoneDigits.length === 10 &&
    profilePhotoFile;

  button.disabled = !valid;
}

firstNameInput.addEventListener("input", validateForm);
lastNameInput.addEventListener("input", validateForm);
emailInput.addEventListener("input", validateForm);

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhoneNumber(phoneInput.value);
  validateForm();
});

photoInput.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  profilePhotoFile = file;

  const reader = new FileReader();

  reader.onload = () => {
    photoPreview.src = reader.result;
    photoPreview.style.display = "block";
    photoPlus.style.display = "none";
    validateForm();
  };

  reader.readAsDataURL(file);
});

button.addEventListener("click", async () => {
  if (button.classList.contains("loading")) return;

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const normalizedPhone = getPhoneDigits();

  if (
    !firstName ||
    !lastName ||
    !email ||
    normalizedPhone.length !== 10 ||
    !profilePhotoFile
  ) {
    return;
  }

  button.classList.add("loading");
  button.disabled = true;

  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

    const claimFreeTicket = httpsCallable(functions, "generateFreeAcquireCode");

    const result = await claimFreeTicket({
      partyId,
      ticketType,
      buyerFirstName: firstName,
      buyerLastName: lastName,
      buyerEmail: email,
      buyerPhone: normalizedPhone
    });

    const data = result.data;

    if (!data || !data.acquireCode) {
      alert("Unexpected response from server.");
      button.classList.remove("loading");
      button.disabled = false;
      return;
    }

    const acquireCode = data.acquireCode;

    const photoRef = ref(
      storage,
      `ticketProfiles/${partyId}/${acquireCode}.jpg`
    );

    try {
      await uploadBytes(photoRef, profilePhotoFile);
    } catch (e) {
      console.error(e);
      alert("Photo upload failed. Please try again.");
      button.classList.remove("loading");
      button.disabled = false;
      return;
    }

    const downloadURL = await getDownloadURL(photoRef);

    const attachRes = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/attachTicketPhoto",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          partyId,
          acquireCode,
          photoURL: downloadURL
        })
      }
    );

    if (!attachRes.ok) {
      console.warn("Photo attach request failed:", attachRes.status);
    }

    const qrPayload =
      data.qrPayload ||
      data.ticket?.qrPayload ||
      acquireCode;

    const displayCode =
      data.displayCode ||
      data.ticket?.displayCode ||
      formatAcquireCode(acquireCode);

    currentRawCode = acquireCode;

    ticketQr.src = buildQrUrl(qrPayload);

    ticketQr.onerror = () => {
      console.error("QR image failed to load:", ticketQr.src);
      alert("Ticket created, but the QR code failed to load. Please refresh.");
    };

    ticketName.innerText = `${firstName} ${lastName}`;
    ticketCode.innerText = displayCode;

    formSection.style.display = "none";
    ticketResult.style.display = "block";

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  } catch (error) {
    console.error(error);

    let message = "Unable to claim free ticket.";

    if (error.code === "already-exists") {
      message = "You already have a ticket for this event.";
    }

    if (error.code === "resource-exhausted") {
      message = "Free tickets are sold out.";
    }

    alert(message);

    button.classList.remove("loading");
    button.disabled = false;
  }
});

copyButton.onclick = async () => {
  if (!currentRawCode) return;

  try {
    await navigator.clipboard.writeText(currentRawCode);

    copyButton.innerText = "Copied!";
    copyButton.classList.add("copied");

    setTimeout(() => {
      copyButton.innerText = "Copy Backup Code";
      copyButton.classList.remove("copied");
    }, 2000);
  } catch (e) {
    alert("Unable to copy code.");
  }
};