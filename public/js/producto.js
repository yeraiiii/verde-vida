// Ficha de producto
async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const root = document.getElementById("detail-root");

  if (!id) {
    root.innerHTML = `<div class="empty-state"><div class="icon">🔍</div><p>Producto no indicado.</p></div>`;
    return;
  }

  try {
    const [product, categories] = await Promise.all([
      fetch(`/api/products/${id}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch("/api/categories").then((r) => r.json()),
    ]);

    const cat = categories.find((c) => c.id === product.category_id);
    document.getElementById("crumb-cat").textContent = cat ? cat.name : "";
    document.title = `${product.name} · Verde Vida`;

    const props = (product.properties || []).map(
      (x) => `<span class="prop-chip">🌿 ${x}</span>`
    ).join("");

    const chars = (product.characteristics || []).map(
      (x) => `<li>${x}</li>`
    ).join("");

    root.innerHTML = `
      <div class="product-detail">
        <div class="product-detail-media">
          <img src="${product.image}" alt="${product.name}">
        </div>
        <div>
          <div class="detail-category">${cat ? cat.name : ""} · ${product.unit}</div>
          <h1>${product.name}</h1>
          <div class="detail-price">${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(product.price)} <small>/ ${product.unit}</small></div>
          <p class="detail-short">${product.short_desc}</p>
          <p class="detail-long">${product.long_desc}</p>

          ${props ? `<div class="detail-block"><h2>Propiedades</h2><div class="prop-grid">${props}</div></div>` : ""}

          ${chars ? `<div class="detail-block"><h2>Características</h2><ul class="char-list">${chars}</ul></div>` : ""}
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>No se pudo cargar el producto.</p></div>`;
  }
}

init();
