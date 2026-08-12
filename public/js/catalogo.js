// Página de catálogo
const state = {
  categories: [],
  activeCategory: null,
  search: "",
};

function renderCategories() {
  const grid = document.getElementById("categorias");
  const params = new URLSearchParams(window.location.search);
  const active = params.get("categoria");

  const allBtn = `
    <button class="cat-chip ${!active ? "active" : ""}" data-cat="">
      Todos
    </button>`;

  grid.innerHTML = allBtn + state.categories.map((cat) => `
    <button class="cat-chip ${String(active) === String(cat.id) ? "active" : ""}" data-cat="${cat.id}">
      ${cat.name} <span class="chip-count">${cat.product_count}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".cat-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = new URL(window.location.href);
      if (btn.dataset.cat) url.searchParams.set("categoria", btn.dataset.cat);
      else url.searchParams.delete("categoria");
      window.location.href = url.toString();
    });
  });
}

function renderProducts(products) {
  const grid = document.getElementById("product-grid");
  const count = document.getElementById("results-count");

  if (!products.length) {
    grid.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>No se encontraron productos con esos criterios.</p></div>`;
    count.textContent = "0 resultados";
    return;
  }

  grid.innerHTML = products.map((p) => `
    <article class="product-card">
      <a class="product-media" href="/producto.html?id=${p.id}">
        ${p.featured ? `<span class="product-tag highlight">Destacado</span>` : ""}
        ${p.brand ? `<span class="product-tag brand">${p.brand}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </a>
      <div class="product-body">
        <div class="category-label">${p.unit}</div>
        <h3><a href="/producto.html?id=${p.id}">${p.name}</a></h3>
        <p class="desc">${p.short_desc}</p>
        <div class="product-footer">
          <span class="product-price">${priceText(p)}</span>
          <a class="product-link" href="/producto.html?id=${p.id}">Ver ficha →</a>
        </div>
      </div>
    </article>
  `).join("");

  const title = document.getElementById("results-title");
  const params = new URLSearchParams(window.location.search);
  const activeCat = state.categories.find((c) => String(c.id) === params.get("categoria"));
  if (activeCat) title.textContent = activeCat.name;
  else if (state.search) title.textContent = `Resultados para "${state.search}"`;
  else title.textContent = "Todos los productos";

  count.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
}

function priceText(p) {
  if (p.price > 0) return `${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.price)} ${p.unit ? `<small>/${p.unit}</small>` : ""}`;
  return `<span class="muted" style="font-size:0.85rem">Consultar en tienda</span>`;
}

async function loadProducts() {
  const params = new URLSearchParams(window.location.search);
  const category = params.get("categoria");
  state.activeCategory = category;
  const search = params.get("q");
  state.search = search || "";

  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (state.search) query.set("search", state.search);

  const res = await fetch(`/api/products?${query.toString()}`);
  const products = await res.json();
  renderProducts(products);
}

async function init() {
  try {
    const res = await fetch("/api/categories");
    state.categories = await res.json();
    renderCategories();
    await loadProducts();
  } catch (err) {
    console.error("Error:", err);
    document.getElementById("product-grid").innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>No se pudo cargar el catálogo.</p></div>`;
  }

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const term = document.getElementById("search-input").value.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set("q", term);
    else url.searchParams.delete("q");
    window.location.href = url.toString();
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get("q")) {
    document.getElementById("search-input").value = params.get("q");
  }
}

init();
