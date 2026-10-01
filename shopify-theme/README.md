# Estudio de diseño 3D para el tema de Shopify

Versión del estudio (`components/studio`) incrustada en el tema Horizon, sin servidor propio.

- `src/entry.tsx` monta el estudio en `#br-studio` con la configuración que imprime la sección Liquid.
- `src/add-to-cart.tsx` añade el producto personalizable al carrito con un formulario multipart a `/cart/add`:
  el diseño (`Diseño`), la captura 3D (`Vista 3D`) y la imagen original quedan como propiedades de la línea
  y se ven en el pedido de Shopify.
- `sections/br-design-studio.liquid` + `templates/page.disena.json` → página "Diseña tu prenda".
- `assets/` es el resultado de `npm run build:theme` (no editar a mano).

## Calculadora de bordado

Ver [CALCULADORA.md](./CALCULADORA.md): estimación de puntadas y colores, tramos de precio, productos ocultos y calibración.

## Actualizar el estudio en Shopify

1. `npm run build:theme` y commit de `shopify-theme/assets/`.
2. Subir `assets/br-studio.js` y `assets/br-studio.css` al tema (Admin API `themeFilesUpsert` con la URL raw de GitHub,
   o a mano en *Editar código → assets*).
