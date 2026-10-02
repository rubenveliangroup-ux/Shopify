# Modelo 3D de la sudadera

El estudio "Diseña tu prenda" muestra la sudadera real en 3D a partir de un GLB preparado (por ahora, el generado con Meshy). No usa geometría básica ni modelos paramétricos. Si el 3D no es viable, pasa solo a la **vista ligera**: fotos de la misma prenda.

## Archivos

| Archivo | Qué es | Peso |
|---|---|---|
| `assets/br-sudadera.glb` | Modelo preparado y optimizado: Draco, texturas WebP de 1K, talla base M | 0,28 MB (el original de Meshy pesaba 8,68 MB) |
| `assets/br-prenda-delante.webp`, `br-prenda-detras.webp` | Fotos de la vista ligera: render neutro en blanco con la misma luz que el visor | 21 KB cada una |
| `assets/br-studio.js` | Estudio (interfaz, editor y calculadora), módulo ES | 504 KB |
| `assets/br-studio-*.js` | Visor 3D (three.js). **Solo se descarga al abrir el estudio y después de cargar la página** | 906 KB |

## Cómo se preparó el GLB de Meshy

`node shopify-theme/tools/preparar-prenda.mjs original.glb preparado.glb` hace lo siguiente:

1. **Escala.**
   - Calibra el largo con la tabla de medidas: 64 cm en la talla M, medidos desde el punto alto del hombro junto a la capucha (HPS) hasta el bajo. Meshy lo entrega en una escala arbitraria (1,9 "m" de alto).
   - Calibra el ancho de pecho en la sisa: 68,6 → 65 cm (×0,947 en ancho y fondo).
2. **Bajo:** estrecha el canalé del bajo de 46,4 a 38 cm (bajo relajado de la tabla). Encima queda la tela abullonada, como en las fotos.
3. **Material de algodón mate:**
   - quita el `metallic=1` y el mapa de metal/rugosidad;
   - deja una rugosidad fija de 0,93.
4. **Color base neutro.** El de Meshy es gris oscuro con motas claras y parches de luz horneada. Se sustituye por un mapa blanco roto (luminancia media del 93 %):
   - sin motas ni parches;
   - conserva solo el grano fino de la tela, con una variación máxima de ±6 %.

   Sobre él se tiñe por multiplicación.
5. **Normal map:** se suaviza (quita el ruido de alta frecuencia de Meshy) y se reduce al 55 %. Los pliegues vienen sobre todo de la geometría.
6. **Zonas por vértice** (`_BR_ZONA`): pesos de manga y de canalé del bajo, para cambiar de talla por zonas.
7. **Origen y orientación:** el HPS queda en el origen, con Y hacia arriba y el delantero hacia +Z.

Después se optimiza con `npm run glb:optimizar` y se generan las fotos ligeras con `node shopify-theme/tools/render-vistas.mjs`.

**Guarda el GLB original de Meshy.** Si cambias las medidas de la tabla, hay que volver a pasar estos tres pasos.

## Qué replica el modelo y qué se ha aproximado

**Lo trae el modelo:**
- hombro caído;
- manga ancha y abullonada con puño de canalé ajustado;
- capucha grande con costura central en la espalda;
- bolsillo canguro amplio;
- bajo de canalé con la tela abullonada encima.

**Lo he aproximado:**
- **Bajo recogido:** el modelo lo traía ya, pero más ancho que la tabla (46 cm). Lo he estrechado a 38 cm con una transición de 4 cm.
- **Efecto lavado:** la textura no lo trae. Lo añade el material: variación suave de tono de unos ±6 %, en manchas de unos 10 cm y vetas finas. Se calcula en el espacio de la prenda, así que no se ven las costuras de las UV.
- **Felpa mate:** brillo aterciopelado (*sheen*) en lugar de reflejos. Es algo más visible en colores oscuros, para que el negro no pierda los pliegues.

## Vista de referencia (sin simular el hilo)

El estudio 3D es solo una **referencia de colocación**: el diseño se proyecta plano sobre la prenda, a
su tamaño real en cm, con la luz de la escena. No simula relieve, puntadas ni brillo de hilo (se quitó
para que vaya ligero en móvil). El aviso al cliente está en `components/studio/aviso.ts`.

Las zonas de bordado (pecho, mangas, espalda…) se definen en cm desde el punto alto del cuello en
`components/studio/zones.ts`: las usan «Diseña tu prenda» (opción «adjuntar imagen»), el formulario
«Te lo diseñamos» y las fotos de producto (`npm run mockups`).

