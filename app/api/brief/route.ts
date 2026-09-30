import { NextResponse, type NextRequest } from 'next/server';
import { site } from '@/lib/site';
import { ACCEPTED_FILES, MAX_FILES, MAX_FILE_MB, briefSchema } from '@/lib/brief';

export async function POST(req: NextRequest) {
  const form = await req.formData();

  // Honeypot anti-spam: los humanos no rellenan este campo oculto.
  if (form.get('empresa_web')) return NextResponse.json({ ok: true });

  const fields = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === 'string')
  );
  const parsed = briefSchema.safeParse(fields);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const files = form.getAll('archivos').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_FILES)
    return NextResponse.json({ ok: false, message: `Máximo ${MAX_FILES} archivos` }, { status: 400 });
  for (const f of files) {
    if (!ACCEPTED_FILES.includes(f.type) || f.size > MAX_FILE_MB * 1024 * 1024)
      return NextResponse.json(
        { ok: false, message: `"${f.name}": usa PNG, JPG, WEBP, SVG o PDF de hasta ${MAX_FILE_MB} MB` },
        { status: 400 }
      );
  }

  const webhook = process.env.BRIEF_WEBHOOK_URL;
  if (!webhook) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[brief] BRIEF_WEBHOOK_URL no configurada: brief NO entregado', parsed.data.email);
      return NextResponse.json(
        { ok: false, message: `No hemos podido enviarlo. Escríbenos a ${site.email}` },
        { status: 503 }
      );
    }
    console.info('[brief] (dev) recibido', parsed.data, files.map((f) => f.name));
    return NextResponse.json({ ok: true });
  }

  const out = new FormData();
  out.append('brief', JSON.stringify({ ...parsed.data, recibido: new Date().toISOString() }));
  files.forEach((f) => out.append('archivos', f, f.name));

  const res = await fetch(webhook, { method: 'POST', body: out });
  if (!res.ok) {
    console.error('[brief] webhook', res.status, await res.text().catch(() => ''));
    return NextResponse.json({ ok: false, message: 'Error al enviar. Inténtalo de nuevo.' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
