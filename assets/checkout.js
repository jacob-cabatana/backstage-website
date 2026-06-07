import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp
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
const genderPrompt = document.getElementById("gender-prompt");
const hero = document.getElementById("checkout-hero");
const heroImage = document.getElementById("checkout-hero-image");
const heroTitle = document.getElementById("hero-title");
const heroDate = document.getElementById("hero-date");
const heroLocation = document.getElementById("hero-location");
const bottomTotal = document.getElementById("bottom-total");

let currentUser = null;
let activePhase = null;
let selectedGender = sessionStorage.getItem("checkout_gender") || null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    signInAnonymously(auth);
  }
});

document.querySelectorAll(".gender-choice").forEach((button) => {
  button.onclick = () => {
    selectedGender = button.dataset.gender;
    sessionStorage.setItem("checkout_gender", selectedGender);

    if (genderPrompt) {
      genderPrompt.style.display = "none";
    }

    if (container) {
      container.classList.remove("checkout-hidden");
    }

    applyGenderFilter();
    updateTotalFromVisibleCards();
  };
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

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(...values) {
  return values.find((value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function formatEventDate(event) {
  const raw = firstValue(
    event.startDate,
    event.date,
    event.eventDate,
    event.startTime,
    event.startsAt,
    event.timestamp
  );
  const parsed = parseFirestoreDate(raw);

  if (!parsed) return "Date TBA";

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function formatEventLocation(event) {
  return firstValue(
    event.venueName,
    event.locationName,
    event.locationTitle,
    event.address,
    event.location,
    event.venue,
    "Venue TBA"
  );
}

function getEventImageURL(event) {
  return firstValue(
    event.imageURL,
    event.flyerURL,
    event.coverImageURL,
    event.photoURL,
    event.posterURL,
    event.imageUrl,
    event.flyerUrl
  );
}

function hydrateHero(event) {
  const title = firstValue(event.title, event.name, "Backstage tickets");
  const imageURL = getEventImageURL(event);

  if (heroTitle) heroTitle.textContent = title;
  if (heroDate) heroDate.textContent = formatEventDate(event);
  if (heroLocation) heroLocation.textContent = formatEventLocation(event);
  document.title = `${title} | Backstage`;

  if (imageURL && heroImage && hero) {
    heroImage.src = imageURL;
    heroImage.hidden = false;
    hero.classList.remove("is-empty");
  }
}

async function trackCheckoutStart() {
  if (!eventId) return;

  try {
    await updateDoc(doc(db, "parties", eventId), {
      "analytics.checkoutStarts": increment(1),
      "analytics.lastUpdatedAt": serverTimestamp()
    });
  } catch (error) {
    console.error("Checkout analytics failed:", error);
  }
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
  hydrateHero(event);
  activePhase = getActivePhase(event.ticketPhases || []);
  await trackCheckoutStart();

  let freeHTML = "";

  if (event.freeTicketsEnabled === true) {
    const maleTotal = event.freeMaleTotal || 0;
    const maleClaimed = event.freeMaleClaimed || 0;
    const maleRemaining = maleTotal - maleClaimed;

    const femaleTotal = event.freeFemaleTotal || 0;
    const femaleClaimed = event.freeFemaleClaimed || 0;
    const femaleRemaining = femaleTotal - femaleClaimed;

    if (maleRemaining > 0) {
      freeHTML += `
        <div class="price-card free-ticket" data-gender="men">
          <h3>Free Male Ticket</h3>
          <p class="price-label">${maleRemaining} free left out of ${maleTotal}</p>
          <button class="claim-free">Claim Free Ticket</button>
          <p class="free-disclaimer">Disclaimer: Verifying ticket type at the door. If wrong ticket type is purchased, you will be charged double.</p>
        </div>`;
    } else if (maleTotal > 0) {
      freeHTML += `
        <div class="price-card free-ticket sold-out" data-gender="men">
          <h3>Free Male Ticket</h3>
          <p class="price-label">Sold Out ${maleTotal} total</p>
          <button disabled>Sold Out</button>
        </div>`;
    }

    if (femaleRemaining > 0) {
      freeHTML += `
        <div class="price-card free-ticket" data-gender="women">
          <h3>Free Female Ticket</h3>
          <p class="price-label">${femaleRemaining} free left out of ${femaleTotal}</p>
          <button class="claim-free">Claim Free Ticket</button>
          <p class="free-disclaimer">Disclaimer: Verifying ticket type at the door. If wrong ticket type is purchased, you will be charged double.</p>
        </div>`;
    } else if (femaleTotal > 0) {
      freeHTML += `
        <div class="price-card free-ticket sold-out" data-gender="women">
          <h3>Free Female Ticket</h3>
          <p class="price-label">Sold Out ${femaleTotal} total</p>
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
        data-phase-name="${escapeHTML(activePhase?.name || "")}">

        <h3>Male Ticket</h3>
        <p class="phase-label">${escapeHTML(activePhase?.name || "")}</p>
        <p class="phase-timer">${escapeHTML(getPhaseCountdown(activePhase))}</p>
        <p class="price-label">Price: ${formatMoney(maleAllIn)} All-In</p>

        <div class="quantity-controls">
          <button class="minus">−</button>
          <span class="quantity">0</span>
          <button class="plus">+</button>
        </div>
      </div>

      <div class="price-card"
        data-ticket-type="women"
        data-price="${femalePrice}"
        data-phase-name="${escapeHTML(activePhase?.name || "")}">

        <h3>Female Ticket</h3>
        <p class="phase-label">${escapeHTML(activePhase?.name || "")}</p>
        <p class="phase-timer">${escapeHTML(getPhaseCountdown(activePhase))}</p>
        <p class="price-label">Price: ${formatMoney(femaleAllIn)} All-In</p>

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
      <div class="event-header">
        <h2>${escapeHTML(event.title || "Event")}</h2>
        <p class="event-subhead">Choose your ticket type below</p>
      </div>

      <div>
        <h3 class="section-label">Tickets</h3>
        <p class="event-subhead">Choose your ticket type below</p>
      </div>

      ${freeHTML}
      ${pricingHTML}

      <div id="global-total" class="global-total">
        Total: $0.00 All In
      </div>
    </div>
  `;

  if (selectedGender) {
    if (genderPrompt) {
      genderPrompt.style.display = "none";
    }

    if (container) {
      container.classList.remove("checkout-hidden");
    }
  } else {
    if (genderPrompt) {
      genderPrompt.style.display = "";
    }

    if (container) {
      container.classList.add("checkout-hidden");
    }
  }

  applyGenderFilter();
  updateTotalFromVisibleCards();

  document.querySelectorAll(".plus").forEach((btn) => {
    btn.onclick = () => {
      const qty = btn.parentElement.querySelector(".quantity");
      qty.innerText = Number(qty.innerText) + 1;
      updateTotalFromVisibleCards();
    };
  });

  document.querySelectorAll(".minus").forEach((btn) => {
    btn.onclick = () => {
      const qty = btn.parentElement.querySelector(".quantity");
      const current = Number(qty.innerText);

      if (current > 0) {
        qty.innerText = current - 1;
        updateTotalFromVisibleCards();
      }
    };
  });

  const checkoutBtn = document.getElementById("checkout-button");

  checkoutBtn.onclick = () => {
    const selectedTickets = [];

    document.querySelectorAll(".price-card:not(.free-ticket)").forEach((card) => {
      if (card.style.display === "none") return;

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

  document.querySelectorAll(".claim-free").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();

      const gender = btn.closest(".free-ticket").dataset.gender;

      window.location.href =
        `/free-ticket-info.html?partyId=${eventId}&type=${gender}`;
    };
  });
}

function applyGenderFilter() {
  if (!selectedGender) return;

  document.querySelectorAll(".free-ticket").forEach((card) => {
    const matches = card.dataset.gender === selectedGender;
    card.style.display = matches ? "" : "none";
  });

  document.querySelectorAll(".price-card:not(.free-ticket)").forEach((card) => {
    const matches = card.dataset.ticketType === selectedGender;
    card.style.display = matches ? "" : "none";

    if (!matches) {
      const qty = card.querySelector(".quantity");

      if (qty) {
        qty.innerText = "0";
      }
    }
  });
}

function updateTotalFromVisibleCards() {
  let total = 0;

  document.querySelectorAll(".price-card:not(.free-ticket)").forEach((card) => {
    if (card.style.display === "none") return;

    const price = Number(card.dataset.price);
    const qty = Number(card.querySelector(".quantity").innerText);

    if (qty > 0) {
      const calc = calculateAllIn(price, qty);
      total += calc.total;
    }
  });

  const totalText = `$${total.toFixed(2)}`;
  const totalEl = document.getElementById("global-total");

  if (totalEl) {
    totalEl.innerText = `Total: ${totalText} All In`;
  }

  if (bottomTotal) {
    bottomTotal.innerText = totalText;
  }
}

loadCheckout();
