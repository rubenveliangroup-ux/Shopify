# BR — Arquitectura del storefront headless

> **Tú tienes la idea. Nosotros la convertimos en bordado.**

## 1. Modelo de negocio → arquitectura

BR tiene **dos embudos** con economías distintas, y la web los separa desde el primer scroll:

| Embudo | Cliente | Conversión | Dónde vive |
|---|---|---|---|
| **Colección** | Particular, compra impulsiva/regalo | Añadir al carrito → Shopify Checkout | `/tienda`, `/producto/[handle]` |
| **Diseña en 3D** | Particular que quiere crear su prenda | Diseño en el estudio → boceto gratis → pedido | `/disena` |
| **Personaliza** | Particular con idea propia | Brief + archivos → boceto gratis → pedido | `/personaliza` |
| **Marcas** | Marca, emprendedor, empresa | Brief B2B → propuesta + presupuesto | `/marcas` |

Un producto personalizado no se puede vender con un botón de "comprar" (precio depende de diseño, tamaño, colores),
así que el micro-objetivo es **el lead cualificado**, no el carrito. El "boceto gratis en 48 h" elimina el riesgo percibido
y es la palanca principal.

## 2. Stack y decisiones técnicas

- **Next.js 14 (App Router) + TypeScript + Tailwind.** Server Components por defecto; JS de cliente solo en carrito, galería, selector de variantes y formularios (~100 kB First Load).
- **Shopify Storefront API** (`lib/shopify`): cliente `fetch` sin SDK, fragments GraphQL validados contra el schema, cache tags (`products`, `collections`).
- **ISR + webhooks**: páginas estáticas con `revalidate = 3600` y `/api/revalidate` (firma HMAC de Shopify) para invalidar al instante cuando cambia un producto.
- **Carrito hidratado en cliente** (`/api/cart` + Server Actions): las páginas de catálogo no leen cookies, así que siguen siendo estáticas y se sirven desde CDN. Cookie `br_cart` httpOnly. Updates optimistas.
- **Checkout = Shopify Checkout** (`cart.checkoutUrl`): pagos, impuestos, envíos y descuentos se gestionan en Shopify.
- **Catálogo de respaldo** (`lib/shopify/fallback.ts`): si la API no responde, las lecturas usan un snapshot del catálogo para no romper la tienda. El carrito nunca usa respaldo.
- **Briefs** (`/api/brief`): validación con zod, honeypot anti-spam, archivos (PNG/JPG/WEBP/SVG/PDF ≤ 8 MB, máx 4) reenviados a `BRIEF_WEBHOOK_URL` (Make/Zapier/n8n → email, Slack, Notion, CRM). En producción sin webhook devuelve error visible en vez de perder el lead.
- **SEO**: metadata por página, JSON-LD `Product` y `FAQPage`, `sitemap.xml`, `robots.txt`, canonical.
- **Seguridad**: solo el token *Storefront* se usa, y en servidor. El token *Admin* **no** forma parte del frontend.

```
app/
  page.tsx                 Home: hero, dos caminos, colección, proceso, por qué bordado, FAQ, CTA
  tienda/                  Catálogo con orden
  producto/[handle]/       PDP (SSG): galería, variantes, ATC fijo móvil, garantías, cross-sell a Personaliza
  personaliza/             Brief particular con subida de archivos
  marcas/                  Landing B2B + brief
  api/cart | brief | revalidate
components/                UI (cart/, product/, brief-form, faq…)
lib/shopify/               Cliente, queries, fragments, tipos, fallback
lib/content.ts, site.ts    Copy y datos de marca editables
```

## 2b. Estudio de diseño 3D (`/disena`)

Botón principal del hero. El cliente crea su diseño y lo ve sobre la prenda antes de pedir el boceto.

