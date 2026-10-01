# Estudio de diseño 3D para el tema de Shopify

Versión del estudio (`components/studio`) incrustada en el tema Horizon, sin servidor propio.

- `src/entry.tsx` monta el estudio en `#br-studio` con la configuración que imprime la sección Liquid.
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
- **Medidas**: fuente única `snippets/br-medidas.liquid` (variable `medidas`; imagen opcional con
  `imagen` + `mostrar_imagen`). Se muestra en el bloque «Medidas (BR)» de la ficha de producto
  (`blocks/br-medidas.liquid`, solo productos con opción «Talla») y en el selector de talla del estudio.
- **Menú**: `snippets/br-nav-extra.liquid` añade «Diseña tu prenda» e «Impulsa tu marca» si el menú
  `main-menu` no los trae, y subraya el apartado activo. Parches mínimos sobre Horizon en
  `theme-overrides/` (originales en `original/` para comparar).

## Modelo 3D (GLB)

Ver [`MODELO-3D.md`](MODELO-3D.md): ficha para encargar o comprar el modelo, `npm run glb:validar`,
`npm run glb:optimizar`, ajuste «URL del modelo 3D (.glb)» de la sección y limitaciones. Sin GLB
válido, el estudio usa la sudadera 3D básica. `npm run test:3d` comprueba que px→cm se mantiene
en todas las tallas.

## Calculadora de bordado

Ver [CALCULADORA.md](./CALCULADORA.md): estimación de puntadas y colores, tramos de precio, productos ocultos y calibración.

## Actualizar el estudio en Shopify

1. `npm run build:theme` y commit de `shopify-theme/assets/`.
2. Subir `assets/br-studio.js` y `assets/br-studio.css` al tema (Admin API `themeFilesUpsert` con la URL raw de GitHub,
   o a mano en *Editar código → assets*).
