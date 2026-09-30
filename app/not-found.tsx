import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-center py-32 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 text-5xl">Se nos ha soltado el hilo</h1>
      <p className="mt-4 text-tinta-700">Esta página no existe o ya no está disponible.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/tienda" className="btn-dark">Ver colección</Link>
        <Link href="/personaliza" className="btn-ghost">Crear mi diseño</Link>
      </div>
    </div>
  );
}
