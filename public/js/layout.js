// Header y footer compartidos
const HEADER_HTML = `
  <div class="topbar">Envío gratuito a partir de 49 € · Productos ecológicos seleccionados</div>
  <header class="site-header">
    <div class="container">
      <a class="logo" href="/">
        <div class="logo-icon">🌿</div>
        <div class="logo-text">
          <div class="name">Verde Vida</div>
          <div class="tagline">Alimentación &amp; Nutrición</div>
        </div>
      </a>
      <nav class="main-nav" id="main-nav">
        <a href="/" data-nav="inicio">Inicio</a>
        <a href="/catalogo.html" data-nav="catalogo">Catálogo</a>
        <a href="/catalogo.html#categorias" data-nav="categorias">Categorías</a>
        <a href="/admin.html" data-nav="admin">Admin</a>
      </nav>
      <button class="menu-toggle" aria-label="Menú">☰</button>
    </div>
  </header>
  <div class="nav-overlay"></div>
`;

const FOOTER_HTML = `
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <h4>Verde Vida</h4>
          <p>Herboristería y tienda de nutrición natural. Productos ecológicos, frescos y seleccionados para cuidar tu salud cada día.</p>
        </div>
        <div>
          <h4>Enlaces</h4>
          <ul>
            <li><a href="/">Inicio</a></li>
            <li><a href="/catalogo.html">Catálogo</a></li>
            <li><a href="/catalogo.html#categorias">Categorías</a></li>
            <li><a href="/admin.html">Panel de administración</a></li>
          </ul>
        </div>
        <div>
          <h4>Contacto</h4>
          <ul>
            <li><a href="mailto:hola@verdevida.example">hola@verdevida.example</a></li>
            <li><a href="tel:+34900000000">+34 900 000 000</a></li>
            <li>Calle del Boticario 12, Madrid</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} Verde Vida. Todos los derechos reservados.</span>
        <span>Catálogo informativo — consulta con tu especialista antes de consumir suplementos.</span>
      </div>
    </div>
  </footer>
`;

document.addEventListener("DOMContentLoaded", () => {
  const headerSlot = document.querySelector("#site-header");
  const footerSlot = document.querySelector("#site-footer");
  if (headerSlot) headerSlot.outerHTML = HEADER_HTML;
  if (footerSlot) footerSlot.outerHTML = FOOTER_HTML;

  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href === "/" && (path === "index.html" || path === "")) a.classList.add("active");
    else if (href.includes(path) && path !== "index.html") a.classList.add("active");
  });

  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");
  const overlay = document.querySelector(".nav-overlay");
  if (toggle && nav) {
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
});
