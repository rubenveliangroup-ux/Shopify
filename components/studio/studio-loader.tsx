'use client';

import dynamic from 'next/dynamic';

// WebGL y Fabric solo existen en el navegador: el estudio se carga sin SSR.
export const StudioLoader = dynamic(() => import('./design-studio').then((m) => m.DesignStudio), {
  ssr: false,
  loading: () => (
    <div className="container-page grid min-h-[60vh] place-items-center pt-8">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-tinta/15 border-t-hilo" />
        <p className="mt-4 text-sm text-tinta-500">Preparando el estudio…</p>
      </div>
    </div>
  )
});
