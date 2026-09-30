export const site = {
  name: 'BR',
  fullName: 'BR · Estudio de bordado',
  tagline: 'Tú tienes la idea. Nosotros la convertimos en bordado.',
  description:
    'Estudio de diseño textil y bordado profesional. Prendas premium bordadas a partir de tu idea, dibujo o logo. Para particulares y marcas. Envíos a toda España.',
  email: 'hola@br.studio', // TODO: sustituir por el email real
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? '',
  instagram: 'https://instagram.com/', // TODO
  productionDays: '7–10',
  nav: [
    { href: '/tienda', label: 'Colección' },
    { href: '/personaliza', label: 'Personaliza' },
    { href: '/marcas', label: 'Para marcas' },
    { href: '/#proceso', label: 'Cómo funciona' }
  ]
};
