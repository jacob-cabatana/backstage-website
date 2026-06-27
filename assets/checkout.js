import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

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
const auth = getAuth(app);

const params = new URLSearchParams(window.location.search);
const eventId =
  params.get("id") ||
  params.get("eventId") ||
  params.get("partyId");

const container = document.getElementById("checkout-event");
const checkoutRoot = document.getElementById("checkout-root");
const heroImage = document.getElementById("checkout-hero-image");
const imageFallback = document.getElementById("checkout-image-fallback");
const ticketCount = document.getElementById("ticket-count");
const bottomTotal = document.getElementById("bottom-total");
const bottomCaption = document.getElementById("bottom-caption");
const checkoutButton = document.getElementById("checkout-button");

let currentUser = null;
let activePhase = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  }
});

async function ensureSignedIn() {
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  currentUser = result.user;
  return result.user;
}

// ------------------------------------------------------------
// Pricing constants — keep matched with app/functions
// ------------------------------------------------------------

const STRIPE_PERCENT = 0.029;
const STRIPE_FLAT_CENTS = 30;

const TICKET_ORDER_BASE_FEE_CENTS = 49;
const TICKET_PER_TICKET_FEE_CENTS = 50;
const TICKET_MAIN_RATE = 0.15;
const TICKET_HIGH_RATE = 0.10;
const TICKET_MAIN_RATE_CAP_PER_TICKET_CENTS = 2000;

// ------------------------------------------------------------
// Basic helpers
// ------------------------------------------------------------

function readBool(value, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
  }

  return fallback;
}

function readInt(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }

  return fallback;
}

function readCents(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(Math.round(value), 0);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(Math.round(parsed), 0);
  }

  return null;
}

function dollarsToCents(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(Math.round(number * 100), 0) : 0;
}

function priceCentsFrom(object, centsKey, dollarsKey) {
  if (!object) return null;

  const cents = readCents(object[centsKey]);
  if (cents !== null) return cents;

  if (object[dollarsKey] !== undefined && object[dollarsKey] !== null) {
    return dollarsToCents(object[dollarsKey]);
  }

  return null;
}

