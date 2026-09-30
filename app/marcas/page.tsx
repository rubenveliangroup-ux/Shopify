import type { Metadata } from 'next';
import Link from 'next/link';
import { BriefForm } from '@/components/brief-form';
import { Faq, faqJsonLd } from '@/components/faq';
import { ArrowIcon } from '@/components/icons';
import { SectionHeading } from '@/components/section';
import { brandFaq } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Bordado para marcas: diseño y producción',
  description: 'Diseñamos y bordamos para marcas de ropa, emprendedores y empresas: logos, colecciones cápsula y merchandising premium desde 25 unidades.'
};

const services = [
  { title: 'Diseño para bordado', text: 'Creamos o adaptamos vuestro logo, ilustración o colección al lenguaje del hilo: puntadas, densidades y colores pensados para tela.' },
  { title: 'Producción', text: 'Bordado en nuestro taller sobre prendas premium o sobre vuestra propia prenda. Control de calidad pieza a pieza.' },
  { title: 'Colecciones cápsula', text: 'Acompañamiento de concepto a entrega: moodboard, diseños, muestra física y producción de la serie.' },
  { title: 'Merch y uniformes', text: 'Ropa de equipo, eventos y regalos corporativos que la gente realmente quiere ponerse.' }
];

const steps = [
  ['Brief', 'Nos contáis marca, producto, volumen y plazos.'],
  ['Propuesta', 'Diseño adaptado + presupuesto por volumen en 24–48 h.'],
  ['Muestra', 'Pre-serie o muestra física para validar hilo y prenda.'],
  ['Producción', 'Serie completa, control de calidad y envío o entrega.']
];

export default function MarcasPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(brandFaq)) }} />

      <section className="bg-bosque text-lino">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-[1.3fr_1fr] lg:items-end lg:py-28">
          <div>
            <p className="eyebrow text-lino/60">Para marcas, emprendedores y empresas</p>
            <h1 className="mt-4 text-5xl leading-[1.02] sm:text-7xl">Vuestra identidad, <em className="font-normal italic text-oro">bordada</em>.</h1>
            <p className="mt-6 max-w-xl text-lg text-lino/80">
              Un estudio de diseño textil que también produce. Llevamos logos, ilustraciones y colecciones al bordado con el cuidado de una marca premium.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="#brief" className="btn bg-lino px-8 py-4 text-base text-bosque hover:bg-white">Pedir presupuesto <ArrowIcon className="h-4 w-4" /></Link>
              <Link href="#proceso" className="btn border border-lino/30 px-8 py-4 text-base hover:bg-lino/10">Ver proceso</Link>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-lino/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            {[['25', 'uds. mínimo'], ['48 h', 'propuesta'], ['1:1', 'muestra previa']].map(([n, l]) => (
              <div key={l}><dt className="font-display text-4xl">{n}</dt><dd className="mt-1 text-xs uppercase tracking-wider text-lino/60">{l}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="container-page mt-24">
        <SectionHeading eyebrow="Servicios" title="Diseño + producción bajo el mismo techo" text="Sin intermediarios entre quien diseña y quien borda: menos errores, mejor acabado." />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {services.map((s, i) => (
            <div key={s.title} className="rounded-3xl bg-lino-100 p-8 ring-1 ring-tinta/10">
              <span className="font-display text-sm text-hilo">0{i + 1}</span>
              <h3 className="mt-2 text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-tinta-700">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="proceso" className="container-page mt-24 scroll-mt-20">
        <SectionHeading eyebrow="Proceso" title="Cómo trabajamos con marcas" />
        <ol className="mt-12 grid gap-8 md:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-tinta font-semibold text-lino">{i + 1}</span>
              <div className="stitch my-4 text-tinta/20" />
              <h3 className="font-sans text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-tinta-700">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="brief" className="container-page mt-24 grid scroll-mt-20 gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionHeading eyebrow="Brief" title="Contadnos el proyecto" text="Con esta información os enviamos propuesta de diseño y presupuesto por volumen en 24–48 h laborables." />
          <div className="mt-10"><Faq items={brandFaq} /></div>
        </div>
        <BriefForm tipo="marca" />
      </section>
    </>
  );
}
