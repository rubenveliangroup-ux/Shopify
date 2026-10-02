import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import { AnnouncementBar } from '@/components/announcement-bar';
import { CartProvider } from '@/components/cart/cart-context';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { site } from '@/lib/site';
import { siteUrl } from '@/lib/utils';
import './globals.css';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display', display: 'swap', axes: ['SOFT', 'opsz'] });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${site.fullName} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  openGraph: { type: 'website', locale: 'es_ES', siteName: site.fullName, images: ['/marca/br-og.jpg'] },
  icons: { icon: '/marca/br-favicon.png', apple: '/marca/br-favicon.png' },
  twitter: { card: 'summary_large_image' }
};

export const viewport: Viewport = { themeColor: '#F5F0E8' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>
        <CartProvider>
          <AnnouncementBar />
          <Header />
          <main id="contenido">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
