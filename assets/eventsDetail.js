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

  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;

  let timeString = "";

  if (minutes === 0) {
    timeString = `${hours} ${ampm}`;
  } else {
    const paddedMinutes = minutes.toString().padStart(2, "0");
    timeString = `${hours}:${paddedMinutes} ${ampm}`;
  }

  return `${month} ${day}${ordinal}, ${year} at ${timeString}`;
}

function getDayText(date) {
  if (!date) return "--";

  return date.toLocaleDateString("en-US", {
    day: "numeric"
  });
}

function getMonthText(date) {
  if (!date) return "---";

  return date.toLocaleDateString("en-US", {
    month: "short"
  });
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

function resolveLocation(event) {
  return (
    event.locationName ||
    event.venueName ||
    event.location ||
    event.address ||
    "Location TBA"
  );
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

function resolveImageUrl(event) {
  return (
    event.mediaUrl ||
    event.imageUrl ||
    event.eventImageUrl ||
    event.photoUrl ||
    ""
  );
}

function renderLoading() {
  el.innerHTML = `
    <div class="detail-shell">
      <div class="guestlist">
        <h3>Loading event...</h3>
      </div>
    </div>
  `;
}

function renderError(title, message) {
  el.innerHTML = `
    <div class="detail-shell">
      <div class="guestlist">
        <h3>${escapeHTML(title)}</h3>
        <p style="margin:0;color:rgba(255,255,255,0.68);font-weight:600;line-height:1.45;">
          ${escapeHTML(message)}
        </p>
      </div>
    </div>
  `;
}

function renderEvent(event) {
  const startDate = timestampToDate(event.startsAt);
  const formattedDate = formatPrettyDateTime(startDate);
  const dayText = getDayText(startDate);
  const monthText = getMonthText(startDate);

  const title = resolveTitle(event);
  const location = resolveLocation(event);
  const imageUrl = resolveImageUrl(event);

  el.innerHTML = `
    <div class="detail-shell">
      <div class="detail-container">
        ${
          imageUrl
            ? `<img src="${escapeHTML(imageUrl)}" class="detail-image" alt="${escapeHTML(title)}" />`
            : `<div class="detail-image detail-image-fallback"></div>`
        }

        <div class="detail-date-badge">
          <div class="detail-day">${escapeHTML(dayText)}</div>
          <div class="detail-month">${escapeHTML(monthText)}</div>
        </div>

        <div class="detail-card">
          <h1 class="event-title">${escapeHTML(title)}</h1>
          <p class="detail-date">${escapeHTML(formattedDate)}</p>
          <p class="detail-price">${escapeHTML(location)}</p>
        </div>
      </div>
    </div>
  `;

document.querySelector(".detail-container").addEventListener("click", async () => {
    await trackEventAnalytics("analytics.ticketClicks");
    window.location.href = `/checkout.html?id=${encodeURIComponent(eventId)}`;
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