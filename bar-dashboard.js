/* ============================================================
   BCKSTGE — animations.js
   Scroll reveals, staggered grids, nav state, count-up,
   table cascades, magnetic buttons, and FAQ smoothing.
   Drop in with: <script src="animations.js" defer></script>
   (You can delete the inline reveal <script> in index.html —
    this file supersedes it and degrades gracefully.)
   ============================================================ */

(() => {
  "use strict";

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ----------------------------------------------------------
     0. Inject the extra CSS this script needs.
        Keeps everything self-contained in one JS file so the
        HTML/CSS you already have doesn't need editing.
  ---------------------------------------------------------- */
  const css = `
    /* nav gains a stronger shadow once you scroll */
    .nav { transition: box-shadow .3s ease, background .3s ease; }
    .nav.is-scrolled {
      box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 8px 30px rgba(0,0,0,.06);
      background: rgba(255,255,255,0.94);
    }

    /* staggered children inside a revealed block */
    [data-stagger] > * {
      opacity: 0;
      transform: translateY(20px);
      transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1);
    }
    [data-stagger].visible > * { opacity: 1; transform: none; }

    /* fee-table rows cascade in */
    .fee-table tbody tr {
      opacity: 0;
      transform: translateY(12px);
      transition: opacity .5s ease, transform .5s cubic-bezier(.16,1,.3,1);
    }
    .fee-table-wrap.rows-in tbody tr { opacity: 1; transform: none; }

    /* hero gets a slightly richer entrance */
    .hero [data-reveal] { transition-duration: .9s; }

    /* magnetic buttons need a transform base + smoothing */
    .btn-primary { will-change: transform; }

    /* zero number subtle pop when counting */
    .zero-number { transition: transform .4s cubic-bezier(.16,1,.3,1); }
    .zero-number.counting { transform: scale(1.015); }

    /* smooth height animation for FAQ bodies */
    .faq-item .faq-body {
      overflow: hidden;
    }

    @media (prefers-reduced-motion: reduce) {
      [data-stagger] > *,
      .fee-table tbody tr { opacity: 1 !important; transform: none !important; }
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  /* If the user prefers reduced motion, make everything visible
     and bail out of all the JS-driven motion. */
  if (reduceMotion) {
    document.querySelectorAll("[data-reveal]").forEach((el) =>
      el.classList.add("visible")
    );
    return;
  }

  /* Run after DOM is ready (defer makes this near-instant). */
  const ready = (fn) =>
    document.readyState === "loading"
      ? document.addEventListener("DOMContentLoaded", fn)
      : fn();

  ready(init);

  function init() {
    setupReveals();
    setupStagger();
    setupNavScroll();
    setupZeroCount();
    setupFeeTable();
    setupMagneticButtons();
    setupFaqSmooth();
    setupSongRows();
  }

  /* ----------------------------------------------------------
     1. Core scroll reveals — your [data-reveal] elements.
  ---------------------------------------------------------- */
  function setupReveals() {
    const els = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------
     2. Staggered children. Auto-applies to the feature grids,
        split lists, and song list so items flow in one-by-one.
  ---------------------------------------------------------- */
  function setupStagger() {
    // Tag the containers we want staggered, then set per-child delays.
    const containers = [
      ...document.querySelectorAll(".feature-grid"),
      ...document.querySelectorAll(".split-list"),
      ...document.querySelectorAll(".song-list"),
    ];

    containers.forEach((c) => {
      c.setAttribute("data-stagger", "");
      const kids = c.children;
      for (let i = 0; i < kids.length; i++) {
        kids[i].style.transitionDelay = `${i * 90}ms`;
      }
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    containers.forEach((c) => io.observe(c));
  }

  /* ----------------------------------------------------------
     3. Nav shadow / background shift on scroll.
  ---------------------------------------------------------- */
  function setupNavScroll() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    let ticking = false;
    const update = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  }

  /* ----------------------------------------------------------
     4. Count-up for the big "0%". Animates 0 → target the
        first time it scrolls into view. (Target is 0 here, so
        it reads as a confident snap; logic supports any number
        if you change the markup later.)
  ---------------------------------------------------------- */
  function setupZeroCount() {
    const el = document.querySelector(".zero-number");
    if (!el) return;

    const unit = el.querySelector(".zero-unit");
    const unitHTML = unit ? unit.outerHTML : "";
    const target = parseInt(el.textContent.replace(/\D/g, ""), 10) || 0;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(el);
          animateCount(el, target, unitHTML);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
  }

  function animateCount(el, target, unitHTML) {
    el.classList.add("counting");
    const start = target > 30 ? Math.round(target * 0.4) : 0;
    const duration = 900;
    const t0 = performance.now();

    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = Math.round(start + (target - start) * eased);
      el.innerHTML = val + unitHTML;
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        el.innerHTML = target + unitHTML;
        setTimeout(() => el.classList.remove("counting"), 250);
      }
    };
    requestAnimationFrame(tick);
  }

  /* ----------------------------------------------------------
     5. Fee table — cascade the body rows in when it appears.
  ---------------------------------------------------------- */
  function setupFeeTable() {
    const wrap = document.querySelector(".fee-table-wrap");
    if (!wrap) return;

    const rows = wrap.querySelectorAll("tbody tr");
    rows.forEach((r, i) => (r.style.transitionDelay = `${i * 120}ms`));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          wrap.classList.add("rows-in");
          io.unobserve(wrap);
        });
      },
      { threshold: 0.25 }
    );
    io.observe(wrap);
  }

  /* ----------------------------------------------------------
     6. Magnetic primary buttons — subtle pull toward cursor.
  ---------------------------------------------------------- */
  function setupMagneticButtons() {
    if (window.matchMedia("(hover: none)").matches) return; // skip touch
    const btns = document.querySelectorAll(".btn-primary");
    const strength = 0.25;

    btns.forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * strength}px, ${
          y * strength
        }px) scale(1.03)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* ----------------------------------------------------------
     7. FAQ — animate the open/close height of <details>.
        Native <details> snaps; this gives it a smooth slide
        while keeping the accessible markup intact.
  ---------------------------------------------------------- */
  function setupFaqSmooth() {
    const items = document.querySelectorAll(".faq-item");

    items.forEach((item) => {
      const summary = item.querySelector("summary");
      const body = item.querySelector(".faq-body");
      if (!summary || !body) return;

      summary.addEventListener("click", (e) => {
        e.preventDefault();

        if (item.open) {
          // collapse
          const start = body.scrollHeight;
          body.style.height = start + "px";
          requestAnimationFrame(() => {
            body.style.transition = "height .28s ease, opacity .2s ease";
            body.style.opacity = "0";
            body.style.height = "0px";
          });
          body.addEventListener(
            "transitionend",
            () => {
              item.open = false;
              body.style.cssText = "overflow:hidden";
            },
            { once: true }
          );
        } else {
          // expand
          item.open = true;
          const end = body.scrollHeight;
          body.style.cssText = "overflow:hidden; height:0; opacity:0";
          requestAnimationFrame(() => {
            body.style.transition = "height .3s ease, opacity .3s ease";
            body.style.height = end + "px";
            body.style.opacity = "1";
          });
          body.addEventListener(
            "transitionend",
            () => {
              body.style.cssText = "overflow:hidden; height:auto";
            },
            { once: true }
          );
        }
      });
    });
  }

  /* ----------------------------------------------------------
     8. Song rows — gentle lift + badge pulse on hover, and a
        light "live request" pulse to suggest real-time signal.
  ---------------------------------------------------------- */
  function setupSongRows() {
    const rows = document.querySelectorAll(".song-row");
    rows.forEach((row) => {
      row.style.transition =
        "background .2s ease, transform .2s cubic-bezier(.16,1,.3,1)";
      row.addEventListener("mouseenter", () => {
        row.style.transform = "translateX(4px)";
        row.style.background = "rgba(0,113,227,0.04)";
      });
      row.addEventListener("mouseleave", () => {
        row.style.transform = "";
        row.style.background = "";
      });
    });

    // one-time badge pulse shortly after the list reveals
    const badges = document.querySelectorAll(".song-badge");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          io.unobserve(entry.target);
          entry.target.animate(
            [
              { transform: "scale(1)" },
              { transform: "scale(1.12)" },
              { transform: "scale(1)" },
            ],
            { duration: 600, easing: "ease-in-out", delay: 400 }
          );
        });
      },
      { threshold: 0.8 }
    );
    badges.forEach((b) => io.observe(b));
  }
})();