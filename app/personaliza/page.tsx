import type { Metadata } from 'next';
import { BriefForm } from '@/components/brief-form';
import { CheckIcon } from '@/components/icons';
import { processSteps } from '@/lib/content';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Personaliza tu prenda bordada',
  description: 'Envíanos tu dibujo, foto o idea y te preparamos un boceto de bordado gratis en 48 h. Sudaderas y camisetas premium desde 1 unidad.'
};

const ideas = ['El dibujo de tu peque', 'Tu mascota', 'Una frase o fecha', 'El escudo de tu pueblo', 'Un regalo de pareja', 'Tu ilustración'];

export default function PersonalizaPage() {
  return (
    <div className="container-page pt-12">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.25fr] lg:gap-16">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">Personaliza</p>
          <h1 className="mt-3 text-4xl leading-[1.05] sm:text-6xl">
            Cuéntanos tu idea.
            <br />
            <em className="font-normal italic text-hilo">Te la dibujamos en hilo.</em>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-tinta-700">
            Rellena el brief en 2 minutos. En 48 h te enviamos un boceto de cómo quedará bordado sobre la prenda, con precio cerrado.
          </p>

          <ul className="mt-8 space-y-3">
            {['Boceto digital gratis y sin compromiso', 'Desde 1 unidad', 'Cambios incluidos hasta que te encante', `Producción en ${site.productionDays} días tras aprobarlo`].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-bosque text-lino"><CheckIcon className="h-3.5 w-3.5" /></span>{t}</li>
            ))}
          </ul>

          <div className="mt-10">
            <p className="text-sm font-medium">Ideas que nos llegan a menudo:</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ideas.map((i) => <span key={i} className="rounded-full border border-tinta/15 px-3 py-1.5 text-sm">{i}</span>)}
            </div>
          </div>

          <ol className="mt-10 hidden space-y-4 border-l border-dashed border-tinta/25 pl-6 lg:block">
            {processSteps.map((s) => (
              <li key={s.n}>
                <p className="text-sm font-semibold"><span className="mr-2 text-hilo">{s.n}</span>{s.title}</p>
                <p className="text-sm text-tinta-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <BriefForm tipo="particular" />
      </div>
    </div>
  );
}
