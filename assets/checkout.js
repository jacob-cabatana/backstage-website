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
const eventId =
  params.get("id") ||
  params.get("eventId") ||
  params.get("partyId");

const container = document.getElementById("checkout-event");
const checkoutRoot = document.getElementById("checkout-root");
const heroImage = document.getElementById("checkout-hero-image");
const imageFallback = document.getElementById("checkout-image-fallback");
const eventTitle = document.getElementById("event-title");
const eventDate = document.getElementById("event-date");
const eventLocation = document.getElementById("event-location");
const ticketCount = document.getElementById("ticket-count");
const bottomTotal = document.getElementById("bottom-total");
const bottomCaption = document.getElementById("bottom-caption");
const checkoutButton = document.getElementById("checkout-button");

let currentUser = null;
let activePhase = null;

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

function calculateAllIn(unitPrice, quantity) {
  if (!unitPrice || unitPrice === 0) {
    return { total: 0 };
  }

  const LOW_THRESHOLD = 7;
  const LOW_FEE = 2.99;
  const STANDARD_FEE = 4.99;
  const PER_TICKET_FEE = 3.99;

  const subtotal = unitPrice * quantity;
  const baseFee = unitPrice < LOW_THRESHOLD ? LOW_FEE : STANDARD_FEE;
  const fee = baseFee + Math.max(0, quantity - 1) * PER_TICKET_FEE;
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

  const seconds = Math.floor((expiresAt - new Date()) / 1000);
  if (seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `Price increases in ${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `Price increases in ${hours} hour${hours > 1 ? "s" : ""}`;
  return `Price increases in ${minutes} minute${minutes > 1 ? "s" : ""}`;
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
    month: "long",
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
    event.mediaUrl,
    event.imageURL,
    event.imageUrl,
    event.eventImageUrl,
    event.photoUrl,
    event.photoURL,
    event.flyerURL,
    event.flyerUrl,
    ""
  );
}

function hydrateEventHeader(event) {
  const title = firstValue(event.title, event.name, "Backstage tickets");
  const imageURL = getEventImageURL(event);

  const titleEl =
    document.getElementById("event-title") ||
    document.getElementById("hero-title");

  const dateEl =
    document.getElementById("event-date") ||
    document.getElementById("hero-date");

  const locationEl =
    document.getElementById("event-location") ||
    document.getElementById("hero-location");

  const heroEl = document.getElementById("checkout-hero");

  if (titleEl) titleEl.textContent = title;
  if (dateEl) dateEl.textContent = formatEventDate(event);
  if (locationEl) locationEl.textContent = formatEventLocation(event);

  document.title = `${title} | Backstage`;


if (imageURL && heroImage) {
  console.log("Checkout image URL:", imageURL);

  heroImage.onload = () => {
    heroImage.hidden = false;
    heroImage.style.display = "block";

    if (imageFallback) {
      imageFallback.hidden = true;
      imageFallback.style.display = "none";
    }
  };

  heroImage.onerror = () => {
    console.error("Checkout image failed:", imageURL);
  };

  heroImage.src = imageURL;

  if (heroEl) {
    heroEl.classList.remove("is-empty");
  }
}

  const accent = firstValue(event.accentColor, event.eventAccentColor, event.themeColor);

  if (accent && checkoutRoot) {
    checkoutRoot.style.setProperty("--event-accent-color", accent);
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

function getTicketRows(event) {
  const rows = [];

  if (event.freeTicketsEnabled === true) {
    const femaleTotal = Number(event.freeFemaleTotal || 0);
    const femaleClaimed = Number(event.freeFemaleClaimed || 0);
    const femaleRemaining = Math.max(0, femaleTotal - femaleClaimed);

    const maleTotal = Number(event.freeMaleTotal || 0);
    const maleClaimed = Number(event.freeMaleClaimed || 0);
    const maleRemaining = Math.max(0, maleTotal - maleClaimed);

    if (femaleTotal > 0) {
      rows.push({
        kind: "free",
        gender: "women",
        name: "Free Female",
        priceLabel: "Free",
        availableLabel: femaleRemaining > 0 ? `${femaleRemaining} free left` : "Sold out",
        soldOut: femaleRemaining <= 0
      });
    }

    if (maleTotal > 0) {
      rows.push({
        kind: "free",
        gender: "men",
        name: "Free Male",
        priceLabel: "Free",
        availableLabel: maleRemaining > 0 ? `${maleRemaining} free left` : "Sold out",
        soldOut: maleRemaining <= 0
      });
    }
  }

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

    rows.push({
      kind: "paid",
      gender: "women",
      name: "GA Female",
      unitPrice: femalePrice,
      priceLabel: `${formatMoney(calculateAllIn(femalePrice, 1).total)} all-in`,
      phaseName: activePhase?.name || "General Admission",
      timer: getPhaseCountdown(activePhase)
    });

    rows.push({
      kind: "paid",
      gender: "men",
      name: "GA Male",
      unitPrice: malePrice,
      priceLabel: `${formatMoney(calculateAllIn(malePrice, 1).total)} all-in`,
      phaseName: activePhase?.name || "General Admission",
      timer: getPhaseCountdown(activePhase)
    });
  }

  return rows;
}

function renderFreeRow(row) {
  const disabled = row.soldOut ? "disabled" : "";
  const pillLabel = row.gender === "women" ? "Free Female" : "Free Male";

  return `
    <article class="ticket-row free-ticket ${row.soldOut ? "is-sold-out" : ""}" data-ticket-gender="${row.gender}">
      <div class="ticket-copy">
        <div class="ticket-name-line">
          <h3 class="ticket-name">${escapeHTML(row.name)}</h3>
        </div>

        <p class="ticket-subtext">${escapeHTML(row.availableLabel)}</p>
      </div>

      <div class="ticket-action">
        <button class="ticket-pill claim-free" type="button" ${disabled}>
          <span class="ticket-pill-label">${escapeHTML(pillLabel)}</span>
          <span class="ticket-pill-price">${row.soldOut ? "Sold" : "$0"}<small>${row.soldOut ? "" : "ea"}</small></span>
        </button>
      </div>
    </article>
  `;
}

function renderPaidRow(row, index) {
  const pillLabel = row.gender === "women" ? "GA Female" : "GA Male";
  const allInPrice = calculateAllIn(row.unitPrice, 1).total;

  return `
    <article class="ticket-row paid-ticket"
      data-ticket-gender="${row.gender}"
      data-ticket-type="${row.gender}"
      data-price="${row.unitPrice}"
      data-phase-name="${escapeHTML(row.phaseName)}">

      <div class="ticket-copy">
        <div class="ticket-name-line">
          <h3 class="ticket-name">${escapeHTML(row.name)}</h3>
        </div>

        <p class="ticket-subtext">${escapeHTML(row.phaseName)}</p>
      </div>

      <div class="ticket-action">
        <div>
          <div class="ticket-pill">
            <span class="ticket-pill-label">${escapeHTML(pillLabel)}</span>
            <span class="ticket-pill-price">$${Math.round(allInPrice)}<small>ea</small></span>
          </div>

          <div class="qty-control" aria-label="Quantity for ${escapeHTML(row.name)}">
            <button class="qty-button minus" type="button" disabled aria-label="Decrease quantity">−</button>
            <span class="quantity" data-row-index="${index}">0</span>
            <button class="qty-button plus" type="button" aria-label="Increase quantity">+</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function updateTotal() {
  let total = 0;
  let count = 0;

  document.querySelectorAll(".paid-ticket").forEach((card) => {
    const price = Number(card.dataset.price);
    const quantity = Number(card.querySelector(".quantity")?.textContent || 0);
    const minus = card.querySelector(".minus");

    card.classList.toggle("is-selected", quantity > 0);

    if (minus) {
      minus.disabled = quantity <= 0;
    }

    if (quantity > 0) {
      total += calculateAllIn(price, quantity).total;
      count += quantity;
    }
  });

  if (bottomTotal) {
    bottomTotal.textContent = `$${total.toFixed(2)}`;
  }

  if (bottomCaption) {
    bottomCaption.textContent =
      count > 0 ? `${count} ticket${count > 1 ? "s" : ""} selected` : "Select tickets";
  }

  if (checkoutButton) {
    checkoutButton.disabled = count === 0;
  }
}

function attachTicketHandlers() {
  document.querySelectorAll(".paid-ticket").forEach((card) => {
    const quantity = card.querySelector(".quantity");
    const plus = card.querySelector(".plus");
    const minus = card.querySelector(".minus");

    plus.onclick = () => {
      quantity.textContent = Number(quantity.textContent || 0) + 1;
      updateTotal();
    };

    minus.onclick = () => {
      const current = Number(quantity.textContent || 0);
      if (current <= 0) return;

      quantity.textContent = current - 1;
      updateTotal();
    };
  });

  document.querySelectorAll(".claim-free").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();

      if (button.disabled) return;

      const gender = button.closest(".free-ticket")?.dataset.ticketGender;

      window.location.href =
        `/free-ticket-info.html?partyId=${encodeURIComponent(eventId)}&type=${encodeURIComponent(gender)}`;
    };
  });

  if (checkoutButton) {
    checkoutButton.onclick = () => {
      const selectedTickets = [];

      document.querySelectorAll(".paid-ticket").forEach((card) => {
        const quantity = Number(card.querySelector(".quantity")?.textContent || 0);

        if (quantity > 0) {
          selectedTickets.push({
            ticketType: card.dataset.ticketType,
            quantity,
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
  }
}

async function loadCheckout() {
  if (!eventId) {
    if (container) {
      container.innerHTML = `
        <div class="state-card">
          <h3>Missing event</h3>
          <p>Open checkout from an event page so we know which tickets to show.</p>
        </div>
      `;
    }

    return;
  }

try {
  await ensureSignedIn();

  const docRef = doc(db, "parties", eventId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      if (container) {
        container.innerHTML = `
          <div class="state-card">
            <h3>Event not found</h3>
            <p>This event could not be loaded.</p>
          </div>
        `;
      }

      return;
    }

    const event = docSnap.data();

    hydrateEventHeader(event);

    activePhase = getActivePhase(event.ticketPhases || []);

    await trackCheckoutStart();

    const rows = getTicketRows(event);

    if (ticketCount) {
      ticketCount.textContent = rows.length
        ? `${rows.length} option${rows.length > 1 ? "s" : ""}`
        : "";
    }

    if (!rows.length) {
      if (container) {
        container.innerHTML = `<p class="empty-state">No tickets are available yet.</p>`;
      }

      updateTotal();
      return;
    }

    if (container) {
      container.innerHTML = rows
        .map((row, index) =>
          row.kind === "free" ? renderFreeRow(row) : renderPaidRow(row, index)
        )
        .join("");
    }

    attachTicketHandlers();
    updateTotal();
  } catch (error) {
    console.error("Checkout load failed:", error);

    if (container) {
      container.innerHTML = `
        <div class="state-card">
          <h3>Could not load checkout</h3>
          <p>Please refresh and try again.</p>
        </div>
      `;
    }
  }
}

loadCheckout();