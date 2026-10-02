# Calculadora de bordado del estudio 3D

Estima en el navegador las **puntadas** y los **colores de hilo** del diseño del cliente y muestra en vivo
el **extra de bordado** por tramos. No genera el archivo de bordado (el picaje real se hace aparte):
es solo una estimación para fijar precio. Cada pedido se revisa a mano antes de producir.

## Cómo estima

El diseño se **«hila»** (`embroidery-threadize.ts`, función pura) en un **Web Worker**
(`assets/br-bordado-worker.js`), así que la interfaz no se bloquea. Si el navegador no admite el worker,
se hace en el hilo principal. Solo se recalcula cuando cambia el diseño (220 ms después del último cambio).

1. Toma el diseño de cada lado (delante / detrás) a su **tamaño real en cm** y lo renderiza a 0,4 mm/píxel
   (0,5 mm en móvil).
2. Quita el **fondo blanco** de las imágenes subidas y el transparente.
3. **Hilos**: k-means en Lab → cada color pasa al **hilo más cercano de la carta**. Se unen los hilos repetidos,
   se limita a **12 hilos** como máximo y se eliminan los degradados, las sombras y los detalles diminutos
   (< 0,02 cm²).
4. **Relleno o línea**: con la distancia al borde de cada zona se separan las zonas **rellenas** de las
   **líneas** (trazos de menos de `anchoMaxLineaMm`, 4 mm por defecto).
   - Las líneas se miden por longitud = área ÷ ancho medio.
   - El relleno se mide por área y contorno (× 1,1).
5. **Puntadas** = relleno (cm²) × `puntadasPorCm2` + contorno del relleno (cm) × `puntadasPorCmBorde`
   + líneas (cm) × `puntadasPorCmLinea`, sumando delante y detrás.
   - Se muestra **«Entre X y Y puntadas»** (± `margenError`, 20 % por defecto).
   - El tramo se calcula con el valor central + margen.
   - Si el diseño puede caer en el tramo de al lado, se avisa.
6. **Tramo**, número de **hilos** y **precio estimado**. Por encima de `umbralPresupuesto` (50.000) se pasa a
   **«presupuesto personalizado»** con el botón «Enviar mi diseño para presupuesto».
7. **Avisos**:
   - el diseño supera el bastidor (`bastidorAnchoCm × bastidorAltoCm`, 30 × 30 cm provisional);
   - diseño muy pequeño;
   - líneas de menos de 1 mm;
   - fondo blanco ignorado;
   - **hilo que no se distingue de la prenda** (ΔE2000 < `contrasteMinimo`, 12).
8. Texto fijo: «Cálculo aproximado. El precio final se confirma tras digitalizar el diseño».

Código:
- `components/studio/embroidery-threadize.ts`: análisis y mapas de relieve;
- `embroidery-worker.ts` y `embroidery-client.ts`: el worker;
- `embroidery-pricing.ts`: todas las constantes y los tramos;
- `embroidery-panel.tsx`: panel y modo calibración.

Prueba con diseños de tamaño conocido: `npm run test:bordado`.

## Dónde se configura (un único sitio)

**Editor de temas → página «Diseña tu prenda» → sección «Estudio de diseño BR» → «Calculadora de bordado»**:

| Ajuste | Valor inicial | Notas |
|---|---|---|
| Puntadas por cm² (relleno) | 150 | **Provisional: calibrar** (ver abajo) |
| Puntadas extra por cm de contorno | 5 | Provisional |
| Puntadas por cm de línea | 25 | Provisional (satín / pespunte) |
| Ancho máximo de una «línea» | 4 mm | Más ancho cuenta como relleno |
| Margen de error | 20 % | Rango «entre X y Y»; se suma antes de asignar tramo |
| Umbral de presupuesto personalizado | 50.000 | Por encima: «Enviar mi diseño» |
| Bastidor máximo (ancho × alto) | 30 × 30 cm | **Provisional: pon el de tu máquina** |
| Topes de los tramos | 5000, 10000, 15000, 20000, 30000, 40000, 50000 | |
| Coste por 1.000 puntadas | 0,75 € | |
| Multiplicador de margen | 1 | |
| Cuota fija (montaje + digitalización) | 5 € | **Provisional** |
| Precio por color adicional | 1 € | **Provisional** |
| Máximo de colores | 12 | Agujas de la máquina |

Precio de cada tramo = `tope / 1000 × coste_por_mil × multiplicador + cuota_fija`.
Los valores por defecto (si la sección no tiene ajustes) están en `components/studio/embroidery-pricing.ts`.

> **Importante:** lo que paga el cliente es el **precio de las variantes en Shopify**. El estudio muestra
> siempre ese precio. Cuando cambies un ajuste de precio, cambia también el precio de la variante.
> Abre la página con `?calibrar=1` y verás una tabla «fórmula vs. variante» que marca en rojo lo que no cuadra.

## Qué crear en el admin de Shopify

