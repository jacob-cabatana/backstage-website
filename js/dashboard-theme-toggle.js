document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "backstageDashboardTheme";
  const toggle = document.getElementById("themeToggle");

  if (!toggle) {
    console.warn("Theme toggle button not found.");
    return;
  }

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return "light";
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";

    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);

    toggle.setAttribute("aria-checked", String(isDark));
    toggle.classList.toggle("is-on", isDark);

    localStorage.setItem(STORAGE_KEY, theme);
  }

  applyTheme(getPreferredTheme());

  toggle.addEventListener("click", () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";

    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  });

  toggle.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle.click();
  });
});