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


const firstNameInput = document.getElementById("first-name");
const lastNameInput = document.getElementById("last-name");
const emailInput = document.getElementById("email");
const photoInput = document.getElementById("profile-photo");
const photoPreview = document.getElementById("profile-preview");
const photoPlus = document.querySelector(".photo-plus");
const button = document.getElementById("claim-free-button");

let profilePhotoFile = null;
const codeDisplay = document.getElementById("code-display");
const codeEl = document.getElementById("acquire-code");
const copyButton = document.getElementById("copy-code-button");



// Basic guard
if (!partyId || !ticketType) {
  alert("Missing ticket information.");
}

// Enable button only if form valid
function validateForm() {
  const first = firstNameInput.value.trim();
  const last = lastNameInput.value.trim();
  const email = emailInput.value.trim();
console.log("first:", first);
console.log("last:", last);
console.log("email:", email);

const valid =
  first.length > 1 &&
  last.length > 1 &&
  email.includes("@") &&
  profilePhotoFile;

  button.disabled = !valid;
}

firstNameInput.addEventListener("input", validateForm);
lastNameInput.addEventListener("input", validateForm);
emailInput.addEventListener("input", validateForm);
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

  if (!firstName || !lastName || !email) return;

  button.classList.add("loading");
  button.disabled = true;

  try {
    // Ensure anonymous login
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }

const claimFreeTicket = httpsCallable(functions, "generateFreeAcquireCode");

const result = await claimFreeTicket({
  partyId,
  ticketType,
  buyerFirstName: firstName,
  buyerLastName: lastName,
  buyerEmail: email
});

const data = result.data;

   if (data && data.acquireCode) {

  const acquireCode = data.acquireCode;

  // 1️⃣ Upload photo to Storage
  const photoRef = ref(
    storage,
    `ticketProfiles/${partyId}/${acquireCode}.jpg`
  );
try {
  await uploadBytes(photoRef, profilePhotoFile);
} catch (e) {
  alert("Photo upload failed. Please try again.");
  button.classList.remove("loading");
  button.disabled = false;
  return;
}

  // 2️⃣ Get download URL
  const downloadURL = await getDownloadURL(photoRef);

    // 3️⃣ Write photo URL to ticket doc
const attachRes = await fetch(
  "https://us-central1-backstageapp-27cb3.cloudfunctions.net/attachTicketPhoto",
  
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyId,
        acquireCode,
        photoURL: downloadURL
      })
    }
  );
  if (!attachRes.ok) {
  alert("Failed to attach photo to ticket.");
  button.classList.remove("loading");
  button.disabled = false;
  return;
}

      const rawCode = data.acquireCode;
      const formattedCode = rawCode.slice(0, 4) + " - " + rawCode.slice(4);
      codeEl.innerText = formattedCode;
      codeDisplay.style.display = "block";
      document.getElementById("scroll-hint").style.display = "flex";
      document.getElementById("how-to").style.display = "block";
      document.getElementById("video-section").style.display = "block";

      copyButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(rawCode);
    copyButton.innerText = "Copied";
    copyButton.classList.add("copied");

    setTimeout(() => {
      copyButton.innerText = "Copy";
      copyButton.classList.remove("copied");
    }, 2000);
  } catch (e) {
    alert("Unable to copy code.");
  }
};

      // Hide form + button
      document.querySelector(".form").style.display = "none";
      button.style.display = "none";

    } else {
      alert("Unexpected response from server.");
      button.classList.remove("loading");
      button.disabled = false;
    }

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

const video = document.getElementById("redeemVideo");

if (video) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        video.play();
      }
    },
    { threshold: 0.6 }
  );

  observer.observe(video);
}