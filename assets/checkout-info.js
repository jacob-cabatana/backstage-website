const tickets = JSON.parse(sessionStorage.getItem("checkout_tickets") || "[]");
const eventId = sessionStorage.getItem("checkout_event_id");

if (!tickets.length || !eventId) {
  window.location.href = "/";
}

const firstName = document.getElementById("first-name");
const lastName = document.getElementById("last-name");
const email = document.getElementById("email");
const button = document.getElementById("final-pay-button");
const promoDigits = document.querySelectorAll(".promo-digit");
const promoFeedback = document.getElementById("promo-feedback");
const applyButton = document.getElementById("apply-promo");
const applyText = applyButton.querySelector(".apply-text");
const applySuccess = applyButton.querySelector(".apply-success");




let promoIsValid = false;
let promoChecked = false;
let promoDiscountPercent = 0;
const discountRow = document.getElementById("discount-row");




promoDigits.forEach((input, index) => {
  input.addEventListener("input", (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    e.target.value = value;

    if (value && index < promoDigits.length - 1) {
      promoDigits[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !input.value && index > 0) {
      promoDigits[index - 1].focus();
    }
  });
});




function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validate() {
  const valid =
    firstName.value.trim().length > 0 &&
    lastName.value.trim().length > 0 &&
    isValidEmail(email.value.trim());

  button.disabled = !valid;

  if (!valid) {
    button.classList.remove("loading");
  }
}

firstName.addEventListener("input", validate);
lastName.addEventListener("input", validate);
email.addEventListener("input", validate);

async function verifyPromoIfNeeded() {
  const code = Array.from(promoDigits)
    .map(d => d.value.trim())
    .join("")
    .toUpperCase();

if (!code) {
  promoIsValid = false;
  promoChecked = false;
  promoDiscountPercent = 0;
  discountRow.style.display = "none";
  return true;
}


  if (code.length < 6) {
    promoFeedback.textContent = "Enter full promo code";
    promoFeedback.style.color = "#ff6b6b";
    return false;
  }

  try {
    const res = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/validatePromoCode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: code })
      }
    );

    const data = await res.json();

    promoChecked = true;
    promoIsValid = data.valid === true;

if (promoIsValid) {
  promoDiscountPercent = data.discountPercent || 0.05;
  discountRow.style.display = "block";
  promoFeedback.style.color = "#4cd964";
  return true;
}
 else {
      promoFeedback.textContent = "Invalid promo code";
      promoFeedback.style.color = "#ff6b6b";
      return false;
    }

  } catch (err) {
    promoFeedback.textContent = "Error validating code";
    promoFeedback.style.color = "#ff6b6b";
    return false;
  }
}


button.onclick = async () => {
  if (button.disabled || button.classList.contains("loading")) return;
  const promoOk = await verifyPromoIfNeeded();
if (!promoOk) return;


  button.classList.add("loading");
  button.disabled = true;

  const buyer = {
    firstName: firstName.value.trim(),
    lastName: lastName.value.trim(),
    email: email.value.trim()
  };

  try {
    const response = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/createWebCheckoutSession",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          tickets,
          buyer,
          promoCode: Array.from(promoDigits)
            .map(d => d.value.trim())
            .join("")
            .toUpperCase() || null
})

      }
    );

    const data = await response.json();

    if (data.url) {
      window.location.href = data.url;
      return;
    }

    throw new Error("No checkout URL returned");

  } catch (err) {
    console.error(err);
    alert("Error creating checkout session.");

    button.classList.remove("loading");
    validate();
  }
};

applyButton.addEventListener("click", async () => {
  const code = Array.from(promoDigits)
    .map(d => d.value.trim())
    .join("")
    .toUpperCase();

  if (!code || code.length < 6) {
    promoFeedback.textContent = "Enter full promo code";
    promoFeedback.style.color = "#ff6b6b";
    return;
  }

  applyButton.classList.add("loading");
  applyButton.disabled = true;
  promoFeedback.style.color = "rgba(255,255,255,0.6)";

  try {
    const res = await fetch(
      "https://us-central1-backstageapp-27cb3.cloudfunctions.net/validatePromoCode",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: code })
      }
    );

    const data = await res.json();

if (data.valid) {
  promoIsValid = true;
  promoDiscountPercent = data.discountPercent || 0.05;

  discountRow.style.display = "block";

  applyButton.classList.remove("loading");
  applyButton.classList.add("success");
  applyButton.disabled = true;

  setTimeout(() => {
    applyButton.classList.remove("success");
    applyButton.disabled = false;
  }, 2000);

  return;
}

 else {
      promoFeedback.textContent = "Invalid promo code";
      promoFeedback.style.color = "#ff6b6b";
      promoIsValid = false;
      promoDiscountPercent = 0;
      discountRow.style.display = "none";

    }

  } catch (err) {
    promoFeedback.textContent = "Error validating code";
    promoFeedback.style.color = "#ff6b6b";
  }

  applyButton.classList.remove("loading");
  applyButton.disabled = false;
});

