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

async function loadProducts() {
  const tbody = $("#products-tbody");
  tbody.innerHTML = `<tr><td colspan="6" class="text-center muted"><div class="spinner"></div> Cargando…</td></tr>`;
  try {
    const [products, settings] = await Promise.all([
      authFetch("/api/admin/products").then((r) => r.json()),
      authFetch("/api/admin/settings").then((r) => r.json()),
    ]);
    categoriesCache = settings.categories;
    $("#f-category").innerHTML = categoriesCache
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");

    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center muted">No hay productos. Crea el primero.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map((p) => {
      const cat = categoriesCache.find((c) => c.id === p.category_id);
      return `
      <tr>
        <td data-label="Imagen"><img class="table-img" src="${p.image}" alt="${p.name}"></td>
        <td data-label="Producto"><strong>${p.name}</strong><br><span class="muted" style="font-size:0.8rem">${p.unit}</span></td>
        <td data-label="Categoría">${cat ? cat.name : "—"}</td>
        <td data-label="Precio">${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(p.price)}</td>
        <td data-label="Estado">${p.active ? '<span class="badge active">Visible</span>' : '<span class="badge inactive">Oculto</span>'} ${p.featured ? '<span class="badge active" style="background:var(--crema-suave)">★</span>' : ""}</td>
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
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center muted">Error cargando productos.</td></tr>`;
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
  $("#f-featured").checked = false;
  $("#f-active").checked = true;

  if (id) {
    // Cargamos los datos completos desde el endpoint admin (incluye productos ocultos)
    authFetch("/api/admin/products")
      .then((r) => r.json())
      .then((all) => all.find((p) => p.id === id))
      .then((p) => {
        if (!p) throw new Error("Producto no encontrado");
        $("#f-name").value = p.name;
        $("#f-category").value = p.category_id;
        $("#f-price").value = p.price;
        $("#f-unit").value = p.unit;
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
    category_id: Number($("#f-category").value),
    price: Number($("#f-price").value),
    unit: $("#f-unit").value.trim(),
    short_desc: $("#f-short").value.trim(),
    long_desc: $("#f-long").value.trim(),
    image: $("#f-image").value.trim(),
    properties: collectRepeater($("#prop-list")),
    characteristics: collectRepeater($("#char-list")),
    featured: $("#f-featured").checked,
    active: $("#f-active").checked,
  };

  if (!payload.name || !payload.price || !payload.short_desc || !payload.long_desc) {
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
  const name = "este producto";
  if (!confirm(`¿Seguro que quieres eliminar ${name}? Esta acción no se puede deshacer.`)) return;
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
  $("#f-image").addEventListener("input", (e) => updateImagePreview(e.target.value));
  $(".modal-overlay").addEventListener("click", closeModal);
  checkAuth();
});
