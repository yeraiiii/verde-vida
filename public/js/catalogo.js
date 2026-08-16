// Página de catálogo
const params = () => new URLSearchParams(window.location.search);

const state = {
  categories: [],
  flavors: [],
  brands: [],
};

// Redirige manteniendo los filtros y cambiando un parámetro ("" borra el parámetro).
function go(key, value) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  // Si cambia cualquier filtro y hay resultados de búsqueda, lo arrastramos tal cual.
  window.location.href = url.toString();
}

// ---------- Categorías ----------
function renderCategories() {
  const grid = document.getElementById("categorias");
  const active = params().get("categoria");

  grid.innerHTML = `
    <button class="cat-chip ${!active ? "active" : ""}" data-cat="">Todos</button>
  ` + state.categories.map((cat) => `
    <button class="cat-chip ${String(active) === String(cat.id) ? "active" : ""}" data-cat="${cat.id}">
      ${cat.name} <span class="chip-count">${cat.product_count}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".cat-chip").forEach((b) =>
    b.addEventListener("click", () => go("categoria", b.dataset.cat))
  );
}

// ---------- Sabores ----------
function renderFlavors() {
  const grid = document.getElementById("sabores");
  const active = params().get("sabor");
  if (!state.flavors.length) {
    grid.innerHTML = `<span class="muted" style="font-size:0.85rem">Aún no hay sabores catalogados.</span>`;
    return;
  }
  grid.innerHTML = `
    <button class="cat-chip ${!active ? "active" : ""}" data-sabor="">Todos</button>
  ` + state.flavors.map((f) => `
    <button class="cat-chip ${active === f.slug ? "active" : ""}" data-sabor="${f.slug}">
      ${f.name} <span class="chip-count">${f.product_count}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".cat-chip").forEach((b) =>
    b.addEventListener("click", () => go("sabor", b.dataset.sabor))
  );
}

// ---------- Marcas y orden ----------
function renderFilters() {
  const brandSel = document.getElementById("filter-brand");
  brandSel.innerHTML = `<option value="">Todas las marcas</option>` +
    state.brands.map((b) => `<option value="${escapeAttr(b.name)}">${b.name} (${b.product_count})</option>`).join("");
  brandSel.value = params().get("marca") || "";

  const sortSel = document.getElementById("filter-sort");
  sortSel.value = params().get("orden") || "";

  brandSel.addEventListener("change", () => go("marca", brandSel.value));
  sortSel.addEventListener("change", () => go("orden", sortSel.value));
  document.getElementById("filter-clear").addEventListener("click", () => {
    window.location.href = "/catalogo.html";
  });
}

function escapeAttr(v) {
  return String(v).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ---------- Productos ----------
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
        ${(p.flavors || []).length ? `<div class="flavor-row">${p.flavors.map(flavorPill).join("")}</div>` : ""}
        <div class="product-footer">
          <span class="product-price">${priceText(p)}</span>
          <a class="product-link" href="/producto.html?id=${p.id}">Ver ficha →</a>
        </div>
      </div>
    </article>
  `).join("");

  renderTitle();
  count.textContent = `${products.length} producto${products.length === 1 ? "" : "s"}`;
}

function flavorPill(slug) {
  const f = state.flavors.find((x) => x.slug === slug);
  return f ? `<span class="flavor-pill">${f.name}</span>` : "";
}

function renderTitle() {
  const title = document.getElementById("results-title");
  const p = params();
  const cat = state.categories.find((c) => String(c.id) === p.get("categoria"));
  const flavor = state.flavors.find((f) => f.slug === p.get("sabor"));
  const brand = p.get("marca");
  const search = p.get("q");

  const parts = [];
  if (cat) parts.push(cat.name);
  if (flavor) parts.push(`Sabor: ${flavor.name}`);
  if (brand) parts.push(`Marca: ${brand}`);
  if (!cat && !flavor && !brand && search) {
    title.textContent = `Resultados para "${search}"`;
    return;
  }
  title.textContent = parts.length ? parts.join(" · ") : "Todos los productos";
}

function priceText(p) {
  if (p.price > 0) return `${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.price)} ${p.unit ? `<small>/${p.unit}</small>` : ""}`;
  return `<span class="muted" style="font-size:0.85rem">Consultar en tienda</span>`;
}

// ---------- Carga ----------
async function loadProducts() {
  const p = params();
  const query = new URLSearchParams();
  if (p.get("categoria")) query.set("category", p.get("categoria"));
  if (p.get("sabor")) query.set("flavor", p.get("sabor"));
  if (p.get("marca")) query.set("brand", p.get("marca"));
  if (p.get("orden")) query.set("sort", p.get("orden"));
  if (p.get("q")) query.set("search", p.get("q"));

  const res = await fetch(`/api/products?${query.toString()}`);
  const products = await res.json();
  renderProducts(products);
}

async function init() {
  try {
    const [cats, filters] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/filters").then((r) => r.json()),
    ]);
    state.categories = cats;
    state.flavors = filters.flavors;
    state.brands = filters.brands;
  } catch (err) {
    console.error("Error cargando filtros:", err);
  }

  renderCategories();
  renderFlavors();
  renderFilters();
  await loadProducts().catch(() => {
    document.getElementById("product-grid").innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>No se pudo cargar el catálogo.</p></div>`;
  });

  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const term = document.getElementById("search-input").value.trim();
    const url = new URL(window.location.href);
    if (term) url.searchParams.set("q", term);
    else url.searchParams.delete("q");
    window.location.href = url.toString();
  });

  if (params().get("q")) {
    document.getElementById("search-input").value = params().get("q");
  }
}

init();