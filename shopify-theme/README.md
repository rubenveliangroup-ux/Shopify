# Estudio de diseño 3D para el tema de Shopify

Versión del estudio (`components/studio`) incrustada en el tema Horizon, sin servidor propio.

- `src/entry.tsx` monta el estudio en `#br-studio` con la configuración que imprime la sección Liquid
  (módulo ES: `<script type="module">`).
- `src/add-to-cart.tsx` añade el producto personalizable al carrito con un formulario multipart a `/cart/add`:
  el diseño (`Diseño`), la captura 3D (`Vista 3D`) y la imagen original quedan como propiedades de la línea
  y se ven en el pedido de Shopify.
- `sections/br-design-studio.liquid` + `templates/page.disena.json` → página "Diseña tu prenda".
- `assets/` es el resultado de `npm run build:theme` (no editar a mano).

## Color, hilos, medidas y menú

- **Selector de color único** `<br-color-picker>` (`components/color/color-picker-element.ts`): estudio,
  «Envíanos tu diseño» e «Impulsa tu marca» (`assets/br-color-picker.js`). Cuadrícula, degradado + tono,
  código hex; en modo hilo asigna el hilo real más cercano (CIEDE2000).
- **Carta de hilos**: `assets/br-hilos.json` (editable en *Editar código*, sin recompilar). Formato:
  `[{ "code": "BR-001", "name": "Blanco óptico", "hex": "#ffffff" }, …]`. El calculador cuenta hilos:
  dos colores que caen en el mismo hilo cuentan como uno.
- **Color de prenda**: editor de temas → «Estudio de diseño BR» → «Modo de color de prenda»
  (libre / stock) y «Colores de stock» (`Nombre #hex` por línea). En modo libre, las líneas llevan
  `Aviso: Color sujeto a confirmación de disponibilidad` y `_Color prenda (hex)`.
- **Medidas**: fuente única `snippets/br-medidas.liquid` (variable `medidas`; dibujo de cómo se mide
  `assets/br-guia-medidas.webp`, recortado de la imagen de la tabla, con `mostrar_imagen`). Se muestra en el bloque «Medidas (BR)» de la ficha de producto
  (`blocks/br-medidas.liquid`, solo productos con opción «Talla») y en el selector de talla del estudio.
- **Menú**: `snippets/br-nav-extra.liquid` añade «Diseña tu prenda» e «Impulsa tu marca» si el menú
  `main-menu` no los trae, y subraya el apartado activo. Parches mínimos sobre Horizon en
  `theme-overrides/` (originales en `original/` para comparar).

## Modelo 3D (GLB) y vista ligera

Ver [`MODELO-3D.md`](MODELO-3D.md). Sudadera real de Meshy preparada con `tools/preparar-prenda.mjs`
(escala por tabla de medidas, base neutra para teñir, zonas por talla), optimizada a 0,28 MB
(`assets/br-sudadera.glb`) y fotos de la vista ligera (`assets/br-prenda-*.webp`, de
`tools/render-vistas.mjs`). El visor 3D es un chunk aparte (`assets/br-studio-*.js`): al subir
assets, sube **todos** los `br-studio*.js`. `npm run test:3d` comprueba px→cm en todas las tallas.

## Portada, catálogo y pie (secciones BR)

Todo es editable en el editor de temas y usa `assets/br-landing.css` (mobile-first, identidad del tema).

**Portada** (`templates/index.json`), en este orden:
- `br-hero`: pantalla completa, vídeo o imagen, «Ver catálogo» / «Diseña tu prenda»; es la única imagen sin diferir;
- `br-featured`: colección destacada;
- `br-steps`: cómo funciona, 4 pasos;
- `br-story`: marca, bordado gallego, Pontevedra, con marcadores amarillos para completar;
- `br-cta-marcas`: Impulsa tu marca;
- `br-faq`;
- `br-newsletter`: formulario de cliente con la etiqueta `newsletter`.

**FAQ**: una sola fuente, la página «Preguntas frecuentes». Cada pregunta es un `<h3>` en su contenido.
Esa página usa `templates/page.faq.json`.

**Catálogo**: `templates/collection.json` → `br-main-collection` + `snippets/br-product-card.liquid`.
- 2 columnas en móvil y 3–4 en escritorio.
- Segunda foto al pasar el ratón.
- Filtros de *Search & Discovery* en panel inferior (móvil) o lateral (escritorio).
- «Cargar más» sin saltos y estado vacío.
- Etiquetas: metacampo `custom.etiqueta` («Nuevo», «Edición limitada») o las etiquetas `nuevo` /
  `edicion-limitada`.

**Pie**: `sections/footer-group.json` → `br-footer`, con:
- menús `pie-tienda`, `pie-ayuda` y `pie-legal`;
- redes, contacto y newsletter editables;
- iconos de pago dinámicos;
- acordeón en móvil, columnas en escritorio.

Textos base de las páginas legales: `contenido/*.html` (BORRADOR, con marcadores).

## Calculadora de bordado

Ver [CALCULADORA.md](./CALCULADORA.md): estimación de puntadas y colores, tramos de precio, productos ocultos,
calibración y «Enviar mi diseño» (subida de archivos vía carrito + formulario de contacto nativo).

## Actualizar el estudio en Shopify

1. `npm run build:theme` y commit de `shopify-theme/assets/`.
2. Subir `assets/br-studio*.js` (con sus chunks), `br-studio.css`, `br-bordado-worker.js`, `br-formularios.js`
   y `br-color-picker.js` al tema (Admin API `themeFilesUpsert` con la URL raw de GitHub,
   o a mano en *Editar código → assets*).
