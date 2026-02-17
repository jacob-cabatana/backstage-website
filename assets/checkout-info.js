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

button.onclick = async () => {
  if (button.disabled || button.classList.contains("loading")) return;

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