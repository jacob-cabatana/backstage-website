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
  signInAnonymously
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

const pathParts = window.location.pathname
  .split("/")
  .filter(Boolean);

const pathEventId =
  pathParts[0] === "party" && pathParts[1]
    ? pathParts[1]
    : null;

const eventId =
  params.get("id") ||
  params.get("eventId") ||
  params.get("partyId") ||
  pathEventId;

console.log("Event analytics eventId:", eventId);

const el = document.getElementById("event-detail");

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timestampToDate(value) {
  if (!value) return null;

  if (value.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getOrdinal(day) {
  if (day > 3 && day < 21) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatPrettyDateTime(date) {
  if (!date) return "Date TBA";

  const day = date.getDate();
  const ordinal = getOrdinal(day);

  const month = date.toLocaleDateString("en-US", {
    month: "long"
  });

  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  let timeString = "";

  if (minutes === 0) {
    timeString = `${hours}:00 ${ampm}`;
  } else {
    const paddedMinutes = minutes.toString().padStart(2, "0");
    timeString = `${hours}:${paddedMinutes} ${ampm}`;
  }

  return `${month} ${day}${ordinal}, ${year} at ${timeString}`;
}

function resolveTitle(event) {
  return (
    event.title ||
    event.eventName ||
    event.name ||
    event.partyName ||
    "Untitled Event"
  );
}

function resolveHostImageUrl(event) {
  return (
    event.hostPhotoUrl ||
    event.hostPhotoURL ||
    event.hostProfileImage ||
    event.hostProfileImageUrl ||
    event.hostImageUrl ||
    event.hostAvatar ||
    ""
  );
}

function resolveLocation(event) {
  return (
    event.locationName ||
    event.venueName ||
    event.location ||
    event.address ||
    "Location TBA"
  );
}

function resolveDescription(event) {
  return (
    event.description ||
    event.eventDescription ||
    event.details ||
    event.about ||
    ""
  );
}

function resolveImageUrl(event) {
  return (
    event.imageURL ||
    event.imageUrl ||
    event.mediaUrl ||
    event.eventImageUrl ||
    event.photoUrl ||
    event.flyerURL ||
    event.flyerUrl ||
    ""
  );
}

function resolveHost(event) {
  return (
    event.hostName ||
    event.host ||
    event.organizerName ||
    event.presentedBy ||
    "Backstage"
  );
}

function resolveAgeRequirement(event) {
  if (event.ageRequirement) return event.ageRequirement;

  const goodToKnow = Array.isArray(event.goodToKnow) ? event.goodToKnow : [];

  if (goodToKnow.includes("21_plus")) return "This is a 21+ event";
  if (goodToKnow.includes("18_plus")) return "This is an 18+ event";

  return "This is a 21+ event";
}

function calculateAllIn(base) {
  const price = Number(base || 0);

  if (price <= 0) return 0;

  const stripePercent = 0.029;
  const stripeFlat = 0.30;
  const lowPriceThreshold = 7.00;
  const lowPriceFee = 2.99;
  const standardFee = 4.99;

  const appliedFee = price < lowPriceThreshold ? lowPriceFee : standardFee;
  const preliminary = price + appliedFee;
  const stripeFee = preliminary * stripePercent + stripeFlat;

  return preliminary + stripeFee;
}

function getActivePhase(ticketPhases = []) {
  const now = new Date();

  const sorted = [...ticketPhases].sort((a, b) => {
    const aDate = timestampToDate(a.expiresAt) || new Date("9999-12-31");
    const bDate = timestampToDate(b.expiresAt) || new Date("9999-12-31");

    return aDate - bDate;
  });

  return sorted.find((phase) => {
    const expiresAt = timestampToDate(phase.expiresAt);
    return expiresAt && now < expiresAt;
  }) || sorted[sorted.length - 1] || null;
}

function resolveStartingPrice(event) {
  if (event.freeTicketsEnabled === true) return "Free";

  let base = Number(event.admissionPrice || event.ticketPrice || event.price || 0);

  if (event.pricingMode === "phases" && event.ticketPhases?.length) {
    const active = getActivePhase(event.ticketPhases);
    const prices = [
      Number(active?.malePrice || 0),
      Number(active?.femalePrice || 0)
    ].filter((price) => price > 0);

    if (prices.length) {
      base = Math.min(...prices);
    }
  } else if (event.genderTicketPricing === true) {
    const prices = [
      Number(event.maleTicketPrice || 0),
      Number(event.femaleTicketPrice || 0)
    ].filter((price) => price > 0);

    if (prices.length) {
      base = Math.min(...prices);
    }
  }

  if (!base || base <= 0) return "Free";

  return `$${calculateAllIn(base).toFixed(2)}`;
}

async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;

  const result = await signInAnonymously(auth);
  return result.user;
}

async function trackEventAnalytics(field) {
  if (!eventId) return;

  try {
    await ensureSignedIn();

    await updateDoc(doc(db, "parties", eventId), {
      [field]: increment(1),
      "analytics.lastUpdatedAt": serverTimestamp()
    });

    console.log("Analytics tracked:", field, eventId);
  } catch (error) {
    console.error("Analytics update failed:", error);
  }
}

function renderLoading() {
  el.innerHTML = `
    <div class="state-card">
      <h3>Loading event...</h3>
      <p>Pulling up the details.</p>
    </div>
  `;
}

function renderError(title, message) {
  el.innerHTML = `
    <div class="state-card">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

function renderEvent(event) {
  const startDate = timestampToDate(event.startsAt);
  const formattedDate = formatPrettyDateTime(startDate);

  const title = resolveTitle(event);
  const location = resolveLocation(event);
  const description = resolveDescription(event);
  const imageUrl = resolveImageUrl(event);
  const host = resolveHost(event);
  const hostImageUrl = resolveHostImageUrl(event);
  const ageRequirement = resolveAgeRequirement(event);
  const priceLabel = resolveStartingPrice(event);

  document.title = `${title} | Backstage`;

  el.innerHTML = `
    <div class="detail-shell">
      <section class="detail-hero">
        ${
          imageUrl
            ? `
              <img
                src="${escapeHTML(imageUrl)}"
                class="detail-image"
                alt="${escapeHTML(title)}"
              />
            `
            : `<div class="detail-image-fallback" aria-label="${escapeHTML(title)}"></div>`
        }
      </section>

      <main class="detail-main">
        <h1 class="event-title">${escapeHTML(title)}</h1>

        <div class="event-host-row">
          ${
            hostImageUrl
              ? `
                <div class="host-avatar-ring">
                  <img
                    src="${escapeHTML(hostImageUrl)}"
                    class="host-avatar"
                    alt="${escapeHTML(host)}"
                  />
                </div>
              `
              : ``
          }

          <p class="event-host">${escapeHTML(host)}</p>
        </div>

        <p class="event-date-line">${escapeHTML(formattedDate)}</p>

        <div class="quick-info">
          <div class="info-line">
            <span class="info-icon-svg" aria-hidden="true">
              <svg viewBox="0 0 24 24" role="presentation">
                <path d="M12 22s7-6.2 7-13a7 7 0 1 0-14 0c0 6.8 7 13 7 13zm0-9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"></path>
              </svg>
            </span>

            <span>${escapeHTML(location)}</span>
          </div>
        </div>

        <div class="buy-panel">
          <div>
            <span class="price-value">${escapeHTML(priceLabel)}</span>
            <span class="price-caption">The price you'll pay. No surprises later.</span>
          </div>

          <button class="secure-ticket-button secure-ticket-action" type="button">
            Secure Now
          </button>
        </div>

        <section class="section">
          <h2 class="section-title">About</h2>

          ${
            description.trim()
              ? `<p class="event-description">${escapeHTML(description.trim())}</p>`
              : `<p class="empty-description">Event description coming soon.</p>`
          }

          <div class="details-list">
            <div class="details-list-row">
              <span>ⓘ</span>
              <span>${escapeHTML(ageRequirement)}</span>
            </div>

            <div class="details-list-row">
              <span>⌁</span>
              <span>Presented by ${escapeHTML(host)}</span>
            </div>
          </div>
        </section>
      </main>

      <div class="bottom-ticket-bar">
        <div>
          <span class="price-value">${escapeHTML(priceLabel)}</span>
          <span class="price-caption">No surprises later.</span>
        </div>

        <button class="secure-ticket-button secure-ticket-action" type="button">
          Secure Now
        </button>
      </div>
    </div>
  `;

  document.querySelectorAll(".secure-ticket-action").forEach((button) => {
    button.addEventListener("click", async () => {
      await trackEventAnalytics("analytics.ticketClicks");
      window.location.href = `/checkout.html?id=${encodeURIComponent(eventId)}`;
    });
  });
}

async function loadEventDetail() {
  renderLoading();

  if (!eventId) {
    renderError("Missing event id", "This event link is missing its event id.");
    return;
  }

  try {
    const eventDoc = await getDoc(doc(db, "parties", eventId));

    if (!eventDoc.exists()) {
      renderError("Event not found", "This event does not exist or is no longer available.");
      return;
    }

    await trackEventAnalytics("analytics.webViews");
    renderEvent(eventDoc.data());
  } catch (error) {
    console.error("Failed to load event:", error);
    renderError("Could not load event", "Something went wrong while loading this event.");
  }
}

loadEventDetail();