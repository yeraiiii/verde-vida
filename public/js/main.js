// Utilidades compartidas del frontend
window.API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function categoryLabel(cat, categories) {
  if (!categories) return "";
  const found = categories.find((c) => c.id === cat);
  return found ? found.name : "";
}

export function initHeader() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  const overlay = document.querySelector(".nav-overlay");
  if (!toggle || !nav) return;
  const close = () => {
    nav.classList.remove("open");
    overlay?.classList.remove("show");
  };
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
    overlay?.classList.toggle("show");
  });
  overlay?.addEventListener("click", close);
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
}

export function loadCategories() {
  return window.API.get("/api/categories");
}

export function showNotice(el, message, type = "success") {
  if (!el) return;
  el.textContent = message;
  el.className = `notice ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}
