import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"

import {
  getFirestore,
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

const emailInput = document.getElementById("emailInput")
const passwordInput = document.getElementById("passwordInput")
const loginButton = document.getElementById("loginButton")
const errorText = document.getElementById("errorText")

async function checkAdminAndRedirect(user) {
  if (!user) return

  const adminRef = doc(db, "admins", user.uid)
  const adminSnap = await getDoc(adminRef)

  if (adminSnap.exists() && adminSnap.data().isAdmin === true) {
    window.location.href = "users.html"
  } else {
    errorText.textContent = "This account is not authorized."
    await auth.signOut()
  }
}

loginButton.addEventListener("click", async () => {
  errorText.textContent = ""

  const email = emailInput.value.trim()
  const password = passwordInput.value.trim()

  if (!email || !password) {
    errorText.textContent = "Enter your email and password."
    return
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await checkAdminAndRedirect(result.user)
  } catch (error) {
    errorText.textContent = "Invalid login."
  }
})

onAuthStateChanged(auth, async (user) => {
  if (user) {
    await checkAdminAndRedirect(user)
  }
})