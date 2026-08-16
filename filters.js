// Filtros del catálogo: sabores, marcas y búsqueda por tokens.
// Los sabores se derivan del NOMBRE del producto (no se modifica ningún producto).

// Normaliza un texto: minúsculas + sin acentos + colapsa espacios.
export function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9çñ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lista de sabores conocidos. Cada uno busca sus palabras clave en el nombre.
export const FLAVORS = [
  { slug: "chocolate", name: "Chocolate", keywords: ["chocolate", "choco", "choco blanco"] },
  { slug: "chocolate-blanco", name: "Chocolate blanco", keywords: ["chocolate blanco", "choco blanco"] },
  { slug: "vainilla", name: "Vainilla", keywords: ["vainilla"] },
  { slug: "cookies", name: "Cookies", keywords: ["cookies", "galleta"] },
  { slug: "fresa", name: "Fresa", keywords: ["fresa"] },
  { slug: "platano", name: "Plátano", keywords: ["platano"] },
  { slug: "fresa-platano", name: "Fresa y plátano", keywords: ["fresa platano"] },
  { slug: "limon", name: "Limón", keywords: ["limon"] },
  { slug: "naranja", name: "Naranja", keywords: ["naranja"] },
  { slug: "sandia", name: "Sandía", keywords: ["sandia"] },
  { slug: "pina", name: "Piña", keywords: ["pina"] },
  { slug: "pina-colada", name: "Piña colada", keywords: ["pina colada"] },
  { slug: "frutos-del-bosque", name: "Frutos del bosque", keywords: ["frutos del bosque"] },
  { slug: "tropical", name: "Tropical", keywords: ["tropical"] },
  { slug: "mango", name: "Mango", keywords: ["mango"] },
  { slug: "melocoton", name: "Melocotón", keywords: ["melocoton"] },
  { slug: "manzana", name: "Manzana", keywords: ["manzana"] },
  { slug: "cola", name: "Cola", keywords: ["cola"] },
  { slug: "piruleta", name: "Piruleta", keywords: ["piruleta"] },
  { slug: "kitkat", name: "KitKat", keywords: ["kitkat"] },
  { slug: "ferrero", name: "Ferrero", keywords: ["ferrero"] },
  { slug: "oreo", name: "Oreo", keywords: ["oreo"] },
  { slug: "donuts", name: "Donuts", keywords: ["donuts"] },
  { slug: "avellana", name: "Avellana", keywords: ["avellana"] },
  { slug: "canela", name: "Canela", keywords: ["canela"] },
  { slug: "caramelo", name: "Caramelo", keywords: ["caramelo"] },
  { slug: "neutro", name: "Sin sabor", keywords: ["neutra", "neutro"] },
];

// Busca si el texto normalizado contiene una palabra clave como palabra completa
// (límites de palabra). Admite plural con una "s"/"es" final opcional.
function containsKeyword(haystack, keyword) {
  const esc = String(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(`(^|\\s)${esc}s?(\\s|$)`, "i").test(haystack);
  } catch {
    return haystack.includes(keyword);
  }
}

// Devuelve los slugs de sabor que tiene un producto según su nombre.
export function flavorsOfName(name) {
  const haystack = norm(name);
  const out = [];
  for (const f of FLAVORS) {
    if (f.keywords.some((kw) => containsKeyword(haystack, kw))) out.push(f.slug);
  }
  return out;
}

// Devuelve si el nombre de un producto corresponde a un sabor.
export function matchesFlavor(name, flavorSlug) {
  const f = FLAVORS.find((x) => x.slug === flavorSlug);
  if (!f) return false;
  const haystack = norm(name);
  return f.keywords.some((kw) => containsKeyword(haystack, kw));
}