Con los valores iniciales (cuota fija 5 €, color 1 €):

**1. Producto «Extra de bordado»**
- Estado: **Sin listar** (no sale en catálogo ni búsquedas). Disponible en el canal *Tienda online*.
- Sin envío (desmarca «Es un producto físico»), sin control de inventario (o «seguir vendiendo sin stock»).
- Una opción «Tramo» con **7 variantes, en este orden**:

| Variante | Precio |
|---|---|
| Hasta 5.000 puntadas | 8,75 € |
| 5.001–10.000 puntadas | 12,50 € |
| 10.001–15.000 puntadas | 16,25 € |
| 15.001–20.000 puntadas | 20,00 € |
| 20.001–30.000 puntadas | 27,50 € |
| 30.001–40.000 puntadas | 35,00 € |
| 40.001–50.000 puntadas | 42,50 € |

**2. Producto «Color adicional de bordado»**
- Igual: sin listar, tienda online, sin envío, sin inventario.
- Una sola variante a **1,00 €** (se añade con cantidad = colores adicionales × unidades).

**3. Conectar en el editor de temas**: en la sección «Estudio de diseño BR», elige los dos productos
en «Producto "Extra de bordado"» y «Producto "Color adicional de bordado"». Mientras no estén
conectados, la calculadora no se muestra (el estudio funciona como antes).

## Calibrar «puntadas por cm²»

Con 3-4 diseños que ya se hayan picado y de los que se conozcan las puntadas:

1. Abre `…/pages/disena-tu-prenda?calibrar=1`.
2. Sube el diseño (en PNG con fondo transparente o blanco) y **escálalo al tamaño real** con el que se bordó
   (mira «Tamaño de la selección ≈ … cm»; el área y contorno exactos salen en el panel de calibración).
3. Escribe el nombre y las **puntadas reales** del software de picaje → «Guardar muestra».
4. Repite con los demás diseños (mejor variados: un logo pequeño, un texto, un relleno grande).
5. El panel muestra el valor sugerido (mediana). Ponlo en «Puntadas por cm²».
   - Si los diseños con mucho texto o línea salen bajos y los rellenos bien, sube «Puntadas por cm de línea».
   - Si salen bajos los rellenos pequeños con mucho borde, sube «Puntadas extra por cm de contorno».
   - Después, recalibra.

Las muestras se guardan solo en ese navegador.

## Qué queda en el pedido

En la línea de la sudadera (y del extra), como propiedades **privadas** (prefijo `_`, ocultas en el checkout,
visibles en el pedido del admin): `_Puntadas estimadas`, `_Colores de hilo` (con los tonos detectados),
`_Tamaño del bordado`, `_Tramo`, `_Extra de bordado`. El diseño en alta, la vista 3D y la imagen original
siguen adjuntos como antes («Diseño delante», «Vista 3D delante», …).

Todo se añade al carrito **en una sola llamada** (`/cart/add.js` con `items[]`). Si Shopify rechazase esa
llamada, el estudio añade los extras por AJAX y la sudadera con el formulario de siempre.

## Limitaciones conocidas

- Es una estimación: degradados, fotos y texturas no se pueden bordar tal cual (saldrán con muchos colores).
- El blanco encerrado dentro de un logo sobre fondo blanco (el hueco de una «O») cuenta como hilo blanco.
- El extra se cobra por unidad (cantidad = unidades de sudadera), así que la cuota fija también se repite
  por unidad. Si se quiere una cuota única por pedido, habría que separarla en otro producto.
- La pestaña «Envíanos tu diseño» no calcula precio (archivos PDF/vectoriales): esos pedidos se presupuestan a mano.
- La separación relleno/línea es geométrica: no sabe qué tipo de puntada elegirá quien digitalice
  (p. ej. un texto grueso puede ir en satín). Por eso el margen es del 20 %.

## Enviar mi diseño

Botón «Enviar mi diseño» en el estudio (y en el panel cuando hace falta presupuesto).
- Envía nombre, email, teléfono opcional, talla, notas y el resumen completo: prenda, color, hilos, puntadas
  con rango, tamaño y precio estimado.
- Las imágenes (diseño y vista previa) se suben al CDN de Shopify **a través del carrito** con el producto
  oculto `br-subida-archivos` (0 €, sin listar). La línea se quita del carrito al momento y los enlaces van
  en el mensaje.
- El mensaje sale por el **formulario de contacto nativo de Shopify** y llega al email de la tienda
  (*Configuración → Notificaciones → Email del remitente / de atención al cliente*).
- Shopify no manda copia al cliente desde el formulario de contacto.
- Sin servicios externos ni de pago.
- Código: `shopify-theme/src/send-design.tsx`, `components/forms/upload-via-cart.ts`.
  El formulario «Cuéntanos tu proyecto» usa lo mismo (`src/forms-entry.ts` → `assets/br-formularios.js`):
  hasta 3 archivos de 15 MB (imagen, PDF, AI, EPS, SVG).
