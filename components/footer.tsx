import Link from 'next/link';
import { site } from '@/lib/site';
import { Logo } from './logo';

export function Footer() {
  return (
    <footer className="mt-24 bg-tinta text-lino">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="crema" />
          <p className="mt-4 max-w-xs font-display text-2xl leading-snug">{site.tagline}</p>
          <div className="stitch mt-6 w-40 text-oro" />
        </div>
        <FooterCol title="Comprar" links={[['/tienda', 'Colección'], ['/disena', 'Diseña tu prenda en 3D'], ['/personaliza', 'Te lo diseñamos nosotros'], ['/#faq', 'Preguntas frecuentes']]} />
        <FooterCol title="Marcas" links={[['/marcas', 'Diseño + producción'], ['/marcas#proceso', 'Proceso'], ['/marcas#brief', 'Pedir presupuesto']]} />
        <div>
          <p className="eyebrow text-lino/60">Contacto</p>
          <ul className="mt-4 space-y-2 text-sm text-lino/80">
            <li><a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a></li>
            {site.whatsapp && <li><a href={`https://wa.me/${site.whatsapp}`} className="hover:text-white">WhatsApp</a></li>}
            <li><a href={site.instagram} className="hover:text-white" rel="noopener" target="_blank">Instagram</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-lino/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-lino/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {site.fullName}. Hecho en España.</p>
          <p>Envíos a toda España.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow text-lino/60">{title}</p>
      <ul className="mt-4 space-y-2 text-sm text-lino/80">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="hover:text-white">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
