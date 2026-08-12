// Panel de administración
const TOKEN_KEY = "vv_admin_token";

const $ = (sel) => document.querySelector(sel);

function authFetch(url, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

const showNotice = (el, msg, type = "success") => {
  el.textContent = msg;
  el.className = `notice ${type}`;
  setTimeout(() => el.classList.add("hidden"), 4000);
};

// ---------- Estado de sesión ----------
function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    $("#login-view").classList.add("hidden");
    $("#panel-view").classList.remove("hidden");
    loadProducts();
    loadCategories();
  } else {
    $("#login-view").classList.remove("hidden");
    $("#panel-view").classList.add("hidden");
  }
}

// ---------- Login ----------
async function handleLogin(e) {
  e.preventDefault();
  const btn = $("#login-btn");
  btn.disabled = true;
  btn.textContent = "Entrando…";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("#username").value.trim(),
        password: $("#password").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");
    localStorage.setItem(TOKEN_KEY, data.token);
    checkAuth();
  } catch (err) {
    showNotice($("#login-notice"), err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

// ---------- Cargar productos ----------
let categoriesCache = [];
let allProducts = [];

const fmtMoney = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

function renderTable(products) {
  const tbody = $("#products-tbody");
  if (!products.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center muted">No hay productos que coincidan.</td></tr>`;
    return;
  }
  tbody.innerHTML = products.map((p) => {
    const cat = categoriesCache.find((c) => c.id === p.category_id);
    const badge = p.active && p.stock > 0
      ? '<span class="badge active">Visible</span>'
      : '<span class="badge inactive">Sin stock</span>';
    return `
      <tr>
        <td data-label="Imagen"><img class="table-img" src="${p.image}" alt="${p.name}"></td>
        <td data-label="Producto"><strong>${p.name}</strong><br><span class="muted" style="font-size:0.8rem">${p.unit}</span></td>
        <td data-label="Marca">${p.brand || "—"}</td>
        <td data-label="Categoría">${cat ? cat.name : "—"}</td>
        <td data-label="Precio">${p.price > 0 ? fmtMoney(p.price) : "Consultar"}</td>
        <td data-label="Stock">${p.stock}</td>
        <td data-label="Estado">${badge} ${p.featured ? '<span class="badge active" style="background:var(--crema-suave)">★</span>' : ""}</td>
        <td data-label="">
          <div class="actions">
            <button class="icon-btn edit" data-id="${p.id}" title="Editar">✏️ Editar</button>
            <button class="icon-btn del" data-id="${p.id}" title="Eliminar">🗑️ Eliminar</button>
          </div>
        </td>
      </tr>`;
  }).join("");

  tbody.querySelectorAll(".edit").forEach((b) =>
    b.addEventListener("click", () => openModal(Number(b.dataset.id)))
  );
  tbody.querySelectorAll(".del").forEach((b) =>
    b.addEventListener("click", () => deleteProduct(Number(b.dataset.id)))
  );
}

function applySearch() {
  const term = $("#admin-search").value.trim().toLowerCase();
  const filtered = term
    ? allProducts.filter((p) =>
        `${p.name} ${p.brand} ${p.unit}`.toLowerCase().includes(term))
    : allProducts;
  renderTable(filtered);
  $("#search-count").textContent = term ? `${filtered.length} de ${allProducts.length}` : `${allProducts.length} productos`;
}

async function loadProducts() {
  const tbody = $("#products-tbody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center muted"><div class="spinner"></div> Cargando…</td></tr>`;
  try {
    const settings = await authFetch("/api/admin/settings").then((r) => r.json());
    categoriesCache = settings.categories;
    $("#f-category").innerHTML = categoriesCache
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");

    allProducts = await authFetch("/api/admin/products").then((r) => r.json());
    applySearch();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center muted">Error cargando productos.</td></tr>`;
  }
}

// ---------- Gestión de categorías ----------
async function loadCategories() {
  const list = $("#cat-list");
  const settings = await authFetch("/api/admin/settings").then((r) => r.json());
  categoriesCache = settings.categories;
  list.innerHTML = categoriesCache.map((c) => `
    <li class="cat-item">
      <span class="cat-name">${c.name}</span>
      <span class="muted" style="font-size:0.8rem">${c.product_count ?? ""} productos</span>
      <div class="cat-actions">
        <button class="icon-btn edit-cat" data-id="${c.id}" title="Renombrar">✏️</button>
        <button class="icon-btn del-cat" data-id="${c.id}" title="Eliminar">🗑️</button>
      </div>
    </li>`).join("");

  list.querySelectorAll(".edit-cat").forEach((b) =>
    b.addEventListener("click", () => renameCategory(Number(b.dataset.id)))
  );
  list.querySelectorAll(".del-cat").forEach((b) =>
    b.addEventListener("click", () => deleteCategory(Number(b.dataset.id)))
  );
}

async function addCategory() {
  const name = $("#cat-name").value.trim();
  if (!name) return;
  try {
    const res = await authFetch("/api/admin/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al crear");
    $("#cat-name").value = "";
    showNotice($("#admin-notice"), "Categoría creada.");
    loadCategories();
  } catch (err) {
    showNotice($("#admin-notice"), err.message, "error");
  }
}

async function renameCategory(id) {
  const cat = categoriesCache.find((c) => c.id === id);
  if (!cat) return;
  const name = prompt("Nuevo nombre de la categoría:", cat.name);
  if (!name || name.trim() === cat.name) return;
  try {
    const res = await authFetch(`/api/admin/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al renombrar");
    showNotice($("#admin-notice"), "Categoría renombrada.");
    loadCategories();
  } catch (err) {
    showNotice($("#admin-notice"), err.message, "error");
  }
}

async function deleteCategory(id) {
  const cat = categoriesCache.find((c) => c.id === id);
  if (!confirm(`¿Eliminar la categoría "${cat?.name}"? Solo se puede si no tiene productos.`)) return;
  try {
    const res = await authFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al eliminar");
    showNotice($("#admin-notice"), "Categoría eliminada.");
    loadCategories();
  } catch (err) {
    showNotice($("#admin-notice"), err.message, "error");
  }
}

// ---------- Repeaters ----------
function addRepeaterRow(listEl, value = "") {
  const row = document.createElement("div");
  row.className = "repeater-item";
  row.innerHTML = `
    <input type="text" value="${escapeAttr(value)}" placeholder="Texto…">
    <button type="button" class="repeater-remove" title="Quitar">×</button>
  `;
  row.querySelector(".repeater-remove").addEventListener("click", () => row.remove());
  listEl.appendChild(row);
}

function escapeAttr(v) {
  return String(v).replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function collectRepeater(listEl) {
  return Array.from(listEl.querySelectorAll(".repeater-item input"))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

// ---------- Subida de imagen ----------
function handleImageFile(file) {
  const hint = $("#f-image-hint");
  if (!file) return;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = () => {
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      $("#f-image").value = canvas.toDataURL("image/jpeg", 0.82);
      updateImagePreview($("#f-image").value);
      hint.textContent = "Imagen lista. Puedes cambiarla o guardar el producto.";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ---------- Modal de producto ----------
let editingId = null;

function openModal(id) {
  editingId = id ?? null;
  $("#modal-title").textContent = id ? "Editar producto" : "Nuevo producto";
  $("#modal-notice").classList.add("hidden");
  $("#product-form").reset();
  $("#prop-list").innerHTML = "";
  $("#char-list").innerHTML = "";
  $("#f-image-preview").classList.add("hidden");
  $("#f-image").value = "";
  $("#f-image-hint").textContent = "Si no eliges imagen, se mantiene la actual o se genera una automática.";
  $("#f-featured").checked = false;
  $("#f-active").checked = true;

  if (id) {
    authFetch("/api/admin/products")
      .then((r) => r.json())
      .then((all) => all.find((p) => p.id === id))
      .then((p) => {
        if (!p) throw new Error("Producto no encontrado");
        $("#f-name").value = p.name;
        $("#f-brand").value = p.brand || "";
        $("#f-category").value = p.category_id;
        $("#f-price").value = p.price;
        $("#f-unit").value = p.unit;
        $("#f-stock").value = p.stock ?? 0;
        $("#f-short").value = p.short_desc;
        $("#f-long").value = p.long_desc;
        $("#f-image").value = p.image || "";
        updateImagePreview(p.image);
        $("#f-featured").checked = !!p.featured;
        $("#f-active").checked = p.active !== 0;
        (p.properties || []).forEach((x) => addRepeaterRow($("#prop-list"), x));
        (p.characteristics || []).forEach((x) => addRepeaterRow($("#char-list"), x));
      });
  } else {
    addRepeaterRow($("#prop-list"));
    addRepeaterRow($("#char-list"));
  }

  $("#product-modal").classList.remove("hidden");
}

function closeModal() {
  $("#product-modal").classList.add("hidden");
}

function updateImagePreview(url) {
  const img = $("#f-image-preview");
  if (url && url.trim()) {
    img.src = url.trim();
    img.classList.remove("hidden");
  } else {
    img.classList.add("hidden");
  }
}

// ---------- Guardar producto ----------
async function saveProduct(e) {
  e.preventDefault();
  const payload = {
    name: $("#f-name").value.trim(),
    brand: $("#f-brand").value.trim(),
    category_id: Number($("#f-category").value),
    price: Number($("#f-price").value) || 0,
    unit: $("#f-unit").value.trim(),
    stock: Number($("#f-stock").value) || 0,
    short_desc: $("#f-short").value.trim(),
    long_desc: $("#f-long").value.trim(),
    image: $("#f-image").value,
    properties: collectRepeater($("#prop-list")),
    characteristics: collectRepeater($("#char-list")),
    featured: $("#f-featured").checked,
    active: $("#f-active").checked,
  };

  if (!payload.name || !payload.short_desc || !payload.long_desc) {
    showNotice($("#modal-notice"), "Completa los campos obligatorios (*).", "error");
    return;
  }

  try {
    const url = editingId
      ? `/api/admin/products/${editingId}`
      : "/api/admin/products";
    const res = await authFetch(url, {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error al guardar");
    closeModal();
    showNotice($("#admin-notice"), editingId ? "Producto actualizado." : "Producto creado.");
    loadProducts();
  } catch (err) {
    showNotice($("#modal-notice"), err.message, "error");
  }
}

// ---------- Eliminar ----------
async function deleteProduct(id) {
  if (!confirm("¿Seguro que quieres eliminar este producto? Esta acción no se puede deshacer.")) return;
  try {
    const res = await authFetch(`/api/admin/products/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
    showNotice($("#admin-notice"), "Producto eliminado.");
    loadProducts();
  } catch (err) {
    showNotice($("#admin-notice"), err.message, "error");
  }
}

// ---------- Cierre de sesión ----------
function handleLogout() {
  localStorage.removeItem(TOKEN_KEY);
  checkAuth();
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  $("#login-form").addEventListener("submit", handleLogin);
  $("#product-form").addEventListener("submit", saveProduct);
  $("#btn-logout").addEventListener("click", handleLogout);
  $("#btn-new").addEventListener("click", () => openModal(null));
  $("#btn-cancel").addEventListener("click", closeModal);
  $(".add-prop").addEventListener("click", () => addRepeaterRow($("#prop-list")));
  $(".add-char").addEventListener("click", () => addRepeaterRow($("#char-list")));
  $("#admin-search").addEventListener("input", applySearch);
  $("#f-image-file").addEventListener("change", (e) => handleImageFile(e.target.files[0]));
  $(".modal-overlay").addEventListener("click", closeModal);
  $("#btn-add-cat").addEventListener("click", addCategory);
  $("#cat-name").addEventListener("keydown", (e) => { if (e.key === "Enter") addCategory(); });
  checkAuth();
});
