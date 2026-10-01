# Modelo 3D de la sudadera (GLB)

El estudio "Diseña tu prenda" ya está preparado para cargar un modelo 3D profesional. Mientras no
haya uno válido, usa la sudadera 3D básica de siempre. Si el GLB falla (no carga, no tiene UVs,
escala imposible…), vuelve sola al modelo básico y deja el motivo en la consola del navegador.

## Qué hace el estudio con el GLB

- **Teñido por multiplicación**: color elegido × textura base del modelo. Se conservan sombras, pliegues y felpa.
- **Iluminación de estudio** (HDRI generado en el navegador, sin descargas) y tejido PBR del propio modelo.
- **Bordado proyectado** delante y detrás sobre la malla del cuerpo, con relieve de puntada (normal map generado del diseño).
- **Tallas XS–XXL**: con morph targets llamados como la talla; si no tiene, escala la talla base (ancho por pecho, alto por largo).
- **Medidas reales**: 1 px del editor = 0,1245 cm sobre la prenda en todas las tallas (`npm run test:3d`). Un logo de 10 cm mide 10 cm en S y en XXL.
- **Silueta real** de la prenda (render del modelo) como fondo del lienzo de edición, en la talla elegida.
- Giro táctil, zoom con dos dedos y capturas delante/detrás para el pedido, igual que antes.

## Ficha para encargarlo o comprarlo

Pásala tal cual al modelador o úsala para revisar un modelo antes de comprarlo.

**Prenda**: sudadera con capucha oversize, corte cuadrado y algo corto (boxy cropped):
- hombro caído y manga ancha y larga;
- capucha grande con costura central;
- bolsillo canguro;
- canalé en bajo y puños, con el bajo ligeramente recogido.

Sin estampados, logos ni etiquetas visibles. Modelo hueco tipo maniquí invisible (ghost mannequin): sin cuerpo ni maniquí, con el interior visible por el cuello y el bajo.

**Medidas de la talla base M** (prenda en plano, cm). Si el modelo trae tallas (opcional, recomendado), serán *morph targets* con estos nombres:

| Talla | Largo | Pecho | Bajo relajado | Manga |
|---|---|---|---|---|
| XS | 58 | 61 | 34 | 55 |
| S | 61 | 63 | 36 | 57 |
| **M** | **64** | **65** | **38** | **59** |
| L | 67 | 67 | 40 | 61 |
| XL | 70 | 70 | 42 | 63 |
| XXL | 73 | 73 | 44 | 65 |

**Técnico**

- **Formato y orientación:**
  - glTF 2.0 binario (`.glb`);
  - **metros**, **Y hacia arriba**, delantero mirando a **+Z**;
  - sin animación ni esqueleto.
- **Mallas separadas con nombre:**
  - obligatorias: `Cuerpo`, `Capucha`, `Bolsillo`;
  - recomendadas: `Manga_izq`, `Manga_der`, `Punos`, `Bajo`, `Cordones`;
  - opcional: un nodo vacío `ancla_cuello` en el punto alto del hombro, en el centro.
- **Malla:** 30.000–120.000 triángulos con caída y pliegues reales y normales hacia fuera.
- **UVs** desplegados en 0–1, **sin solapes** (tampoco simétricos superpuestos).
- **Material** PBR metal/rugosidad:
  - **color base blanco o gris claro neutro** con la oclusión horneada (si es gris oscuro o de color, el teñido falla);
  - **normal map** de felpa y canalé;
  - rugosidad ≈ 0,85–0,95;
  - metal 0.
- **Texturas** de 2048 px como máximo (las reduce el script).
- **Peso** final menor de 5 MB tras optimizar.

**Dónde conseguirlo**

1. **Encargo** a un modelador de ropa en CLO3D o Marvelous Designer a partir de vuestro patrón o de una prenda real. Es la opción más fiel: la caída es simulada y puede entregar las tallas como morph targets. Pide UVs sin solapes y la exportación a GLB con esta ficha.
2. **Compra** de un modelo de *oversized hoodie* en CGTrader, TurboSquid o Sketchfab:
   - con **licencia comercial**;
   - con UVs y texturas PBR;
   - sin logos.

   Pásale el validador *antes* de usarlo. Si el color base es oscuro, hay que aclararlo.
3. Los generadores automáticos de imagen a 3D **no sirven**: dan mallas sin UVs limpias ni medidas reales.

## Flujo para ponerlo en la tienda

```bash
# 1. Revisar (sale con error si falla algo obligatorio)
npm run glb:validar -- sudadera.glb

# 2. Optimizar: limpia, texturas a 2K WebP, geometría Draco; informa del peso antes y después
npm run glb:optimizar -- sudadera.glb sudadera-web.glb
#    --meshopt  geometría Meshopt (el decodificador va dentro de br-studio.js, no descarga nada)
#    --ktx2     texturas KTX2 (requiere instalar KTX-Software, comando "toktx")
#    --max 1024 si sigue pesando más de 5 MB

# 3. Revisar otra vez el optimizado
npm run glb:validar -- sudadera-web.glb
```

4. En Shopify, **Contenido > Archivos > Subir** `sudadera-web.glb` y copia su URL.
5. Abre **Tienda online > Temas > Personalizar** y ve a la página "Diseña tu prenda". En la sección **Estudio de diseño BR > Modelo 3D**, pega la URL en *URL del modelo 3D (.glb)* y guarda.
   - Si el campo se deja vacío, se usa el modelo 3D del producto personalizable, si tiene uno. Es mejor la opción de Archivos: Shopify puede tratar las imágenes 3D de producto.
6. Abre la página y comprueba que aparece el selector de tallas sobre el visor: eso indica que el GLB ha cargado. Si no aparece, la consola del navegador dice por qué.

## Limitaciones

- **Dónde va el bordado:** solo sobre la malla `Cuerpo` (delante y espalda), no sobre mangas ni capucha. En la espalda, la capucha tapa la parte alta del diseño, igual que en la prenda real.
- **Tallas sin morph targets:** el escalado es proporcional (pecho y largo) y no cambia la manga por separado. Con morph targets cada talla es exacta.
- **Proyección:** se hace de frente. En los costados muy curvos el diseño se estira un poco, como un bordado real que llega al costado.
- **Decodificadores:** un GLB con Draco descarga una vez el decodificador (unos 300 KB, de gstatic.com) y uno con KTX2 el transcodificador Basis (jsdelivr). Con `--meshopt` y WebP no se descarga nada extra.
- **Peso del JS:** `br-studio.js` pasa de 1,36 MB a 1,51 MB por el cargador GLB.
- **Realismo:** depende del modelo. El estudio no inventa pliegues ni tejido; si el modelo no los trae, no aparecen.
- **Validación:** se ha probado con un modelo de prueba (un tubo con UVs, no apto para la tienda) en una tienda simulada. El primer GLB real hay que revisarlo en la vista previa del tema.
