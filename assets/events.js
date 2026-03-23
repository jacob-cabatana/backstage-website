import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ===============================
   Firebase Config
   Replace with your real values
================================ */

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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

async function loadEvents() {
  try {
    const snapshot = await getDocs(collection(db, "parties"));

    const container = document.getElementById("events-container");
    container.innerHTML = "";

if (snapshot.empty) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-overlay"></div>
      <div class="empty-content">
<h2>No events near Jacksonville</h2>
<p>
Tonight’s giving “nahh not tonight” energy.<br>
Check back later.
</p>
      </div>
    </div>
  `;
  return;
}

    snapshot.forEach((doc) => {
      const event = doc.data();
      renderEventCard(event, doc.id);
    });
  } catch (error) {
    console.error("Error loading events:", error);
  }
}

function formatEventDate(date) {
  if (!date) return "";

  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" :
    "th";

  const month = date.toLocaleString("en-US", { month: "long" });

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });

  return `${month} ${day}${suffix} @ ${time}`;
}

function renderEventCard(event, id) {
  const container = document.getElementById("events-container");

  const startDate = event.startsAt?.seconds
    ? new Date(event.startsAt.seconds * 1000)
    : null;

  const imageUrl = event.mediaUrl
    ? event.mediaUrl
    : "https://via.placeholder.com/800x400?text=Backstage+Event";

  const card = document.createElement("div");
  card.className = "event-card";

  card.onclick = () => {
  window.location.href = `eventsDetail.html?id=${id}`;
};

  card.innerHTML = `
    <div class="event-image-wrap">
  <img src="${imageUrl}" class="event-image" />
</div>
    <div class="event-content">
      <h2>${event.title || "Untitled Event"}</h2>
      <p class="event-date">${startDate ? formatEventDate(startDate) : ""}</p>
     <p class="event-location">
  <span class="label">Address</span>
  <span class="value">${event.location || ""}</span>
</p>
    </div>
  `;

  container.appendChild(card);
}



loadEvents();