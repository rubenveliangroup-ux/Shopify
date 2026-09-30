import type { QA } from '@/components/faq';
import { site } from './site';

export const processSteps = [
  { n: '01', title: 'Nos cuentas tu idea', text: 'Un dibujo, una foto, un logo o solo una frase. Súbelo en 2 minutos desde el móvil.' },
  { n: '02', title: 'Boceto digital gratis', text: 'Adaptamos tu idea al lenguaje del bordado y te enviamos una previsualización sobre la prenda en 48 h.' },
  { n: '03', title: 'Ajustamos contigo', text: 'Colores de hilo, tamaño y posición. No bordamos nada hasta que nos das el OK.' },
  { n: '04', title: 'Bordamos y enviamos', text: `Producción en nuestro taller en ${site.productionDays} días laborables y envío a toda España.` }
];

export const benefits = [
  { title: 'Relieve que se siente', text: 'El bordado tiene textura y volumen. No es una impresión plana: es una pieza hecha con hilo.' },
  { title: 'Dura más que la prenda', text: 'No se agrieta ni se despega con los lavados. Hilos de alta resistencia pensados para el lavado frecuente.' },
  { title: 'Prendas premium', text: 'Algodón de gramaje alto y patrones actuales: oversize, boxy y básicos que apetece ponerse.' },
  { title: 'Diseño de estudio', text: 'No es solo digitalizar: pensamos cada puntada para que tu idea luzca en tela.' }
];

export const homeFaq: QA[] = [
  { q: '¿Qué puedo enviaros como idea?', a: 'Casi cualquier cosa: un dibujo a mano, una foto, una ilustración, un logo o una descripción. Nosotros lo convertimos en un diseño bordable y te lo enseñamos antes de producir.' },
  { q: '¿Cuánto cuesta una prenda personalizada?', a: 'Depende de la prenda, el tamaño del bordado y el número de colores. Como referencia, una sudadera con bordado en pecho parte de 49,90 €. Te damos precio cerrado junto al boceto, sin compromiso.' },
  { q: '¿Hay pedido mínimo?', a: 'Para particulares no: bordamos desde 1 unidad. Para marcas y empresas trabajamos desde 25 unidades con precios por volumen.' },
  { q: '¿Cuánto tarda?', a: `Boceto en 48 h laborables. Una vez aprobado, producción en ${site.productionDays} días laborables más el envío (24–72 h en península).` },
  { q: '¿Puedo devolver una prenda personalizada?', a: 'Las prendas hechas a medida de tu diseño no admiten devolución por desistimiento (art. 103 LGDCU), pero si hay cualquier defecto de bordado o de prenda la repetimos sin coste. Las prendas de la colección tienen 30 días de devolución.' },
  { q: '¿Cómo lavo una prenda bordada?', a: 'Del revés, a 30 °C, sin secadora y planchando por el reverso. Así el bordado se mantiene como el primer día.' }
];

export const brandFaq: QA[] = [
  { q: '¿Trabajáis con marcas pequeñas?', a: 'Sí, es gran parte de nuestro día a día. Desde 25 unidades por diseño, y podemos combinar tallas y colores de prenda en el mismo pedido.' },
  { q: '¿Nos diseñáis el logo o la colección?', a: 'Sí. Podemos partir de cero (concepto, ilustración, logo) o adaptar vuestra identidad existente al bordado. Os entregamos también los archivos.' },
  { q: '¿Podemos traer nuestras propias prendas?', a: 'Sí, bordamos sobre prenda del cliente previa prueba de tejido. También os asesoramos en elección de prenda y proveedores.' },
  { q: '¿Hacéis muestras?', a: 'Sí. Para colecciones y pedidos recurrentes hacemos pre-serie o muestra física antes de la producción completa.' },
  { q: '¿Qué plazos manejáis?', a: 'Presupuesto en 24–48 h. Producción habitual de 2 a 3 semanas según volumen. Si tenéis una fecha límite (evento, lanzamiento), indicadla en el brief.' }
];