- **Editor 2D** (`components/studio/design-editor.tsx`, Fabric.js): subir imagen (o arrastrar), texto con 4 tipografías, dibujo a mano, 12 colores de hilo, mover/escalar/rotar, deshacer. El diseño se guarda en el navegador (localStorage) para no perderlo al recargar.
- **Vista 3D** (`components/studio/garment-3d.tsx`, three.js + react-three-fiber): prenda procedural (sudadera, hoodie, camiseta) sin modelos externos; el diseño se proyecta como *decal* en pecho, centro o espalda, con tamaño ajustable y 7 colores de tejido.
- **Efecto bordado** (`embroidery.ts`): puntadas de satén y relieve simulados sobre la textura.
- **Envío**: genera `diseno.png` (alta resolución), `vista-3d.jpg` y adjunta la imagen original, y los manda a `/api/brief` con prenda, color, posición, tallas y notas.
- Se carga solo en cliente (`next/dynamic`, `ssr: false`), así que no pesa en el resto de páginas.
- Nota de despliegue: en Vercel el cuerpo de una petición está limitado a ~4,5 MB; si los clientes suben imágenes muy pesadas, mover la subida a almacenamiento directo (p. ej. Vercel Blob o Shopify Files).

## 3. Psicología del color

Posicionamiento: **estudio de diseño textil**, no imprenta de personalización. La paleta evita el azul "corporativo" y los
neones de la personalización barata; parte de materiales reales (lino, tinta, hilo).

| Token | Hex | Rol | Por qué |
|---|---|---|---|
| `lino` | `#F5F0E8` | Fondo | Blanco roto cálido = tejido natural, artesanía, premium. Reduce fatiga frente al blanco puro. |
| `tinta` | `#171412` | Texto, botones secundarios | Negro cálido: sofisticación y contraste AAA sin la dureza del #000. |
| `hilo` | `#C2461F` | **CTA único** | Rojo-terracota: energía y acción (rojo) templada por calidez artesanal (naranja tierra). Es el único color saturado de la web → el ojo va siempre al botón. Contraste AA con blanco. |
| `bosque` | `#1E3A2F` | Confianza, B2B, garantías | Verde profundo = estabilidad, calidad, "hecho con cuidado". Diferencia visualmente el embudo de marcas. |
| `oro` | `#B98A3E` | Detalles | Hilo dorado: toque premium, usado con moderación. |

Reglas: un solo color de acción (`hilo`) por pantalla; el verde nunca compite como CTA en el embudo particular.
El separador "pespunte" (`.stitch`) es el recurso gráfico de marca.

## 4. Patrones CRO aplicados

- **Hero con propuesta de valor en 5 s** + 2 CTA jerarquizados + 3 micro-garantías (boceto gratis, desde 1 ud., envío España).
- **Autoselección de camino** (Particular / Marca) justo tras el hero.
- **Reversión de riesgo**: boceto gratis y "no bordamos hasta que lo apruebas" repetido en hero, proceso, PDP y formulario.
- **Barra de envío gratis** con progreso en el carrito (sube AOV). Umbral en `lib/utils.ts`.
- **ATC fijo en móvil** cuando el botón principal sale de pantalla.
- **Cross-sell PDP → Personaliza**: captura al que le gusta el estilo pero quiere su propio diseño.
- **Formularios cortos por bloques**, subida por arrastre o cámara, errores inline, estado de éxito con expectativa clara (48 h).
- **FAQ que desmonta objeciones** (precio, mínimos, plazos, devoluciones de personalizados) + JSON-LD para SEO.
- Rendimiento como CRO: páginas estáticas, `next/image` AVIF/WebP, fuentes `display: swap`.

## 5. Checklist para producción (catálogo Shopify)

Estado de la tienda (01/10/2026): 6 sudaderas a 49,90 €.

1. ✅ **Tallas**: opción *Talla* S, M, L, XL y XXL creada en las 6 sudaderas (30 variantes, 49,90 €).
2. ✅ **Venta bajo pedido**: todas las variantes con "Seguir vendiendo sin stock" (inventario 0, producción bajo pedido).
3. ✅ **Descripciones y SEO** redactados en las 6 sudaderas (+ tipo de producto, etiquetas y proveedor "BR").
4. **Fotos reales** de prenda y primer plano del bordado (varias por producto: la galería y el hover las aprovechan).
5. **Reseñas reales** (Judge.me / Okendo) — no se han inventado testimonios.
6. Revisar y ajustar las cifras de negocio en `lib/site.ts` y `lib/content.ts` (plazos, mínimo 25 uds., umbral de envío, email).
7. Webhooks Shopify `products/*` y `collections/*` → `/api/revalidate`.
8. Logo definitivo en `components/logo.tsx`.
