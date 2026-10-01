# Calculadora de bordado del estudio 3D

Estima en el navegador las **puntadas** y los **colores de hilo** del diseño del cliente y muestra en vivo
el **extra de bordado** por tramos. No genera el archivo de bordado (el picaje real se hace aparte):
es solo una estimación para fijar precio. Cada pedido se revisa a mano antes de producir.

## Cómo estima

1. Toma el diseño de cada lado (delante / detrás) a su **tamaño real en cm** sobre la prenda
   (la misma escala que el estudio: 600 px del lienzo ≈ 74,7 cm, talla M) y lo renderiza a ≈ 0,5 mm/píxel.
2. Quita el **fondo blanco** de las imágenes subidas (relleno desde los bordes) y el transparente.
   El texto o el dibujo blanco hecho en el estudio sí cuenta.
3. **Colores**: k-means en espacio Lab (semilla fija, resultado estable), fusiona tonos parecidos
   (ΔE < 18), descarta los halos de suavizado/JPG y los colores < 1 % del diseño
   (salvo detalles visibles ≥ 0,2 cm², p. ej. unos ojos). Delante y detrás comparten paleta.
4. **Puntadas** = área cubierta (cm²) × `puntadasPorCm2` + contorno (cm) × `puntadasPorCmBorde`,
   sumando delante y detrás, y después **+ margen de seguridad** (10 % por defecto).
5. **Tramo** según los topes; **colores adicionales** = colores − 1. Más de 12 colores → aviso para
   simplificar (no deja comprar). Más de 20.000 puntadas → «sujeto a presupuesto»: el cliente añade
   solo la prenda, sin pagar el extra.
6. **Avisos**: diseño muy pequeño (< 1,5 cm), líneas < 1 mm y fondo blanco ignorado.

Código: `components/studio/embroidery-estimate.ts` (análisis), `embroidery-pricing.ts` (precios y tramos),
`embroidery-panel.tsx` (panel y modo calibración).

## Dónde se configura (un único sitio)

**Editor de temas → página «Diseña tu prenda» → sección «Estudio de diseño BR» → «Calculadora de bordado»**:

| Ajuste | Valor inicial | Notas |
|---|---|---|
| Puntadas por cm² | 150 | **Provisional: calibrar** (ver abajo) |
| Puntadas extra por cm de contorno | 5 | Provisional |
| Margen de seguridad | 10 % | Se aplica antes de asignar tramo |
| Topes de los tramos | 5000, 10000, 15000, 20000 | Por encima del último: presupuesto |
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
- Una opción «Tramo» con **4 variantes, en este orden**:

| Variante | Precio |
|---|---|
| Hasta 5.000 puntadas | 8,75 € |
| 5.001–10.000 puntadas | 12,50 € |
| 10.001–15.000 puntadas | 16,25 € |
| 15.001–20.000 puntadas | 20,00 € |

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
5. El panel muestra el valor sugerido (mediana). Ponlo en «Puntadas por cm²». Si los diseños con mucho
   texto o línea salen bajos y los rellenos bien, sube «Puntadas extra por cm de contorno» y recalibra.

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
