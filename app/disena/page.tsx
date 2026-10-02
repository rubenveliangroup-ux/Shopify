import type { Metadata } from 'next';
import { Anton, Pacifico } from 'next/font/google';
import { StudioLoader } from '@/components/studio/studio-loader';

// Tipografías extra disponibles para los textos del diseño
const script = Pacifico({ subsets: ['latin'], weight: '400', variable: '--font-script', display: 'swap' });
const bold = Anton({ subsets: ['latin'], weight: '400', variable: '--font-bold', display: 'swap' });

export const metadata: Metadata = {
  title: 'Diseña tu prenda bordada en 3D',
  description:
    'Sube tu dibujo o foto, escribe o dibuja y mira cómo queda bordado sobre la sudadera con capucha en 3D. Boceto gratis en 48 h.'
};

export default function DisenaPage() {
  return (
    <div className={`${script.variable} ${bold.variable}`}>
      {/* Misma sudadera y fotos que el tema de Shopify (copias de shopify-theme/assets) */}
      <StudioLoader
        garmentIds={['hoodie']}
        model={{
          url: '/prenda/br-sudadera.glb',
          liteImages: { delante: '/prenda/br-prenda-delante.webp', detras: '/prenda/br-prenda-detras.webp' },
          sizes: [
            { talla: 'XS', largo: 58, pecho: 61, bajo: 34, manga: 55 },
            { talla: 'S', largo: 61, pecho: 63, bajo: 36, manga: 57 },
            { talla: 'M', largo: 64, pecho: 65, bajo: 38, manga: 59 },
            { talla: 'L', largo: 67, pecho: 67, bajo: 40, manga: 61 },
            { talla: 'XL', largo: 70, pecho: 70, bajo: 42, manga: 63 },
            { talla: 'XXL', largo: 73, pecho: 73, bajo: 44, manga: 65 }
          ]
        }}
      />
    </div>
  );
}
