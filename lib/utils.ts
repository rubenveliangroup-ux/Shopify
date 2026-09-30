import { clsx, type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatMoney(amount: string | number, currencyCode = 'EUR') {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: currencyCode }).format(
    Number(amount)
  );
}

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const FREE_SHIPPING_THRESHOLD = 60;
