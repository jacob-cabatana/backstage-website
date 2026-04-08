import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

async function loadEventDetail() {

  const el = document.getElementById("event-detail");
  el.innerHTML = "<p>Loading event...</p>";

  if (!eventId) {
    el.innerHTML = "<p>Missing event id.</p>";
    return;
  }

  const eventDoc = await getDoc(doc(db, "parties", eventId));

  if (!eventDoc.exists()) {
    el.innerHTML = "<p>Event not found.</p>";
    return;
  }

  const event = eventDoc.data();

  const startDate = event.startsAt?.seconds
    ? new Date(event.startsAt.seconds * 1000)
    : null;

function getOrdinal(day) {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatPrettyDateTime(date) {
  const day = date.getDate();
  const ordinal = getOrdinal(day);

  const month = date.toLocaleDateString("en-US", { month: "long" });
  const year = date.getFullYear();

  // Time formatting
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

const formattedDate = startDate
  ? formatPrettyDateTime(startDate)
  : "Date TBA";

  const imageUrl = event.mediaUrl
    ? event.mediaUrl
    : "https://via.placeholder.com/800x400";

  el.innerHTML = `
    <div class="detail-container">

      <img src="${imageUrl}" class="detail-image"/>

      <div class="detail-card">
        <p class="detail-date">${formattedDate}</p>
        <p class="detail-price">Tickets Available</p>
        <button class="ticket-button" id="get-tickets-btn">
          Get Tickets
        </button>
      </div>

    </div>
  `;

  document.getElementById("get-tickets-btn").onclick = () => {

    const deepLink = `backstage://party/${eventId}`;
    const webCheckout = `/checkout.html?id=${eventId}`;
    
    let fallbackTriggered = false;

    const timer = setTimeout(() => {
      fallbackTriggered = true;
      window.location.href = webCheckout;
    }, 1200);

    try {
      window.location.href = deepLink;
    } catch {
      if (!fallbackTriggered) {
        clearTimeout(timer);
        window.location.href = webCheckout;
      }
    }

  };

}

loadEventDetail();