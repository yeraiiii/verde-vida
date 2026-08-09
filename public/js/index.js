// Landing page
const CATEGORY_ICONS = {
  "aceites": "🫒",
  "cereales": "🌾",
  "frutos-secos": "🥜",
  "hierbas": "🌿",
  "infusiones": "🍵",
  "mieles": "🍯",
  "suplementos": "💊",
};

function renderCategoryCard(cat) {
  return `
    <a class="category-card" href="/catalogo.html?categoria=${cat.id}">
      <div class="icon">${CATEGORY_ICONS[cat.slug] || "🌿"}</div>
      <h3>${cat.name}</h3>
      <div class="count">${cat.product_count} producto${cat.product_count === 1 ? "" : "s"}</div>
    </a>
  `;
}

function renderProductCard(p) {
  const badge = p.featured ? `<span class="product-tag highlight">Destacado</span>` : "";
  return `
    <article class="product-card">
      <a class="product-media" href="/producto.html?id=${p.id}">
        ${badge}
        <img src="${p.image}" alt="${p.name}" loading="lazy">
      </a>
      <div class="product-body">
        <div class="category-label">${p.unit}</div>
        <h3><a href="/producto.html?id=${p.id}">${p.name}</a></h3>
        <p class="desc">${p.short_desc}</p>
        <div class="product-footer">
          <span class="product-price">${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.price)} <small>/${p.unit}</small></span>
          <a class="product-link" href="/producto.html?id=${p.id}">Ver ficha →</a>
        </div>
      </div>
    </article>
  `;
}

async function init() {
  try {
    const [categories, featured] = await Promise.all([
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/products/featured").then((r) => r.json()),
    ]);

    const catGrid = document.getElementById("categories-grid");
    if (categories.length) {
      catGrid.innerHTML = categories.map(renderCategoryCard).join("");
    } else {
      catGrid.innerHTML = `<div class="empty-state"><div class="icon">🌿</div><p>Aún no hay categorías.</p></div>`;
    }

    const featGrid = document.getElementById("featured-grid");
    if (featured.length) {
      featGrid.innerHTML = featured.map(renderProductCard).join("");
    } else {
      featGrid.innerHTML = `<div class="empty-state"><div class="icon">🛒</div><p>Aún no hay productos destacados.</p></div>`;
    }
  } catch (err) {
    console.error("Error cargando la landing:", err);
    document.getElementById("categories-grid").innerHTML =
      `<div class="empty-state"><div class="icon">⚠️</div><p>No se pudo cargar el contenido.</p></div>`;
  }
}

init();
