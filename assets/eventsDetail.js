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

  try {
    if (!el) {
      document.body.innerHTML = "<p>Missing #event-detail container</p>";
      return;
    }

    el.innerHTML = "<p>Loading…</p>";

    if (!eventId) {
      el.innerHTML = "<p>Missing event id in URL.</p>";
      return;
    }

    const docRef = doc(db, "parties", eventId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      el.innerHTML = "<p>Event not found.</p>";
      return;
    }

    const event = docSnap.data();

    const startDate = event.startsAt?.seconds
      ? new Date(event.startsAt.seconds * 1000)
      : null;

    const imageUrl = event.mediaUrl
      ? event.mediaUrl
      : "https://via.placeholder.com/800x400?text=Backstage+Event";

const admissionPrice = "Tickets Available";

    el.innerHTML = `
      <div class="detail-container">
        <img src="${imageUrl}" class="detail-image" />
        <div class="detail-card">
          <p class="detail-date">${startDate ? startDate.toLocaleString() : "Date TBA"}</p>
          <p class="detail-price">${admissionPrice}</p>
          <button class="ticket-button" id="get-tickets-btn">Get Tickets</button>
        </div>
      </div>
    `;

document.getElementById("get-tickets-btn").onclick = () => {

const universalLink = `backstage://party/${eventId}`;
const webCheckout = `checkout.html?id=${eventId}`;

let didHide = false;

const visibilityHandler = () => {
  if (document.hidden) {
    didHide = true;
  }
};

document.addEventListener("visibilitychange", visibilityHandler);

window.location.href = universalLink;

setTimeout(() => {
  document.removeEventListener("visibilitychange", visibilityHandler);

  if (!didHide) {
    window.location.href = webCheckout;
  }
}, 1500);

};

  } catch (err) {
    console.error(err);
    if (el) el.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
  }
}
loadEventDetail();