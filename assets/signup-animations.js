// signup-animations.js
// Lightweight animations for the Backstage signup flow

document.addEventListener("DOMContentLoaded", () => {
  const card = document.querySelector(".card");
  const badge = document.querySelector(".badge");
  const title = document.querySelector("h1");
  const subtitle = document.querySelector(".sub");
  const progressFill = document.getElementById("progressFill");
  const nextBtn = document.getElementById("nextBtn");
  const backBtn = document.getElementById("backBtn");
  const inputs = document.querySelectorAll("input, select");
  const steps = document.querySelectorAll(".step");

  // Page entrance
  animateIn(badge, 0);
  animateIn(title, 80);
  animateIn(subtitle, 140);
  animateIn(card, 220);

  // Soft card tilt on desktop
  if (card && window.matchMedia("(hover: hover)").matches) {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rotateX = ((y / rect.height) - 0.5) * -3;
      const rotateY = ((x / rect.width) - 0.5) * 3;

      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    });
  }

  // Button press animation
  [nextBtn, backBtn].forEach((btn) => {
    if (!btn) return;

    btn.addEventListener("mousedown", () => {
      btn.style.transform = "scale(0.97)";
    });

    btn.addEventListener("mouseup", () => {
      btn.style.transform = "scale(1)";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
    });
  });

  // Input focus glow
  inputs.forEach((input) => {
    input.addEventListener("focus", () => {
      input.style.transform = "translateY(-1px)";
    });

    input.addEventListener("blur", () => {
      input.style.transform = "translateY(0)";
    });
  });

  // Watch step changes and animate active step
  const observer = new MutationObserver(() => {
    const activeStep = document.querySelector(".step.active");

    if (activeStep) {
      activeStep.animate(
        [
          {
            opacity: 0,
            transform: "translateY(10px)"
          },
          {
            opacity: 1,
            transform: "translateY(0)"
          }
        ],
        {
          duration: 220,
          easing: "ease-out"
        }
      );
    }

    if (progressFill) {
      progressFill.animate(
        [
          {
            filter: "brightness(1.4)"
          },
          {
            filter: "brightness(1)"
          }
        ],
        {
          duration: 280,
          easing: "ease-out"
        }
      );
    }
  });

  steps.forEach((step) => {
    observer.observe(step, {
      attributes: true,
      attributeFilter: ["class"]
    });
  });

  // Tiny success pulse on final step button
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      nextBtn.animate(
        [
          {
            boxShadow: "0 0 0 rgba(156, 79, 242, 0)"
          },
          {
            boxShadow: "0 0 24px rgba(156, 79, 242, 0.45)"
          },
          {
            boxShadow: "0 0 0 rgba(156, 79, 242, 0)"
          }
        ],
        {
          duration: 380,
          easing: "ease-out"
        }
      );
    });
  }

  function animateIn(element, delay) {
    if (!element) return;

    element.style.opacity = "0";
    element.style.transform = "translateY(12px)";

    setTimeout(() => {
      element.style.transition = "opacity 320ms ease, transform 320ms ease";
      element.style.opacity = "1";
      element.style.transform = "translateY(0)";
    }, delay);
  }
});