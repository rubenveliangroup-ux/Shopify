# BR — Storefront headless (Next.js 14 + Shopify)

Tienda headless del estudio de bordado **BR**. Ver [ARCHITECTURE.md](./ARCHITECTURE.md) para decisiones de arquitectura, paleta y CRO.

## Puesta en marcha

```bash
cp .env.example .env.local   # rellena SHOPIFY_STOREFRONT_ACCESS_TOKEN y el resto
npm install
npm run dev                  # http://localhost:3000
```

Sin credenciales la web funciona con el catálogo de respaldo (sin carrito).

## Scripts

- `npm run dev` · `npm run build` · `npm start`
- `npm run lint` · `npm run typecheck`

## Despliegue (Vercel recomendado)

1. Importar el repo en Vercel y añadir las variables de `.env.example`.
2. En Shopify Admin → Configuración → Notificaciones → Webhooks: crear `products/update`, `products/create`, `products/delete`, `collections/update` apuntando a `https://<dominio>/api/revalidate`; copiar la clave de firma a `SHOPIFY_REVALIDATION_SECRET`.
3. Configurar `BRIEF_WEBHOOK_URL` (Make/Zapier/n8n) para recibir los briefs de Personaliza y Marcas.
4. En Shopify, instalar el canal *Headless* y usar su token Storefront.
