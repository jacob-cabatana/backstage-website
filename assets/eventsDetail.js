import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
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

  if (!eventId) {
    el.innerHTML = "<p>Missing event id.</p>";
    return;
  }

  // Load event
  const eventDoc = await getDoc(doc(db, "parties", eventId));

  if (!eventDoc.exists()) {
    el.innerHTML = "<p>Event not found.</p>";
    return;
  }

  const event = eventDoc.data();

  const startDate = event.startsAt?.seconds
    ? new Date(event.startsAt.seconds * 1000)
    : null;

  const formattedDate = startDate
    ? startDate.toLocaleString()
    : "Date TBA";

  const imageUrl = event.mediaUrl
    ? event.mediaUrl
    : "https://via.placeholder.com/800x400";

  // ----------------------------
  // MATCH iOS LOGIC
  // ----------------------------

  const ticketsQuery = query(
    collection(db, "tickets"),
    where("partyId", "==", eventId)
  );

  const ticketsSnap = await getDocs(ticketsQuery);

const ticketCounts = {};
const userIds = new Set();
const ticketInfo = {};

ticketsSnap.forEach(doc => {

  const data = doc.data();

  const uid = data.userId || data.buyerLinkedUid;

  if (!uid) return;

  ticketCounts[uid] = (ticketCounts[uid] || 0) + 1;
  userIds.add(uid);

  ticketInfo[uid] = data;

});

  let guestsHTML = "";

  for (const uid of userIds) {

const userDoc = await getDoc(doc(db, "users", uid));
const user = userDoc.data() || {};
const ticket = ticketInfo[uid] || {};

const displayName =
  `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
  `${ticket.buyerFirstName || ""} ${ticket.buyerLastName || ""}`.trim() ||
  "Guest";

const photo =
  ticket.photoURL ||
  user.photoURL ||
  user.profileImageURL ||
  user.userProfilePicture ||
  "/assets/avatar-placeholder.png";

    const ticketCount = ticketCounts[uid] || 1;

    guestsHTML += `
      <div class="guest-row">
        <img src="${photo}" class="guest-avatar"/>
        <span class="guest-name">${displayName}</span>
        ${ticketCount > 1 ? `<span class="guest-count">x${ticketCount}</span>` : ""}
      </div>
    `;
  }

  if (!guestsHTML) {
    guestsHTML = "<p>No guests yet</p>";
  }

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

      <div class="guestlist">
        <h3>Guest List</h3>
        ${guestsHTML}
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