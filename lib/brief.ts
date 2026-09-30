import { z } from 'zod';

export { ACCEPTED_FILES, MAX_FILES, MAX_FILE_MB } from './brief-config';

const base = {
  nombre: z.string().trim().min(2, 'Dinos tu nombre').max(80),
  email: z.string().trim().email('Email no válido'),
  telefono: z.string().trim().max(30).optional().default(''),
  idea: z.string().trim().min(10, 'Cuéntanos un poco más (mín. 10 caracteres)').max(3000),
  consentimiento: z.literal('on', { errorMap: () => ({ message: 'Necesitamos tu consentimiento' }) })
};

export const particularSchema = z.object({
  tipo: z.literal('particular'),
  ...base,
  prenda: z.enum(['sudadera', 'camiseta', 'hoodie', 'otra']),
  color: z.string().trim().max(40).optional().default(''),
  ubicacion: z.enum(['pecho', 'centro', 'espalda', 'manga', 'no-se']),
  cantidad: z.coerce.number().int().min(1).max(500)
});

export const marcaSchema = z.object({
  tipo: z.literal('marca'),
  ...base,
  marca: z.string().trim().min(1, 'Nombre de la marca').max(80),
  web: z.string().trim().max(120).optional().default(''),
  servicio: z.enum(['diseno-y-produccion', 'solo-produccion', 'coleccion', 'merch']),
  volumen: z.enum(['25-50', '50-150', '150-500', '500+']),
  plazo: z.string().trim().max(60).optional().default('')
});

export const briefSchema = z.discriminatedUnion('tipo', [particularSchema, marcaSchema]);
export type Brief = z.infer<typeof briefSchema>;
