'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site } from '@/lib/site';
import { cn } from '@/lib/utils';
import { useCart } from './cart/cart-context';
import { BagIcon, CloseIcon, MenuIcon } from './icons';
import { Logo } from './logo';

export function Header() {
  const { cart, setOpen } = useCart();
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const count = cart?.totalQuantity ?? 0;

  useEffect(() => setMenu(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-tinta/10 bg-lino/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <button className="-ml-2 p-2 md:hidden" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          {menu ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>

        <Link href="/" aria-label={`${site.name} — inicio`} className="md:mr-8">
          <Logo />
        </Link>

        <nav className="hidden flex-1 items-center gap-8 md:flex" aria-label="Principal">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm transition hover:text-hilo',
                pathname === item.href ? 'font-semibold text-tinta' : 'text-tinta-700'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/disena" className="btn-primary hidden px-5 py-2.5 lg:inline-flex">
            Diseña la tuya
          </Link>
          <button onClick={() => setOpen(true)} className="relative -mr-2 p-2" aria-label={`Carrito, ${count} artículos`}>
            <BagIcon className="h-6 w-6" />
            {count > 0 && (
              <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-hilo px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-tinta/10 bg-lino md:hidden" aria-label="Móvil">
          <ul className="container-page flex flex-col py-4">
            {site.nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="block py-3 font-display text-2xl">{item.label}</Link>
              </li>
            ))}
            <li className="pt-4">
              <Link href="/disena" className="btn-primary w-full">Diseña la tuya</Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
