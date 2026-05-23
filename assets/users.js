import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"

import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"

const firebaseConfig = {
  apiKey: "AIzaSyAOftoMjETRbr3v7zncb-kVvLewkpmE2n0",
  authDomain: "backstageapp-27cb3.firebaseapp.com",
  projectId: "backstageapp-27cb3",
  storageBucket: "backstageapp-27cb3.firebasestorage.app",
  messagingSenderId: "148403387572",
  appId: "1:148403387572:web:98e9369e385a8449046be1",
  measurementId: "G-PQMTKCL1RC"
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const usersList = document.getElementById("usersList")
const totalUsersEl = document.getElementById("totalUsers")
const newTodayEl = document.getElementById("newToday")
const totalUsersCard = document.getElementById("totalUsersCard")
const newTodayCard = document.getElementById("newTodayCard")

let currentFilter = "all"
let cachedUsers = []
let unsubscribeUsersListener = null

totalUsersCard.addEventListener("click", () => {
  currentFilter = "all"
  updateActiveStatCard()
  renderUsers(cachedUsers)
})

newTodayCard.addEventListener("click", () => {
  currentFilter = "today"
  updateActiveStatCard()
  renderUsers(cachedUsers)
})

function updateActiveStatCard() {
  totalUsersCard.classList.toggle("active", currentFilter === "all")
  newTodayCard.classList.toggle("active", currentFilter === "today")
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "admin-login.html"
    return
  }

  try {
    const adminRef = doc(db, "admins", user.uid)
    const adminSnap = await getDoc(adminRef)

    if (!adminSnap.exists() || adminSnap.data().isAdmin !== true) {
      await signOut(auth)
      window.location.href = "admin-login.html"
      return
    }

    startUsersListener()
  } catch (error) {
    console.error("Admin check failed:", error)
    await signOut(auth)
    window.location.href = "admin-login.html"
  }
})

function startUsersListener() {
  if (unsubscribeUsersListener) {
    unsubscribeUsersListener()
  }

  const usersQuery = query(collection(db, "users"))

  unsubscribeUsersListener = onSnapshot(usersQuery, (snapshot) => {
    const allUsers = []

    snapshot.forEach((userDoc) => {
      allUsers.push({
        id: userDoc.id,
        data: userDoc.data()
      })
    })

    cachedUsers = allUsers

    updateStats(allUsers)
    updateActiveStatCard()
    renderUsers(allUsers)
  }, (error) => {
    console.error("Users listener failed:", error)
    usersList.innerHTML = `
      <div class="user-card">
        <div class="user-name">Could not load users</div>
        <div class="user-email">${escapeHTML(error.message || "Permission denied or missing index")}</div>
      </div>
    `
  })
}

function updateStats(allUsers) {
  const today = getStartOfToday()

  const newTodayCount = allUsers.filter((item) => {
    const createdAtDate = item.data.createdAt?.toDate
      ? item.data.createdAt.toDate()
      : null

    return createdAtDate && createdAtDate >= today
  }).length

  totalUsersEl.textContent = allUsers.length
  newTodayEl.textContent = newTodayCount
}

function renderUsers(allUsers) {
  usersList.innerHTML = ""

  const today = getStartOfToday()

  let usersToRender = allUsers

  if (currentFilter === "today") {
    usersToRender = allUsers.filter((item) => {
      const createdAtDate = item.data.createdAt?.toDate
        ? item.data.createdAt.toDate()
        : null

      return createdAtDate && createdAtDate >= today
    })
  }

  if (usersToRender.length === 0) {
    usersList.innerHTML = `
      <div class="user-card">
        <div class="user-name">No users found</div>
        <div class="user-email">Nothing matches this filter.</div>
      </div>
    `
    return
  }

  const completedUsers = usersToRender.filter(item => hasRealProfile(item.data))
  const incompleteUsers = usersToRender.filter(item => !hasRealProfile(item.data))

  const maleUsers = completedUsers.filter(item =>
    String(item.data.gender || "").toLowerCase() === "male"
  )

  const femaleUsers = completedUsers.filter(item =>
    String(item.data.gender || "").toLowerCase() === "female"
  )

  const otherUsers = completedUsers.filter(item => {
    const gender = String(item.data.gender || "").toLowerCase()
    return gender !== "male" && gender !== "female"
  })

  sortUsersAlphabetically(maleUsers)
  sortUsersAlphabetically(femaleUsers)
  sortUsersAlphabetically(otherUsers)
  sortUsersAlphabetically(incompleteUsers)

  renderUserSection("Male Profiles", maleUsers)
  renderUserSection("Female Profiles", femaleUsers)
  renderUserSection("Other Profiles", otherUsers)
  renderUserSection("Incomplete / Anonymous Users", incompleteUsers)
}

