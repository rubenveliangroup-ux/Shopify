import Image from 'next/image';
import Link from 'next/link';
import { Faq, faqJsonLd } from '@/components/faq';
import { ArrowIcon, CheckIcon, NeedleIcon, ShieldIcon, SparkIcon, TruckIcon } from '@/components/icons';
import { ProductGrid } from '@/components/product-card';
import { SectionHeading } from '@/components/section';
import { benefits, homeFaq, processSteps } from '@/lib/content';
import { getProducts } from '@/lib/shopify';
import { site } from '@/lib/site';

export const revalidate = 3600;

export default async function HomePage() {
  const products = await getProducts({ first: 8 });
  const heroImages = products.slice(0, 3).map((p) => p.featuredImage).filter(Boolean);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(homeFaq)) }} />

      {/* HERO — propuesta de valor + dos CTA (camino principal y secundario) */}
      <section className="container-page grid items-center gap-10 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24 lg:pt-16">
        <div>
          <p className="eyebrow flex items-center gap-2"><NeedleIcon className="h-4 w-4 text-hilo" /> Estudio de diseño textil · España</p>
          <h1 className="mt-5 text-[2.75rem] leading-[1.02] sm:text-6xl lg:text-7xl">
            Tú tienes la idea.
            <br />
            <em className="font-normal italic text-hilo">Nosotros</em> la convertimos en bordado.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-tinta-700">
            Sudaderas y camisetas premium bordadas a partir de tu dibujo, tu foto o tu logo. Te enseñamos el boceto gratis antes de dar una sola puntada.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/disena" className="btn-primary px-8 py-4 text-base">
              Diseña tu prenda <ArrowIcon className="h-4 w-4" />
            </Link>
            <Link href="/tienda" className="btn-ghost px-8 py-4 text-base">Ver el catálogo</Link>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-tinta-700 sm:grid-cols-3">
            {['Boceto gratis en 48 h', 'Desde 1 unidad', 'Envío a toda España'].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckIcon className="h-4 w-4 text-bosque" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative grid grid-cols-5 grid-rows-6 gap-3 sm:gap-4" style={{ aspectRatio: '1 / 1.05' }}>
          {heroImages[0] && (
            <div className="relative col-span-3 row-span-6 overflow-hidden rounded-3xl bg-lino-200">
              <Image src={heroImages[0].url} alt={heroImages[0].altText ?? ''} fill priority sizes="(min-width:1024px) 30vw, 60vw" className="object-cover" />
            </div>
          )}
          {heroImages.slice(1).map((img) => (
            <div key={img!.url} className="relative col-span-2 row-span-3 overflow-hidden rounded-3xl bg-lino-200">
              <Image src={img!.url} alt={img!.altText ?? ''} fill sizes="(min-width:1024px) 20vw, 40vw" className="object-cover" />
            </div>
          ))}
          <div className="absolute -bottom-4 left-4 rounded-2xl bg-lino-100 px-4 py-3 shadow-xl sm:left-8">
            <p className="text-xs text-tinta-500">De boceto a prenda</p>
            <p className="font-display text-lg">{site.productionDays} días</p>
          </div>
        </div>
      </section>

      {/* DOS CAMINOS — autoselección particular / marca */}
      <section className="container-page grid gap-4 md:grid-cols-2">
        <PathCard
          href="/disena"
          tone="light"
          eyebrow="Para ti"
          title="Tu prenda, tu diseño"
          text="Convierte un dibujo, una mascota, una frase o un recuerdo en una sudadera única. Desde 1 unidad."
          cta="Diseñar mi prenda en 3D"
        />
        <PathCard
          href="/marcas"
          tone="dark"
          eyebrow="Para marcas y empresas"
          title="Diseño + producción de bordado"
          text="Logos, colecciones cápsula y merch con acabado premium. Desde 25 unidades, con muestra previa."
          cta="Pedir presupuesto"
        />
      </section>

      {/* COLECCIÓN */}
      <section className="container-page mt-24">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading eyebrow="Colección" title="Galicia, puntada a puntada" text="Nuestros propios diseños: iconos gallegos bordados sobre sudaderas oversize." />
          <Link href="/tienda" className="btn-ghost shrink-0">Ver todo <ArrowIcon className="h-4 w-4" /></Link>
        </div>
        <div className="mt-10"><ProductGrid products={products} /></div>
      </section>

      {/* PROCESO */}
      <section id="proceso" className="mt-28 scroll-mt-20 bg-lino-200/60 py-20">
        <div className="container-page">
          <SectionHeading align="center" eyebrow="Cómo funciona" title="De tu idea a tu armario en 4 pasos" text="Sin sorpresas: ves el diseño antes de producir y no bordamos nada hasta que lo apruebas." />
          <ol className="mt-14 grid gap-8 md:grid-cols-4">
            {processSteps.map((s) => (
              <li key={s.n} className="relative">
                <span className="font-display text-5xl text-hilo/80">{s.n}</span>
                <div className="stitch my-4 w-full text-tinta/20" />
                <h3 className="font-sans text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-tinta-700">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 text-center">
            <Link href="/disena" className="btn-primary px-8 py-4 text-base">Empezar con mi idea <ArrowIcon className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* POR QUÉ BORDADO */}
      <section className="container-page mt-24 grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <SectionHeading eyebrow="Por qué bordado" title={<>No es un estampado.<br />Es una pieza hecha con hilo.</>} />
        <div className="grid gap-8 sm:grid-cols-2">
          {benefits.map((b) => (
            <div key={b.title}>
              <SparkIcon className="h-6 w-6 text-oro" />
              <h3 className="mt-3 font-sans text-base font-semibold">{b.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-tinta-700">{b.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* GARANTÍAS */}
      <section className="container-page mt-24">
        <div className="grid gap-6 rounded-3xl border border-tinta/10 bg-lino-100 p-8 sm:grid-cols-3">
          <Guarantee icon={<SparkIcon className="h-6 w-6" />} title="Boceto antes de producir" text="Aprobado por ti, siempre." />
          <Guarantee icon={<ShieldIcon className="h-6 w-6" />} title="Garantía de bordado" text="Si hay un defecto, lo repetimos gratis." />
          <Guarantee icon={<TruckIcon className="h-6 w-6" />} title="Envío con seguimiento" text="A toda España, con número de seguimiento." />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="container-page mt-24 grid scroll-mt-20 gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading eyebrow="Dudas" title="Preguntas frecuentes" text={<>¿Algo más? Escríbenos a <a className="underline" href={`mailto:${site.email}`}>{site.email}</a></>} />
        <Faq items={homeFaq} />
      </section>

      {/* CTA FINAL */}
      <section className="container-page mt-24">
        <div className="relative overflow-hidden rounded-[2rem] bg-hilo px-6 py-16 text-center text-white sm:px-16">
          <h2 className="mx-auto max-w-2xl text-4xl leading-tight sm:text-5xl">¿Tienes una idea rondando la cabeza?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/85">Cuéntanosla. En 48 h tienes un boceto de cómo quedaría bordada. Gratis y sin compromiso.</p>
          <Link href="/personaliza" className="btn mt-8 bg-white px-8 py-4 text-base text-hilo hover:bg-lino">
            Quiero mi boceto gratis <ArrowIcon className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}

function PathCard({ href, tone, eyebrow, title, text, cta }: { href: string; tone: 'light' | 'dark'; eyebrow: string; title: string; text: string; cta: string }) {
  const dark = tone === 'dark';
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-3xl p-8 transition sm:p-10 ${dark ? 'bg-bosque text-lino hover:bg-bosque-600' : 'bg-lino-100 ring-1 ring-tinta/10 hover:ring-tinta/30'}`}
    >
      <div>
        <p className={`eyebrow ${dark ? 'text-lino/60' : ''}`}>{eyebrow}</p>
        <h2 className="mt-3 text-3xl sm:text-4xl">{title}</h2>
        <p className={`mt-3 max-w-md ${dark ? 'text-lino/80' : 'text-tinta-700'}`}>{text}</p>
      </div>
      <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold">
        {cta} <ArrowIcon className="h-4 w-4 transition group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function Guarantee({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-bosque-100 text-bosque">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-tinta-700">{text}</p>
      </div>
    </div>
  );
}
