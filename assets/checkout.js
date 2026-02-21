import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";

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
const functions = getFunctions(app);
const auth = getAuth(app);

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

const container = document.getElementById("checkout-event");
let currentUser = null;

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

  const LOW_THRESHOLD = 7.00;
  const LOW_FEE = 2.99;
  const STANDARD_FEE = 4.99;
  const PER_TICKET_FEE = 3.99; // matches backend perTicketFee

  const subtotal = unitPrice * quantity;

  const baseFee =
    unitPrice < LOW_THRESHOLD
      ? LOW_FEE
      : STANDARD_FEE;

  const fee =
    baseFee + Math.max(0, quantity - 1) * PER_TICKET_FEE;

  const preliminary = subtotal + fee;

  const stripeFee = (preliminary * 0.029) + 0.30;

  const total = preliminary + stripeFee;

  return { total };
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

  let freeHTML = "";

if (event.freeTicketsEnabled === true) {

  const maleRemaining =
    (event.freeMaleTotal || 0) - (event.freeMaleClaimed || 0);

  const femaleRemaining =
    (event.freeFemaleTotal || 0) - (event.freeFemaleClaimed || 0);

  if (maleRemaining > 0) {
    freeHTML += `
      <div class="price-card free-ticket" data-gender="men">
        <h3>Free Male Ticket</h3>
        <p class="price-label">${maleRemaining} free left</p>
        <button class="claim-free">Claim Free Ticket</button>
      </div>
    `;
  }

  if (femaleRemaining > 0) {
    freeHTML += `
      <div class="price-card free-ticket" data-gender="women">
        <h3>Free Female Ticket</h3>
        <p class="price-label">${femaleRemaining} free left</p>
        <button class="claim-free">Claim Free Ticket</button>
      </div>
    `;
  }
}

  let pricingHTML = "";

  if (event.genderTicketPricing === true) {

    const maleAllIn = calculateAllIn(event.maleTicketPrice || 0, 1).total;
    const femaleAllIn = calculateAllIn(event.femaleTicketPrice || 0, 1).total;

    pricingHTML = `
      <div class="price-card" data-price="${event.maleTicketPrice || 0}">
        <h3>Male Ticket</h3>
        <p class="price-label">Price: $${maleAllIn.toFixed(2)} </p>
        <div class="quantity-controls">
          <button class="minus">−</button>
          <span class="quantity">0</span>
          <button class="plus">+</button>
        </div>
      </div>

      <div class="price-card" data-price="${event.femaleTicketPrice || 0}">
        <h3>Female Ticket</h3>
        <p class="price-label">Price: $${femaleAllIn.toFixed(2)} </p>
        <div class="quantity-controls">
          <button class="minus">−</button>
          <span class="quantity">0</span>
          <button class="plus">+</button>
        </div>
      </div>
    `;

  } else {

    const allIn = calculateAllIn(event.admissionPrice || 0, 1).total;

    pricingHTML = `
      <div class="price-card" data-price="${event.admissionPrice || 0}">
        <h3>Secure Ticket</h3>
        <p class="price-label">Price: $${allIn.toFixed(2)} </p>
        <div class="quantity-controls">
          <button class="minus">−</button>
          <span class="quantity">1</span>
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
      Total: —
    </div>
  </div>
`;

document.querySelectorAll(".price-card:not(.free-ticket)").forEach(card => {

  const unitPrice = Number(card.dataset.price);
  const quantityEl = card.querySelector(".quantity");
  const plusBtn = card.querySelector(".plus");
  const minusBtn = card.querySelector(".minus");

  // Increase quantity
  plusBtn.onclick = () => {
    const current = Number(quantityEl.innerText);
    quantityEl.innerText = current + 1;
    updateGlobalTotal();
  };

  // Decrease quantity
  minusBtn.onclick = () => {
    const current = Number(quantityEl.innerText);
    if (current > 0) {
      quantityEl.innerText = current - 1;
      updateGlobalTotal();
    }
  };

});


function updateGlobalTotal() {

  let total = 0;

  document.querySelectorAll(".price-card:not(.free-ticket)").forEach(card => {

    const unitPrice = Number(card.dataset.price);
    const qty = Number(card.querySelector(".quantity").innerText);

    if (qty > 0) {
      const calc = calculateAllIn(unitPrice, qty);
      total += calc.total;
    }

  });

  const totalEl = document.getElementById("global-total");

  totalEl.innerText =
    total > 0
      ? `Total: $${total.toFixed(2)} All-In`
      : `Total: $0.00`;
}

/* AUTO SELECT FIRST CARD */
const firstCard = document.querySelector(".price-card");

const checkoutBtn = document.getElementById("checkout-button");

if (checkoutBtn) {
  checkoutBtn.onclick = () => {

    const selectedTickets = [];

    document.querySelectorAll(".price-card:not(.free-ticket)").forEach(card => {
      const unitPrice = Number(card.dataset.price);
      const qty = Number(card.querySelector(".quantity")?.innerText || 0);

      if (qty > 0) {
        const title = card.querySelector("h3")?.innerText.toLowerCase() || "";

        selectedTickets.push({
          ticketType: title.includes("female")
            ? "women"
            : title.includes("male")
            ? "men"
            : "general",
          quantity: qty,
          unitPrice: unitPrice
        });
      }
    });

    if (selectedTickets.length === 0) {
      alert("Select at least one ticket.");
      return;
    }

    sessionStorage.setItem("checkout_tickets", JSON.stringify(selectedTickets));
    sessionStorage.setItem("checkout_event_id", eventId);

    window.location.href = "/checkout-info.html";
  };
}

if (firstCard) {
  firstCard.click();
}

document.querySelectorAll(".claim-free").forEach(button => {

  button.onclick = (e) => {

    e.preventDefault();

    const card = button.closest(".free-ticket");
    const gender = card.dataset.gender;

window.location.href = `/free-ticket-info.html?partyId=${eventId}&type=${gender}`;
  };

});
  
}

loadCheckout();

