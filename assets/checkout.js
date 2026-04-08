import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOftoMjETRbr3v7zncb-kVvLewkpmE2n0",
  authDomain: "backstageapp-27cb3.firebaseapp.com",
  projectId: "backstageapp-27cb3",
  storageBucket: "backstageapp-27cb3.firebasestorage.app",
  messagingSenderId: "148403387572",
  appId: "1:148403387572:web:98e9369e385a8449046be1",
  measurementId: "G-PQMTKCL1RC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

const container = document.getElementById("checkout-event");

let currentUser = null;
let activePhase = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    signInAnonymously(auth);
  }
});

function calculateAllIn(unitPrice, quantity) {

  if (!unitPrice || unitPrice === 0) {
    return { total: 0 };
  }

  const LOW_THRESHOLD = 7;
  const LOW_FEE = 2.99;
  const STANDARD_FEE = 4.99;
  const PER_TICKET_FEE = 3.99;

  const subtotal = unitPrice * quantity;

  const baseFee =
    unitPrice < LOW_THRESHOLD
      ? LOW_FEE
      : STANDARD_FEE;

  const fee =
    baseFee + Math.max(0, quantity - 1) * PER_TICKET_FEE;

  const preliminary = subtotal + fee;

  const stripeFee = preliminary * 0.029 + 0.30;

  const total = preliminary + stripeFee;

  return { total };
}

