import { createRoot } from 'react-dom/client';
import { DesignStudio } from '@/components/studio/design-studio';
import { ShopifyAddToCart, type ShopifyVariant } from './add-to-cart';

type Config = {
  variants: ShopifyVariant[];
  price: string;
  cartAddUrl: string;
  altHref: string;
};

function mount() {
  const root = document.getElementById('br-studio');
  const data = document.getElementById('br-studio-config');
  if (!root || !data) return;
  const config = JSON.parse(data.textContent || '{}') as Config;

  if (!config.variants?.length) {
    root.innerHTML = '<p style="padding:2rem;text-align:center">Configura el producto personalizable en el editor de temas.</p>';
    return;
  }

  createRoot(root).render(
    <DesignStudio
      garmentIds={['sudadera']}
      altHref={config.altHref}
      priceNote={`Sudadera personalizada: ${config.price}`}
      ctaLabel="Elegir talla y añadir al carrito"
      highlights={['Te enviamos el boceto para aprobar antes de bordar', `Producción en 7–10 días laborables`]}
      renderCheckout={(p) => (
        <ShopifyAddToCart {...p} variants={config.variants} price={config.price} cartAddUrl={config.cartAddUrl} />
      )}
    />
  );
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
else mount();