**Limitación:** la espalda la inventó Meshy (no viene de una foto). Por eso hay alguna arruga poco natural en la zona baja de la espalda.

## Tallas

El modelo es la talla M. Al elegir otra, se deforma por zonas:

| Zona | Cómo cambia |
|---|---|
| Largo | Todo lo que está por debajo del hombro × largo/64. La capucha no cambia de alto. |
| Pecho | Ancho y fondo de toda la prenda × pecho/65 |
| Bajo | El canalé, además, × (bajo/38)/(pecho/65) |
| Manga | Desde la costura del hombro × manga/59 |

**Cuánto afecta a la forma:**
- De XS a XXL la prenda crece un 26 % de largo y un 20 % de ancho. Respecto a la M: −9 %/−6 % en XS y +14 %/+12 % en XXL.
- Las proporciones entre zonas cambian poco:
  - el bajo respecto al pecho pasa de 0,56 (XS) a 0,60 (XXL);
  - la manga respecto al largo pasa de 0,95 a 0,89.
- **En la práctica, la forma es la misma y la prenda se ve más grande o más pequeña.** El bordado no cambia de tamaño.
- Es un escalado aproximado, no un patronaje por talla. Meshy funde las mangas con los costados, así que la separación entre manga y cuerpo es geométrica y tiene una transición de 4 cm.

## Medidas reales del bordado (px → cm)

`npm run test:3d` proyecta un diseño de 20 × 20 cm sobre la sudadera real en las 6 tallas, delante y detrás:

- **Vista de frente:** 20,00 × 20,00 cm en todas las tallas (diferencia < 0,5 mm). 1 px del editor = 0,1245 cm.
- **Siguiendo la curva del pecho:** entre 20,11 y 20,63 cm de ancho, entre un 0,5 y un 3 % más. Es lo que se estira el diseño sobre la tela curva, igual que en la prenda real en el bastidor.

## Rendimiento

**Carga**
- three.js va en un chunk aparte que se pide solo en "Diseña tu prenda", cuando la página ha terminado de cargar. Mientras tanto se ve "Cargando vista 3D…".
- Peso total del 3D: 906 KB de JS + 0,28 MB de modelo + unos 300 KB del decodificador Draco (gstatic.com, en caché).

**Ajustes en móvil**
- Resolución máxima de 1,5× (2× en escritorio).
- Sin antialias y sombra de contacto a 256 px, calculada una sola vez por talla.
- Sin amortiguación del giro.
- Deja de dibujar cuando no se toca: solo gira al principio.

**Automático**
- Si los FPS bajan de 22, baja la resolución a 1×.
- Si siguen bajos, pasa a la vista ligera.
- También pasa a la vista ligera si se pierde el contexto WebGL.

## Vista ligera (sin 3D)

**Cuándo se usa:**
- no hay WebGL;
- el dispositivo tiene 2 GB de memoria o menos, o 2 núcleos;
- está activado el ahorro de datos;
- el GLB no carga;
- el 3D va a tirones.

**Qué muestra:**
- fotos delante y detrás de la misma sudadera, teñidas del color elegido;
- el diseño encima, a su tamaño real, con relieve de puntadas y una ligera sombra.

**Qué se pierde frente al 3D:**
- no se puede girar ni ver los laterales, solo delante y detrás;
- no hay cambio de forma por talla (siempre la M);
- el diseño no se curva con los pliegues: queda plano sobre la foto, aunque con sombra y relieve;
- la luz es fija.

Para probarla: añade `?modo3d=ligero` a la URL (o `?modo3d=3d` para forzar el 3D).

## Cambiar el modelo

1. `node shopify-theme/tools/preparar-prenda.mjs original.glb preparado.glb`
   - Requisitos: una sola malla con UVs, Y hacia arriba, delantero +Z y capucha.
2. `npm run glb:optimizar -- preparado.glb shopify-theme/assets/br-sudadera.glb`
3. `node shopify-theme/tools/render-vistas.mjs shopify-theme/assets/br-sudadera.glb shopify-theme/assets`
4. `npm run test:3d`
5. Sube `br-sudadera.glb` y las dos `br-prenda-*.webp` al tema (Editar código > Assets).
   - También puedes subir el GLB en Contenido > Archivos y pegar su URL en el ajuste "URL de otro modelo 3D" de la sección.