function parseFirestoreDate(value) {

  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function getSortedPhases(ticketPhases = []) {

  return [...ticketPhases].sort((a, b) => {

    const aDate = parseFirestoreDate(a.expiresAt) || new Date("9999-12-31");
    const bDate = parseFirestoreDate(b.expiresAt) || new Date("9999-12-31");

    return aDate - bDate;
  });
}

function getActivePhase(ticketPhases = []) {

  const now = new Date();

  const sorted = getSortedPhases(ticketPhases);

  const active = sorted.find((phase) => {

    const expiresAt = parseFirestoreDate(phase.expiresAt);
    return expiresAt && now < expiresAt;

  });

  return active || sorted[sorted.length - 1] || null;
}

function getPhaseCountdown(phase) {

  if (!phase) return "";

  const expiresAt = parseFirestoreDate(phase.expiresAt);

  if (!expiresAt) return "";

  const now = new Date();
  const seconds = Math.floor((expiresAt - now) / 1000);

  if (seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `⏳ Price increases in ${days} day${days > 1 ? "s" : ""}`;
  }

  if (hours > 0) {
    return `⏳ Price increases in ${hours} hour${hours > 1 ? "s" : ""}`;
  }

  return `⏳ Price increases in ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function loadCheckout() {

  if (!eventId) {
    container.innerHTML = "<p>Missing event.</p>";
    return;
  }

  const docRef = doc(db, "parties", eventId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    container.innerHTML = "<p>Event not found.</p>";
    return;
  }

  const event = docSnap.data();
  activePhase = getActivePhase(event.ticketPhases || []);

  let freeHTML = "";

if (event.freeTicketsEnabled === true) {

  const maleTotal = event.freeMaleTotal || 0;
  const maleClaimed = event.freeMaleClaimed || 0;
  const maleRemaining = maleTotal - maleClaimed;

  const femaleTotal = event.freeFemaleTotal || 0;
  const femaleClaimed = event.freeFemaleClaimed || 0;
  const femaleRemaining = femaleTotal - femaleClaimed;

  // MALE
  if (maleRemaining > 0) {

    freeHTML += `
    <div class="price-card free-ticket" data-gender="men">
      <h3>Free Male Ticket</h3>
      <p class="price-label">${maleRemaining} free left (out of ${maleTotal})</p>
      <button class="claim-free">Claim Free Ticket</button>
      <p class="free-disclaimer">Disclaimer: Verifying ticket type at the door. If wrong ticket type is purchased, you will be charged double.</p>
    </div>`;

  } else if (maleTotal > 0) {

    freeHTML += `
    <div class="price-card free-ticket sold-out" data-gender="men">
      <h3>Free Male Ticket</h3>
      <p class="price-label">Sold Out (${maleTotal} total)</p>
      <button disabled>Sold Out</button>
    </div>`;
  }

  // FEMALE
  if (femaleRemaining > 0) {

    freeHTML += `
    <div class="price-card free-ticket" data-gender="women">
      <h3>Free Female Ticket</h3>
      <p class="price-label">${femaleRemaining} free left (out of ${femaleTotal})</p>
      <button class="claim-free">Claim Free Ticket</button>
      <p class="free-disclaimer">Disclaimer: Verifying ticket type at the door. If wrong ticket type is purchased, you will be charged double.</p>
    </div>`;

  } else if (femaleTotal > 0) {

    freeHTML += `
    <div class="price-card free-ticket sold-out" data-gender="women">
      <h3>Free Female Ticket</h3>
      <p class="price-label">Sold Out (${femaleTotal} total)</p>
      <button disabled>Sold Out</button>
    </div>`;
  }
}

  let pricingHTML = "";

if (event.pricingMode === "phases" || event.genderTicketPricing === true) {

let malePrice = Number(event.maleTicketPrice || 0);
let femalePrice = Number(event.femaleTicketPrice || 0);

if (event.pricingMode === "phases" && event.ticketPhases?.length) {

  activePhase = getActivePhase(event.ticketPhases);

  if (activePhase?.malePrice !== undefined) {
    malePrice = Number(activePhase.malePrice);
  }

  if (activePhase?.femalePrice !== undefined) {
    femalePrice = Number(activePhase.femalePrice);
  }

}

  const maleAllIn = calculateAllIn(malePrice, 1).total;
  const femaleAllIn = calculateAllIn(femalePrice, 1).total;

  pricingHTML = `
<div class="price-card"
  data-ticket-type="men"
  data-price="${malePrice}"
  data-phase-name="${activePhase?.name || ''}">

<h3>Male Ticket</h3>
<p class="phase-label">${activePhase?.name || ""}</p>
<p class="phase-timer">${getPhaseCountdown(activePhase)}</p>
<p class="price-label">Price: ${formatMoney(maleAllIn)}</p>

      <div class="quantity-controls">
        <button class="minus">−</button>
        <span class="quantity">0</span>
        <button class="plus">+</button>
      </div>

    </div>

<div class="price-card"
  data-ticket-type="women"
  data-price="${femalePrice}"
  data-phase-name="${activePhase?.name || ''}">

<h3>Female Ticket</h3>
<p class="phase-label">${activePhase?.name || ""}</p>
<p class="phase-timer">${getPhaseCountdown(activePhase)}</p>
<p class="price-label">Price: ${formatMoney(femaleAllIn)}</p>

      <div class="quantity-controls">
        <button class="minus">−</button>
        <span class="quantity">0</span>
        <button class="plus">+</button>
      </div>

    </div>
  `;
}

  container.innerHTML = `
    <div class="checkout-card">
      <h2>${event.title}</h2>
      ${freeHTML}
        ${pricingHTML}
      <div id="global-total" class="global-total">
        Total: $0.00
      </div>
    </div>
  `;

  document.querySelectorAll(".plus").forEach(btn => {

    btn.onclick = () => {

      const qty = btn.parentElement.querySelector(".quantity");

      qty.innerText = Number(qty.innerText) + 1;

      updateTotal();
    };
  });

  document.querySelectorAll(".minus").forEach(btn => {

    btn.onclick = () => {

      const qty = btn.parentElement.querySelector(".quantity");

      const current = Number(qty.innerText);

      if (current > 0) {
        qty.innerText = current - 1;
        updateTotal();
      }
    };
  });

  function updateTotal() {

    let total = 0;

    document.querySelectorAll(".price-card:not(.free-ticket)").forEach(card => {

      const price = Number(card.dataset.price);
      const qty = Number(card.querySelector(".quantity").innerText);

      if (qty > 0) {

        const calc = calculateAllIn(price, qty);

        total += calc.total;
      }
    });

    document.getElementById("global-total").innerText =
      `Total: $${total.toFixed(2)} All In`;
  }

  const checkoutBtn = document.getElementById("checkout-button");

  checkoutBtn.onclick = () => {

    const selectedTickets = [];

    document.querySelectorAll(".price-card:not(.free-ticket)").forEach(card => {

      const qty = Number(card.querySelector(".quantity").innerText);

      if (qty > 0) {

        selectedTickets.push({
          ticketType: card.dataset.ticketType,
          quantity: qty,
          unitPrice: Number(card.dataset.price),
          pricingMode: "phases",
          phaseName: card.dataset.phaseName
        });
      }
    });

    if (selectedTickets.length === 0) {
      alert("Select at least one ticket.");
      return;
    }

    sessionStorage.setItem("checkout_tickets", JSON.stringify(selectedTickets));
    sessionStorage.setItem("checkout_event_id", eventId);

    if (activePhase) {

      sessionStorage.setItem(
        "checkout_phase",
        JSON.stringify({
          name: activePhase.name,
          expiresAt: parseFirestoreDate(activePhase.expiresAt)?.toISOString()
        })
      );
    }

    window.location.href = "/checkout-info.html";
  };

  document.querySelectorAll(".claim-free").forEach(btn => {

    btn.onclick = (e) => {

      e.preventDefault();

      const gender = btn.closest(".free-ticket").dataset.gender;

      window.location.href =
        `/free-ticket-info.html?partyId=${eventId}&type=${gender}`;
    };
  });
}

loadCheckout();