function renderUserSection(title, users) {
  if (users.length === 0) return

  const section = document.createElement("section")
  section.className = "user-section"

  const header = document.createElement("div")
  header.className = "user-section-header"
  header.innerHTML = `
    <h2>${escapeHTML(title)}</h2>
    <span>${users.length}</span>
  `

  const grid = document.createElement("div")
  grid.className = "user-section-grid"

  users.forEach((item) => {
    const userDocId = item.id
    const user = item.data

    const createdAtDate = user.createdAt?.toDate
      ? user.createdAt.toDate()
      : null

    const updatedAtDate = user.updatedAt?.toDate
      ? user.updatedAt.toDate()
      : null

    const lastActiveAtDate = user.lastActiveAt?.toDate
      ? user.lastActiveAt.toDate()
      : null

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim()

const location = user.lastKnownLocation || user.signupLocation || null

const locationText = location
  ? `${location.city || ""}${location.region ? ", " + location.region : ""}${location.country ? ", " + location.country : ""}`
  : "None"

const latitude = location?.latitude ?? location?.lat
const longitude = location?.longitude ?? location?.lng

const coordinatesText = latitude && longitude
  ? `${latitude}, ${longitude}`
  : "None"

    const card = document.createElement("div")
    card.className = "user-card"

    card.innerHTML = `
      <div class="user-top">
        <div class="user-main">
          ${
            user.profileImageURL
              ? `<img class="user-avatar" src="${escapeHTML(user.profileImageURL)}" alt="Profile image" onerror="this.style.display='none'">`
              : `<div class="user-avatar-placeholder">${getInitials(user.firstName, user.lastName)}</div>`
          }

          <div>
            <div class="user-name">${escapeHTML(fullName || "Anonymous User")}</div>
            <div class="user-email">${escapeHTML(user.email || "Guest account")}</div>
          </div>
        </div>

        <div class="user-date">
          ${createdAtDate ? createdAtDate.toLocaleDateString() : "No date"}
        </div>
      </div>

      <div class="user-meta">
        <div><strong>UID:</strong> ${escapeHTML(userDocId)}</div>
        <div><strong>Gender:</strong> ${escapeHTML(user.gender || "None")}</div>
        <div><strong>Instagram:</strong> ${user.instagramHandle ? "@" + escapeHTML(user.instagramHandle) : "None"}</div>
        <div><strong>University:</strong> ${escapeHTML(user.universityName || "None")}</div>
        <div><strong>Verified:</strong> ${user.universityVerified ? "Yes" : "No"}</div>
        <div><strong>Phone:</strong> ${user.phoneLinked ? "Linked" : "Not linked"}</div>
        <div><strong>Last 4:</strong> ${escapeHTML(user.phoneNumberLast4 || "None")}</div>
        <div><strong>Location:</strong> ${escapeHTML(locationText)}</div>
        <div><strong>Coords:</strong> ${escapeHTML(coordinatesText)}</div>
        <div><strong>Created:</strong> ${createdAtDate ? createdAtDate.toLocaleString() : "None"}</div>
        <div><strong>Active:</strong> ${lastActiveAtDate ? lastActiveAtDate.toLocaleString() : "None"}</div>
        <div><strong>Updated:</strong> ${updatedAtDate ? updatedAtDate.toLocaleString() : "None"}</div>
      </div>
    `

    grid.appendChild(card)
  })

  section.appendChild(header)
  section.appendChild(grid)
  usersList.appendChild(section)
}

function sortUsersAlphabetically(users) {
  users.sort((a, b) => {
    const nameA = getSortableName(a.data)
    const nameB = getSortableName(b.data)
    return nameA.localeCompare(nameB)
  })
}

function getSortableName(user) {
  const firstName = user.firstName || ""
  const lastName = user.lastName || ""
  const email = user.email || ""
  return `${firstName} ${lastName} ${email}`.trim().toLowerCase()
}

function hasRealProfile(user) {
  const firstName = String(user.firstName || "").trim()
  const lastName = String(user.lastName || "").trim()
  const email = String(user.email || "").trim()
  const photo = String(user.profileImageURL || "").trim()
  const instagram = String(user.instagramHandle || "").trim()

  return Boolean(firstName || lastName || email || photo || instagram)
}

function getStartOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function getInitials(firstName, lastName) {
  const first = firstName ? firstName.charAt(0).toUpperCase() : ""
  const last = lastName ? lastName.charAt(0).toUpperCase() : ""
  return `${first}${last}` || "?"
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}