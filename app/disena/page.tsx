import type { Metadata } from 'next';
import { Anton, Pacifico } from 'next/font/google';
import { StudioLoader } from '@/components/studio/studio-loader';

// Tipografías extra disponibles para los textos del diseño
const script = Pacifico({ subsets: ['latin'], weight: '400', variable: '--font-script', display: 'swap' });
const bold = Anton({ subsets: ['latin'], weight: '400', variable: '--font-bold', display: 'swap' });

export const metadata: Metadata = {
  title: 'Diseña tu prenda bordada en 3D',
  description:
    'Sube tu dibujo o foto, escribe o dibuja y mira cómo queda bordado sobre una sudadera, hoodie o camiseta en 3D. Boceto gratis en 48 h.'
};

export default function DisenaPage() {
  return (
    <div className={`${script.variable} ${bold.variable}`}>
      <StudioLoader />
    </div>
  );
}