function formatMoneyCents(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstValue(...values) {
  return values.find((value) => {
    if (value === undefined || value === null) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

function parseFirestoreDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  if (typeof value?._seconds === "number") {
    return new Date(value._seconds * 1000);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function formatClock(date) {
  if (!date) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeClockText(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  return text
    .replace(/\s+/g, " ")
    .replace(":00 ", " ")
    .replace("AM", "AM")
    .replace("PM", "PM");
}

function normalizeTicketGender(gender) {
  const normalized = String(gender || "").trim().toLowerCase();

  if (["male", "m", "man", "men"].includes(normalized)) return "male";
  if (["female", "f", "woman", "women"].includes(normalized)) return "female";

  return null;
}

// ------------------------------------------------------------
// All-in pricing
// ------------------------------------------------------------

function calculateTicketServiceFeeCents(subtotalCents, quantity) {
  const qty = Math.max(readInt(quantity, 1), 1);
  const subtotal = Math.max(readInt(subtotalCents, 0), 0);

  if (subtotal <= 0) return 0;

  const mainRateCapCents = qty * TICKET_MAIN_RATE_CAP_PER_TICKET_CENTS;
  const mainRateSubtotal = Math.min(subtotal, mainRateCapCents);
  const highRateSubtotal = Math.max(subtotal - mainRateCapCents, 0);

  const fee =
    TICKET_ORDER_BASE_FEE_CENTS +
    qty * TICKET_PER_TICKET_FEE_CENTS +
    mainRateSubtotal * TICKET_MAIN_RATE +
    highRateSubtotal * TICKET_HIGH_RATE;

  return Math.round(fee);
}

function calculateAllInFromSubtotalCents(subtotalCents, quantity) {
  const qty = Math.max(readInt(quantity, 0), 0);
  const subtotal = Math.max(readInt(subtotalCents, 0), 0);

  if (qty <= 0 || subtotal <= 0) {
    return {
      subtotalCents: 0,
      serviceFeeCents: 0,
      stripeFeeCents: 0,
      totalCents: 0,
      total: 0
    };
  }

  const serviceFeeCents = calculateTicketServiceFeeCents(subtotal, qty);
  const preliminaryCents = subtotal + serviceFeeCents;

  const totalCents = Math.ceil(
    (preliminaryCents + STRIPE_FLAT_CENTS) / (1 - STRIPE_PERCENT)
  );

  const stripeFeeCents = totalCents - preliminaryCents;

  return {
    subtotalCents: subtotal,
    serviceFeeCents,
    stripeFeeCents,
    totalCents,
    total: totalCents / 100
  };
}

function allInPerTicketCents(unitPriceCents) {
  if (unitPriceCents <= 0) return 0;

  return calculateAllInFromSubtotalCents(unitPriceCents, 1).totalCents;
}

// ------------------------------------------------------------
// Event header
// ------------------------------------------------------------

function formatEventDate(event) {
  const raw = firstValue(
    event.startDate,
    event.date,
    event.eventDate,
    event.startTime,
    event.startsAt,
    event.timestamp
  );

  const parsed = parseFirestoreDate(raw);
  if (!parsed) return "Date TBA";

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric"
  });
}

function formatEventLocation(event) {
  return firstValue(
    event.venueName,
    event.locationName,
    event.locationTitle,
    event.address,
    event.location,
    event.venue,
    "Venue TBA"
  );
}

function getEventImageURL(event) {
  return firstValue(
    event.mediaUrl,
    event.imageURL,
    event.imageUrl,
    event.eventImageUrl,
    event.photoUrl,
    event.photoURL,
    event.flyerURL,
    event.flyerUrl,
    ""
  );
}

function hydrateEventHeader(event) {
  const title = firstValue(event.title, event.name, "Backstage tickets");
  const imageURL = getEventImageURL(event);

  const titleEl =
    document.getElementById("event-title") ||
    document.getElementById("hero-title");

  const dateEl =
    document.getElementById("event-date") ||
    document.getElementById("hero-date");

  const locationEl =
    document.getElementById("event-location") ||
    document.getElementById("hero-location");

  const heroEl = document.getElementById("checkout-hero");

  if (titleEl) titleEl.textContent = title;
  if (dateEl) dateEl.textContent = formatEventDate(event);
  if (locationEl) locationEl.textContent = formatEventLocation(event);

  document.title = `${title} | Backstage`;

  if (imageURL && heroImage) {
    heroImage.onload = () => {
      heroImage.hidden = false;
      heroImage.style.display = "block";

      if (imageFallback) {
        imageFallback.hidden = true;
        imageFallback.style.display = "none";
      }
    };

    heroImage.onerror = () => {
      console.error("Checkout image failed:", imageURL);
    };

    heroImage.src = imageURL;

    if (heroEl) {
      heroEl.classList.remove("is-empty");
    }
  }

  const accent = firstValue(event.accentColor, event.eventAccentColor, event.themeColor);

  if (accent && checkoutRoot) {
    checkoutRoot.style.setProperty("--event-accent-color", accent);
  }
}

async function trackCheckoutStart() {
  if (!eventId) return;

  try {
    await updateDoc(doc(db, "parties", eventId), {
      "analytics.checkoutStarts": increment(1),
      "analytics.lastUpdatedAt": serverTimestamp()
    });
  } catch (error) {
    console.error("Checkout analytics failed:", error);
  }
}

// ------------------------------------------------------------
// Legacy phase fallback
// ------------------------------------------------------------

function getSortedPhases(ticketPhases = []) {
  return [...ticketPhases].sort((a, b) => {
    const aDate = parseFirestoreDate(a.expiresAt) || new Date("9999-12-31");
    const bDate = parseFirestoreDate(b.expiresAt) || new Date("9999-12-31");
    return aDate - bDate;
  });
}

function getActivePhase(ticketPhases = []) {
  const now = new Date();
  const sorted = getSortedPhases(ticketPhases);

  const active = sorted.find((phase) => {
    const expiresAt = parseFirestoreDate(phase.expiresAt);
    return expiresAt && now < expiresAt;
  });

  return active || sorted[sorted.length - 1] || null;
}

function getPhaseCountdown(phase) {
  if (!phase) return "";

  const expiresAt = parseFirestoreDate(phase.expiresAt);
  if (!expiresAt) return "";

  const seconds = Math.floor((expiresAt - new Date()) / 1000);
  if (seconds <= 0) return "";

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `Price increases in ${days} day${days > 1 ? "s" : ""}`;
  if (hours > 0) return `Price increases in ${hours} hour${hours > 1 ? "s" : ""}`;
  return `Price increases in ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

// ------------------------------------------------------------
// New ticket type logic — mirrors app model
// ------------------------------------------------------------

function rawTicketTitle(ticket) {
  return String(
    ticket?.displayTitle ||
    ticket?.name ||
    ticket?.title ||
    "Ticket"
  );
}

function normalizedTicketTitle(ticket) {
  const kind = String(ticket?.kind || ticket?.id || "").toLowerCase();
  const entryWindow = ticket?.entryWindow || {};
  const entryWindowType = String(
    entryWindow?.type || ticket?.entryWindowType || "anytime"
  ).toLowerCase();

  const rawValidBeforeText =
    ticket?.validBeforeText ||
    entryWindow?.cutoffTimeText ||
    "";

  const validBeforeText = normalizeClockText(rawValidBeforeText);
  const rawTitle = rawTicketTitle(ticket);

  switch (kind) {
    case "before_time_general_admission":
      return validBeforeText ? `Before ${validBeforeText}` : "Before Time";

    case "bckstge_access":
      return "General Admission";

    case "beyond_the_stage":
      return "BCKSTGE Access";

    case "single_general_admission":
      return "General Admission";

    case "gender_pricing":
      return "General Admission";

    default:
      if (rawTitle === "BCKSTGE ACCESS") return "General Admission";
      if (rawTitle === "BEYOND THE STAGE" || rawTitle === "Beyond the Stage") return "BCKSTGE Access";

      if (rawTitle === "BCKSTGE General Admission") {
        if (entryWindowType === "before" && validBeforeText) {
          return `Before ${validBeforeText}`;
        }

        return "General Admission";
      }

      return rawTitle;
  }
}

function sortByTicketOrder(a, b) {
  const aOrder = readInt(a?.sortOrder, 0);
  const bOrder = readInt(b?.sortOrder, 0);

  if (aOrder === bOrder) {
    return normalizedTicketTitle(a).localeCompare(normalizedTicketTitle(b));
  }

  return aOrder - bOrder;
}

function sortByVolumeOrder(a, b) {
  const aOrder = readInt(a?.sortOrder, 0);
  const bOrder = readInt(b?.sortOrder, 0);

  if (aOrder === bOrder) {
    return String(a?.label || "").localeCompare(String(b?.label || ""));
  }

  return aOrder - bOrder;
}

function isBeforeTimeTicket(ticket) {
  const kind = String(ticket?.kind || ticket?.id || "").toLowerCase();
  const entryWindow = ticket?.entryWindow || {};
  const entryWindowType = String(
    entryWindow?.type || ticket?.entryWindowType || "anytime"
  ).toLowerCase();

  return entryWindowType === "before" || kind === "before_time_general_admission";
}

function ticketLastValidDate(ticket) {
  const entryWindow = ticket?.entryWindow || {};

  return (
    parseFirestoreDate(ticket?.validUntilGraceAt) ||
    parseFirestoreDate(entryWindow?.validUntilGraceAt) ||
    parseFirestoreDate(ticket?.validBefore) ||
    parseFirestoreDate(entryWindow?.cutoffAt) ||
    null
  );
}

function ticketValidUntilText(ticket) {
  const explicitText =
    normalizeClockText(ticket?.validUntilGraceText) ||
    normalizeClockText(ticket?.entryWindow?.validUntilGraceText) ||
    normalizeClockText(ticket?.validBeforeText) ||
    normalizeClockText(ticket?.entryWindow?.cutoffTimeText);

  if (explicitText) return explicitText;

  const date = ticketLastValidDate(ticket);
  return date ? formatClock(date) : "";
}

function volumeIsRemaining(volume) {
  const quantityTotal = readInt(volume?.quantityTotal ?? volume?.quantity, 0);

  return (
    readBool(volume?.quantityIsRemaining, false) ||
    (readBool(volume?.isFinalVolume, false) && quantityTotal <= 0)
  );
}

function volumeAvailableCount(volume, ticketSoldCount) {
  if (volumeIsRemaining(volume)) return null;

  const startsAfterTicketsSold = readInt(volume?.startsAfterTicketsSold, 0);
  const quantityTotal = readInt(volume?.quantityTotal ?? volume?.quantity, 0);
  const endsAfterTicketsSold = readInt(volume?.endsAfterTicketsSold, 0);

  const end = endsAfterTicketsSold > 0
    ? endsAfterTicketsSold
    : startsAfterTicketsSold + quantityTotal;

  return Math.max(end - ticketSoldCount, 0);
}

function volumeSoldOut(volume, ticketSoldCount) {
  if (volumeIsRemaining(volume)) return false;

  const startsAfterTicketsSold = readInt(volume?.startsAfterTicketsSold, 0);
  const quantityTotal = readInt(volume?.quantityTotal ?? volume?.quantity, 0);
  const endsAfterTicketsSold = readInt(volume?.endsAfterTicketsSold, 0);

  const end = endsAfterTicketsSold > 0
    ? endsAfterTicketsSold
    : startsAfterTicketsSold + quantityTotal;

  return end > 0 && ticketSoldCount >= end;
}

function ticketUsesVolumePricing(ticket) {
  const volumes = Array.isArray(ticket?.volumes) ? ticket.volumes : [];

  return (
    volumes.length > 0 &&
    (
      readBool(ticket?.priceWavesEnabled, false) ||
      readBool(ticket?.volumePricingEnabled, false)
    )
  );
}

function activeVolumeForTicket(ticket) {
  if (!ticketUsesVolumePricing(ticket)) return null;

  const ticketSoldCount = readInt(ticket?.quantitySold, 0);
  const volumes = [...(Array.isArray(ticket?.volumes) ? ticket.volumes : [])]
    .sort(sortByVolumeOrder);

  for (const volume of volumes) {
    if (volumeIsRemaining(volume)) return volume;

    const startsAfterTicketsSold = readInt(volume?.startsAfterTicketsSold, 0);
    const quantityTotal = readInt(volume?.quantityTotal ?? volume?.quantity, 0);
    const endsAfterTicketsSold = readInt(volume?.endsAfterTicketsSold, 0);

    const end = endsAfterTicketsSold > 0
      ? endsAfterTicketsSold
      : startsAfterTicketsSold + quantityTotal;

    if (ticketSoldCount >= startsAfterTicketsSold && ticketSoldCount < end) {
      return volume;
    }
  }

  return null;
}

function soldOutVolumesForTicket(ticket) {
  if (!ticketUsesVolumePricing(ticket)) return [];

  const ticketSoldCount = readInt(ticket?.quantitySold, 0);

  return [...(Array.isArray(ticket?.volumes) ? ticket.volumes : [])]
    .sort(sortByVolumeOrder)
    .filter((volume) => volumeSoldOut(volume, ticketSoldCount));
}

function ticketAvailableCount(ticket, activeVolume = null) {
  if (ticketUsesVolumePricing(ticket)) {
    if (!activeVolume) return 0;
    return volumeAvailableCount(activeVolume, readInt(ticket?.quantitySold, 0));
  }

  const quantityLimitEnabled = readBool(ticket?.quantityLimitEnabled, false);
  const unlimitedQuantity = readBool(ticket?.unlimitedQuantity, true);

  if (quantityLimitEnabled && !unlimitedQuantity) {
    const total = readInt(ticket?.quantityTotal, 0);
    const sold = readInt(ticket?.quantitySold, 0);
    return Math.max(total - sold, 0);
  }

  return null;
}

function ticketBasePriceCents(ticket, volume = null) {
  return (
    priceCentsFrom(volume, "priceCents", "price") ??
    readCents(ticket?.currentPriceCents) ??
    priceCentsFrom(ticket, "priceCents", "price") ??
    0
  );
}

function ticketGenderPriceCents(ticket, volume, normalizedGender) {
  if (normalizedGender === "male") {
    return (
      readCents(volume?.malePriceCents) ??
      readCents(ticket?.malePriceCents) ??
      ticketBasePriceCents(ticket, volume)
    );
  }

  if (normalizedGender === "female") {
    return (
      readCents(volume?.femalePriceCents) ??
      readCents(ticket?.femalePriceCents) ??
      ticketBasePriceCents(ticket, volume)
    );
  }

  return null;
}

function isTicketAvailable(ticket, activeVolume) {
  const status = String(ticket?.status || "active").toLowerCase();
  if (status !== "active") return false;

  if (isBeforeTimeTicket(ticket)) {
    const lastValid = ticketLastValidDate(ticket);
    if (lastValid && new Date() > lastValid) return false;
  }

  if (ticketUsesVolumePricing(ticket) && !activeVolume) return false;

  const available = ticketAvailableCount(ticket, activeVolume);
  if (available !== null && available <= 0) return false;

  return true;
}

function availabilityTextForRow(row) {
  const parts = [];

  if (row.volumeLabel) {
    parts.push(row.volumeLabel);
  }

  if (row.isBeforeTime && row.validUntilText) {
    parts.push(`Valid until ${row.validUntilText}`);
  }

  if (row.availableCount !== null && row.availableCount !== undefined) {
    if (row.availableCount <= 5) {
      parts.push(`Only ${row.availableCount} left at this price`);
    } else {
      parts.push(`${row.availableCount} left`);
    }
  }

  return parts.join(" • ");
}

function buildNewTicketRows(event) {
  const ticketTypes = Array.isArray(event.ticketTypes) ? event.ticketTypes : [];
  if (!ticketTypes.length) return [];

  const rows = [];
  const sortedTickets = [...ticketTypes].sort(sortByTicketOrder);

  for (const ticket of sortedTickets) {
    const activeVolume = activeVolumeForTicket(ticket);

    if (!isTicketAvailable(ticket, activeVolume)) continue;

    const ticketAvailable = ticketAvailableCount(ticket, activeVolume);
    const maxQuantity = Math.max(Math.min(10, ticketAvailable ?? 10), 0);

    if (maxQuantity <= 0) continue;

    const kind = String(ticket.kind || ticket.id || "ticket");
    const ticketTypeId = String(ticket.id || "");
    const title = normalizedTicketTitle(ticket);
    const genderPricesEnabled = readBool(ticket.genderPricesEnabled, false);
    const volumeLabel = activeVolume ? String(activeVolume.label || "") : "";
    const isBeforeTime = isBeforeTimeTicket(ticket);
    const validUntilText = isBeforeTime ? ticketValidUntilText(ticket) : "";

    const common = {
      kind: "paid",
      pricingSource: "ticketTypes",
      ticketTypeId,
      ticketTypeKind: kind,
      ticketVolumeId: activeVolume ? String(activeVolume.id || "") : "",
      ticketVolumeLabel: volumeLabel,
      volumeLabel,
      isBeforeTime,
      validUntilText,
      availableCount: ticketAvailable,
      maxQuantity,
      isPopular: kind === "bckstge_access",
      rawTitle: rawTicketTitle(ticket)
    };

    if (genderPricesEnabled) {
      const femalePriceCents = ticketGenderPriceCents(ticket, activeVolume, "female");
      const malePriceCents = ticketGenderPriceCents(ticket, activeVolume, "male");

      if (femalePriceCents !== null) {
        rows.push({
          ...common,
          name: title,
          audienceLabel: "Women price",
          pillLabel: "Women",
          ticketGender: "female",
          unitPriceCents: femalePriceCents
        });
      }

      if (malePriceCents !== null) {
        rows.push({
          ...common,
          name: title,
          audienceLabel: "Men price",
          pillLabel: "Men",
          ticketGender: "male",
          unitPriceCents: malePriceCents
        });
      }
    } else {
      rows.push({
        ...common,
        name: title,
        audienceLabel: "All guests",
        pillLabel: common.isPopular ? "Most Popular" : (volumeLabel || "Ticket"),
        ticketGender: "",
        unitPriceCents: ticketBasePriceCents(ticket, activeVolume)
      });
    }

    for (const soldVolume of soldOutVolumesForTicket(ticket)) {
      const soldVolumeLabel = String(soldVolume.label || "Previous volume");

      if (genderPricesEnabled) {
        const femaleSoldOutPriceCents = ticketGenderPriceCents(ticket, soldVolume, "female");
        const maleSoldOutPriceCents = ticketGenderPriceCents(ticket, soldVolume, "male");

        if (femaleSoldOutPriceCents !== null) {
          rows.push({
            kind: "sold_out_volume",
            name: title,
            audienceLabel: "Women price",
            pillLabel: "Sold",
            ticketGender: "female",
            ticketTypeId,
            ticketTypeKind: kind,
            ticketVolumeId: String(soldVolume.id || ""),
            ticketVolumeLabel: soldVolumeLabel,
            volumeLabel: soldVolumeLabel,
            unitPriceCents: femaleSoldOutPriceCents
          });
        }

        if (maleSoldOutPriceCents !== null) {
          rows.push({
            kind: "sold_out_volume",
            name: title,
            audienceLabel: "Men price",
            pillLabel: "Sold",
            ticketGender: "male",
            ticketTypeId,
            ticketTypeKind: kind,
            ticketVolumeId: String(soldVolume.id || ""),
            ticketVolumeLabel: soldVolumeLabel,
            volumeLabel: soldVolumeLabel,
            unitPriceCents: maleSoldOutPriceCents
          });
        }
      } else {
        rows.push({
          kind: "sold_out_volume",
          name: title,
          audienceLabel: "Previous price",
          pillLabel: "Sold",
          ticketGender: "",
          ticketTypeId,
          ticketTypeKind: kind,
          ticketVolumeId: String(soldVolume.id || ""),
          ticketVolumeLabel: soldVolumeLabel,
          volumeLabel: soldVolumeLabel,
          unitPriceCents: ticketBasePriceCents(ticket, soldVolume)
        });
      }
    }
  }

  // Since the web checkout does not know the buyer's gender, only auto-select a
  // non-gendered ticket. Gendered rows stay at 0 until the buyer picks Men/Women.
  const paidRows = rows.filter((row) => row.kind === "paid");
  const preferred =
    paidRows.find((row) => row.ticketTypeKind === "bckstge_access" && !row.ticketGender) ||
    paidRows.find((row) => !row.ticketGender);

  if (preferred) {
    preferred.defaultSelected = true;
  }

  return rows;
}

// ------------------------------------------------------------
// Ticket rows
// ------------------------------------------------------------

function buildLegacyFreeRows(event) {
  const rows = [];

  if (event.freeTicketsEnabled !== true) return rows;

  const femaleTotal = Number(event.freeFemaleTotal || 0);
  const femaleClaimed = Number(event.freeFemaleClaimed || 0);
  const femaleRemaining = Math.max(0, femaleTotal - femaleClaimed);

  const maleTotal = Number(event.freeMaleTotal || 0);
  const maleClaimed = Number(event.freeMaleClaimed || 0);
  const maleRemaining = Math.max(0, maleTotal - maleClaimed);

  if (femaleTotal > 0) {
    rows.push({
      kind: "free",
      gender: "women",
      name: "Free Female",
      priceLabel: "Free",
      availableLabel: femaleRemaining > 0 ? `${femaleRemaining} free left` : "Sold out",
      soldOut: femaleRemaining <= 0
    });
  }

  if (maleTotal > 0) {
    rows.push({
      kind: "free",
      gender: "men",
      name: "Free Male",
      priceLabel: "Free",
      availableLabel: maleRemaining > 0 ? `${maleRemaining} free left` : "Sold out",
      soldOut: maleRemaining <= 0
    });
  }

  return rows;
}

function buildLegacyPaidRows(event) {
  const rows = [];

  if (event.pricingMode === "phases" || event.genderTicketPricing === true) {
    let malePrice = Number(event.maleTicketPrice || event.priceMen || 0);
    let femalePrice = Number(event.femaleTicketPrice || event.priceWomen || 0);

    if (event.pricingMode === "phases" && event.ticketPhases?.length) {
      activePhase = getActivePhase(event.ticketPhases);

      if (activePhase?.malePrice !== undefined) {
        malePrice = Number(activePhase.malePrice);
      }

      if (activePhase?.femalePrice !== undefined) {
        femalePrice = Number(activePhase.femalePrice);
      }
    }

    if (femalePrice >= 0) {
      rows.push({
        kind: "paid",
        pricingSource: "legacy",
        ticketTypeId: "",
        ticketTypeKind: "women",
        ticketGender: "female",
        ticketVolumeId: "",
        ticketVolumeLabel: activePhase?.name || "",
        volumeLabel: activePhase?.name || "",
        name: "General Admission",
        audienceLabel: "Women price",
        pillLabel: "Women",
        unitPriceCents: dollarsToCents(femalePrice),
        phaseName: activePhase?.name || "General Admission",
        timer: getPhaseCountdown(activePhase),
        maxQuantity: 10
      });
    }

    if (malePrice >= 0) {
      rows.push({
        kind: "paid",
        pricingSource: "legacy",
        ticketTypeId: "",
        ticketTypeKind: "men",
        ticketGender: "male",
        ticketVolumeId: "",
        ticketVolumeLabel: activePhase?.name || "",
        volumeLabel: activePhase?.name || "",
        name: "General Admission",
        audienceLabel: "Men price",
        pillLabel: "Men",
        unitPriceCents: dollarsToCents(malePrice),
        phaseName: activePhase?.name || "General Admission",
        timer: getPhaseCountdown(activePhase),
        maxQuantity: 10
      });
    }
  } else {
    const generalPrice = Number(firstValue(
      event.admissionPrice,
      event.ticketPrice,
      event.price,
      0
    ));

if (generalPrice >= 0) {
      rows.push({
        kind: "paid",
        pricingSource: "legacy",
        ticketTypeId: "",
        ticketTypeKind: "general",
        ticketGender: "",
        ticketVolumeId: "",
        ticketVolumeLabel: "",
        name: "General Admission",
        audienceLabel: "All guests",
        pillLabel: "GA",
        unitPriceCents: dollarsToCents(generalPrice),
        phaseName: "General Admission",
        timer: "",
        maxQuantity: 10,
        defaultSelected: true
      });
    }
  }

  return rows;
}

function getTicketRows(event) {
  const freeRows = buildLegacyFreeRows(event);
  const newRows = buildNewTicketRows(event);

  const rows = newRows.some((row) => row.kind === "paid")
    ? [...freeRows, ...newRows]
    : [...freeRows, ...buildLegacyPaidRows(event)];

  // Hide sold-out tickets for a cleaner, minimalist list.
  return rows.filter(
    (row) => row.kind !== "sold_out_volume" && !(row.kind === "free" && row.soldOut)
  );
}

function groupKeyForRow(row) {
  const normalized = normalizeTicketGender(row?.ticketGender || row?.gender || "");

  if (normalized === "female") return "women";
  if (normalized === "male") return "men";

  return "everyone";
}

function groupMetaForKey(key) {
  if (key === "women") {
    return {
      title: "Women",
      helper: "",
      empty: "No Women tickets are available."
    };
  }

  if (key === "men") {
    return {
      title: "Men",
      helper: "",
      empty: "No Men tickets are available."
    };
  }

  return {
    title: "All Tickets",
    helper: "",
    empty: "No other tickets are available."
  };
}

function paidRowSubtitle(row) {
  if (row.isBeforeTime && row.validUntilText) {
    return `Entry before ${row.validUntilText}`;
  }

  const kind = String(row.ticketTypeKind || "").toLowerCase();
  const title = String(row.name || "").toLowerCase();

  if (kind.includes("beyond") || title.includes("beyond")) return "VIP Experience";
  if (kind.includes("access") || title.includes("access")) return "Anytime Entry";

  return "Anytime Entry";
}

function availabilityTextWithoutVolume(row) {
  const parts = [];

  if (row.isBeforeTime && row.validUntilText) {
    parts.push(`Valid until ${row.validUntilText}`);
  }

  if (row.availableCount !== null && row.availableCount !== undefined) {
    if (row.availableCount <= 5) {
      parts.push(`Only ${row.availableCount} left at this price`);
    } else {
      parts.push(`${row.availableCount} left`);
    }
  }

  return parts.join(" • ") || row.timer || "All-in pricing";
}

function rowVolumeLabel(row) {
  return String(row.ticketVolumeLabel || row.volumeLabel || row.phaseName || "").trim();
}

function renderTicketGroups(rows) {
  const groups = {
    women: [],
    men: [],
    everyone: []
  };

  for (const row of rows) {
    groups[groupKeyForRow(row)].push(row);
  }

  const groupOrder = ["women", "men", "everyone"];

  return groupOrder
    .filter((key) => groups[key].length > 0)
    .map((key) => {
      const meta = groupMetaForKey(key);
      const groupRows = groups[key];
      const count = groupRows.filter((row) => row.kind === "paid" || row.kind === "free").length;

      return `
        <section class="ticket-gender-group" data-ticket-group="${escapeHTML(key)}">
          <div class="gender-header">
            <h3 class="gender-title">${escapeHTML(meta.title)}</h3>
            ${meta.helper ? `<p class="gender-helper">${escapeHTML(meta.helper)}</p>` : ""}
          </div>

          <div class="gender-options">
            ${groupRows
              .map((row, index) => {
                if (row.kind === "free") return renderFreeRow(row);
                if (row.kind === "sold_out_volume") return renderSoldOutVolumeRow(row);
                return renderPaidRow(row, index);
              })
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderFreeRow(row) {
  const normalizedGender = normalizeTicketGender(row.gender);
  const genderLabel = normalizedGender === "female" ? "Women" : normalizedGender === "male" ? "Men" : "Guest";
  const disabled = row.soldOut ? "disabled" : "";

  return `
    <article class="ticket-row free-ticket ${row.soldOut ? "is-sold-out" : ""}" data-ticket-gender="${escapeHTML(row.gender || normalizedGender || "")}">
      <div class="ticket-card-top">
        <div class="ticket-copy">
          <div class="ticket-name-line">
            <h3 class="ticket-name">Free Entry</h3>
          </div>
          <p class="ticket-subtitle">${escapeHTML(genderLabel)} ticket</p>
          <p class="ticket-subtext">${escapeHTML(row.availableLabel)}</p>
        </div>

        <div class="ticket-price-label">Free</div>
      </div>

      <div class="ticket-badges">
        <span class="ticket-badge gender">${escapeHTML(genderLabel)} price</span>
      </div>

      <button class="free-claim-button claim-free" type="button" ${disabled}>
        ${row.soldOut ? "Sold out" : "Claim free ticket"}
      </button>
    </article>
  `;
}

function renderSoldOutVolumeRow(row) {
  const priceText = row.unitPriceCents > 0
    ? formatMoneyCents(allInPerTicketCents(row.unitPriceCents))
    : "Free";
  const volumeLabel = rowVolumeLabel(row);
  const normalizedGender = normalizeTicketGender(row.ticketGender) || "";

  return `
    <article class="ticket-row is-sold-out" data-ticket-gender="${escapeHTML(normalizedGender)}">
      <div class="ticket-card-top">
        <div class="ticket-copy">
          <div class="ticket-name-line">
            <h3 class="ticket-name">${escapeHTML(row.name)}</h3>
            ${volumeLabel ? `<span class="ticket-volume-badge">${escapeHTML(volumeLabel)}</span>` : ""}
          </div>
          <p class="ticket-subtitle">Sold out</p>
          <p class="ticket-subtext">Previous price${row.audienceLabel ? ` • ${escapeHTML(row.audienceLabel)}` : ""}</p>
        </div>

        <div class="ticket-price-label">${escapeHTML(priceText)}</div>
      </div>
    </article>
  `;
}

function renderPaidRow(row, index) {
  const allInPriceCents = allInPerTicketCents(row.unitPriceCents);
  const priceText = row.unitPriceCents <= 0 ? "Free" : formatMoneyCents(allInPriceCents);
  const initialQuantity = row.defaultSelected ? 1 : 0;
  const volumeLabel = rowVolumeLabel(row);
  const normalizedGender = normalizeTicketGender(row.ticketGender) || "";

  return `
    <article class="ticket-row paid-ticket ${row.defaultSelected ? "is-selected" : ""}"
      data-pricing-source="${escapeHTML(row.pricingSource || "legacy")}"
      data-ticket-type-id="${escapeHTML(row.ticketTypeId || "")}"
      data-ticket-type-kind="${escapeHTML(row.ticketTypeKind || "general")}"
      data-ticket-type="${escapeHTML(row.ticketTypeKind || "general")}"
      data-ticket-title="${escapeHTML(row.name || "Ticket")}"
      data-ticket-gender="${escapeHTML(normalizedGender)}"
      data-ticket-volume-id="${escapeHTML(row.ticketVolumeId || "")}"
      data-ticket-volume-label="${escapeHTML(row.ticketVolumeLabel || "")}"
      data-unit-price-cents="${Number(row.unitPriceCents || 0)}"
      data-price="${Number(row.unitPriceCents || 0) / 100}"
      data-phase-name="${escapeHTML(row.phaseName || "")}"
      data-max-quantity="${Number(row.maxQuantity || 10)}">

      <div class="ticket-card-top">
        <div class="ticket-copy">
          <div class="ticket-name-line">
            <h3 class="ticket-name">${escapeHTML(row.name)}</h3>
            ${volumeLabel ? `<span class="ticket-volume-badge">${escapeHTML(volumeLabel)}</span>` : ""}
          </div>

          <p class="ticket-subtitle">${escapeHTML(paidRowSubtitle(row))}</p>
          <p class="ticket-subtext">${escapeHTML(availabilityTextWithoutVolume(row))}</p>
        </div>

        <div class="ticket-price-label">${escapeHTML(priceText)}${row.unitPriceCents <= 0 ? "" : "<small>ea</small>"}</div>
      </div>

      <div class="ticket-badges">
        ${row.isPopular ? `<span class="ticket-badge popular">🔥 Most Popular</span>` : ""}
        ${row.audienceLabel ? `<span class="ticket-badge gender">${escapeHTML(row.audienceLabel)}</span>` : ""}
      </div>

      <div class="qty-control" aria-label="Quantity for ${escapeHTML(row.name)}">
        <button class="qty-button minus" type="button" ${initialQuantity <= 0 ? "disabled" : ""} aria-label="Decrease quantity">−</button>
        <span class="quantity-wrap">
          <span class="quantity" data-row-index="${index}">${initialQuantity}</span>
          <span class="quantity-label">ticket</span>
        </span>
        <button class="qty-button plus" type="button" aria-label="Increase quantity">+</button>
      </div>
    </article>
  `;
}

// ------------------------------------------------------------
// Selection behavior
// ------------------------------------------------------------

function selectedPaidCards() {
  return [...document.querySelectorAll(".paid-ticket")].filter((card) => {
    const quantity = Number(card.querySelector(".quantity")?.textContent || 0);
    return quantity > 0;
  });
}

function updateTotal() {
  let subtotalCents = 0;
  let count = 0;

  document.querySelectorAll(".paid-ticket").forEach((card) => {
    const unitPriceCents = readInt(card.dataset.unitPriceCents, 0);
    const maxQuantity = Math.max(readInt(card.dataset.maxQuantity, 10), 0);
    const quantityEl = card.querySelector(".quantity");
    const plus = card.querySelector(".plus");
    const minus = card.querySelector(".minus");

    let quantity = readInt(quantityEl?.textContent, 0);
    quantity = Math.max(Math.min(quantity, maxQuantity), 0);

    if (quantityEl) {
      quantityEl.textContent = String(quantity);
    }

    card.classList.toggle("is-selected", quantity > 0);

    if (minus) {
      minus.disabled = quantity <= 0;
    }

    if (plus) {
      plus.disabled = maxQuantity <= 0 || quantity >= maxQuantity;
    }

    if (quantity > 0) {
      subtotalCents += unitPriceCents * quantity;
      count += quantity;
    }
  });

  const totalCents = count > 0
    ? calculateAllInFromSubtotalCents(subtotalCents, count).totalCents
    : 0;

  if (bottomTotal) {
    bottomTotal.textContent =
      count > 0 && totalCents === 0
        ? "Free"
        : formatMoneyCents(totalCents);
  }

  if (bottomCaption) {
    bottomCaption.textContent =
      count > 0
        ? `${count} ticket${count > 1 ? "s" : ""} selected`
        : "Select tickets";
  }

  if (checkoutButton) {
    checkoutButton.disabled = count === 0;
  }
}

function resetOtherTicketRows(activeCard) {
  document.querySelectorAll(".paid-ticket").forEach((card) => {
    if (card === activeCard) return;

    const quantity = card.querySelector(".quantity");
    if (quantity) quantity.textContent = "0";
  });
}

function attachTicketHandlers() {
  document.querySelectorAll(".paid-ticket").forEach((card) => {
    const quantity = card.querySelector(".quantity");
    const plus = card.querySelector(".plus");
    const minus = card.querySelector(".minus");

    if (plus) {
      plus.onclick = () => {
        const current = readInt(quantity?.textContent, 0);
        const maxQuantity = Math.max(readInt(card.dataset.maxQuantity, 10), 0);

        if (current <= 0) {
          resetOtherTicketRows(card);
        }

        if (quantity) {
          quantity.textContent = String(Math.min(current + 1, maxQuantity));
        }

        updateTotal();
      };
    }

    if (minus) {
      minus.onclick = () => {
        const current = readInt(quantity?.textContent, 0);
        if (current <= 0) return;

        if (quantity) {
          quantity.textContent = String(Math.max(current - 1, 0));
        }

        updateTotal();
      };
    }
  });

  document.querySelectorAll(".claim-free").forEach((button) => {
    button.onclick = (event) => {
      event.preventDefault();

      if (button.disabled) return;

      const gender = button.closest(".free-ticket")?.dataset.ticketGender;

      window.location.href =
        `/free-ticket-info.html?partyId=${encodeURIComponent(eventId)}&type=${encodeURIComponent(gender)}`;
    };
  });

  if (checkoutButton) {
    checkoutButton.onclick = () => {
      const selectedCards = selectedPaidCards();

      if (selectedCards.length === 0) {
        alert("Select at least one ticket.");
        return;
      }

      if (selectedCards.length > 1) {
        alert("Please select one ticket type at a time.");
        return;
      }

      const card = selectedCards[0];
      const quantity = Number(card.querySelector(".quantity")?.textContent || 0);

      const selectedTickets = [
        {
          ticketTypeId: card.dataset.ticketTypeId || null,
          ticketType: card.dataset.ticketTypeKind || card.dataset.ticketType || "general",
          ticketTypeKind: card.dataset.ticketTypeKind || card.dataset.ticketType || "general",
          ticketTitle: card.dataset.ticketTitle || "Ticket",
          ticketGender: normalizeTicketGender(card.dataset.ticketGender) || null,
          ticketVolumeId: card.dataset.ticketVolumeId || null,
          ticketVolumeLabel: card.dataset.ticketVolumeLabel || null,
          quantity,

          // For the next page display only. Server recalculates price.
          unitPriceCents: readInt(card.dataset.unitPriceCents, 0),
          unitPrice: readInt(card.dataset.unitPriceCents, 0) / 100,

          pricingSource: card.dataset.pricingSource || "legacy",
          phaseName: card.dataset.phaseName || null
        }
      ];

      sessionStorage.setItem("checkout_tickets", JSON.stringify(selectedTickets));
      sessionStorage.setItem("checkout_event_id", eventId);

      if (activePhase) {
        sessionStorage.setItem(
          "checkout_phase",
          JSON.stringify({
            name: activePhase.name,
            expiresAt: parseFirestoreDate(activePhase.expiresAt)?.toISOString()
          })
        );
      } else {
        sessionStorage.removeItem("checkout_phase");
      }

      window.location.href = "/checkout-info.html";
    };
  }
}

// ------------------------------------------------------------
// Load
// ------------------------------------------------------------

async function loadCheckout() {
  if (!eventId) {
    if (container) {
      container.innerHTML = `
        <div class="state-card">
          <h3>Missing event</h3>
          <p>Open checkout from an event page so we know which tickets to show.</p>
        </div>
      `;
    }

    return;
  }

  try {
    await ensureSignedIn();

    const docRef = doc(db, "parties", eventId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      if (container) {
        container.innerHTML = `
          <div class="state-card">
            <h3>Event not found</h3>
            <p>This event could not be loaded.</p>
          </div>
        `;
      }

      return;
    }

    const event = docSnap.data();

    hydrateEventHeader(event);

    activePhase = getActivePhase(event.ticketPhases || []);

    await trackCheckoutStart();

    const rows = getTicketRows(event);
    const selectableRows = rows.filter((row) => row.kind === "paid" || row.kind === "free");

    if (ticketCount) {
      ticketCount.textContent = selectableRows.length
        ? `${selectableRows.length} option${selectableRows.length > 1 ? "s" : ""}`
        : "";
    }

    if (!rows.length) {
      if (container) {
        container.innerHTML = `<p class="empty-state">No tickets are available yet.</p>`;
      }

      updateTotal();
      return;
    }

    if (container) {
      container.innerHTML = renderTicketGroups(rows);
    }

    attachTicketHandlers();
    updateTotal();
  } catch (error) {
    console.error("Checkout load failed:", error);

    if (container) {
      container.innerHTML = `
        <div class="state-card">
          <h3>Could not load checkout</h3>
          <p>Please refresh and try again.</p>
        </div>
      `;
    }
  }
}

loadCheckout();