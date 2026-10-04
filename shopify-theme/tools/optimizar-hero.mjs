// Vídeo del hero de la portada, optimizado para la web:
//   npm run hero -- ruta/al/video.mp4 [ruta/a/la/imagen-poster.jpg]
//
// Escribe en shopify-theme/assets/ (se sirven con asset_url desde la sección br-hero):
//   br-hero-escritorio.mp4   H.264 1080p, ~7 MB (dos pasadas para clavar el peso), sin audio
//   br-hero-movil.mp4        H.264 720 × 1280 (vertical, el centro del plano), ~2,5 MB, sin audio
//   br-hero-poster.jpg       imagen de respaldo de escritorio (la que se pase o el primer fotograma)
//   br-hero-poster-movil.jpg imagen de respaldo vertical para móvil (mismo encuadre que el vídeo móvil)
// En móvil en vertical el hero recorta el centro del vídeo de todas formas (object-fit: cover): la versión
// vertical gasta los 2,5 MB solo en lo que se ve. Usa el ffmpeg de node_modules (ffmpeg-static).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import sharp from 'sharp';

const [input, posterIn] = process.argv.slice(2);
if (!input) {
  console.error('Uso: npm run hero -- video.mp4 [poster.jpg]');
  process.exit(2);
}
const root = path.resolve(new URL('../..', import.meta.url).pathname);
const out = process.env.BR_HERO_OUT ? path.resolve(process.env.BR_HERO_OUT) : path.join(root, 'shopify-theme/assets'); // BR_HERO_OUT: para probar
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'br-hero-'));
const OBJETIVO = { escritorio: 7, movil: 2.5 }; // MB

// Duración y tamaño del original (ffmpeg -i escribe la información en stderr)
const info = spawnSync(ffmpeg, ['-hide_banner', '-i', input], { encoding: 'utf8' }).stderr;
const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
if (!d) throw new Error(`No se puede leer el vídeo: ${input}`);
const dur = +d[1] * 3600 + +d[2] * 60 + +d[3];
const dim = /, (\d{2,5})x(\d{2,5})[, ]/.exec(info);
const fpsIn = Number(/, ([\d.]+) fps/.exec(info)?.[1] ?? 30);
const fps = fpsIn > 30 ? ',fps=30' : ''; // se respetan 24/25/30 fps; solo se baja lo que pase de 30
console.log(`Original: ${path.basename(input)} · ${dur.toFixed(1)} s · ${dim ? `${dim[1]}×${dim[2]}` : '?'} · ${(fs.statSync(input).size / 1048576).toFixed(1)} MB`);

/** Codifica a un peso objetivo con dos pasadas (H.264 High, yuv420p, sin audio, faststart). */
function encode(name, filter, mb, maxKbps) {
  const kbps = Math.min(maxKbps, Math.floor(((mb * 8 * 1024) / dur) * 0.95));
  const file = path.join(out, name);
  const common = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-vf', `${filter}${fps},format=yuv420p`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.5)}k`, '-bufsize', `${kbps * 2}k`, '-g', String(Math.round(Math.min(30, fpsIn) * 2))];
  const log = path.join(tmp, name);
  execFileSync(ffmpeg, [...common, '-pass', '1', '-passlogfile', log, '-f', 'mp4', os.platform() === 'win32' ? 'NUL' : '/dev/null']);
  execFileSync(ffmpeg, [...common, '-pass', '2', '-passlogfile', log, '-movflags', '+faststart', file]);
  console.log(`${name}: ${(fs.statSync(file).size / 1048576).toFixed(2)} MB (${kbps} kbps)`);
}

// Escritorio: 1080p como máximo, mismo encuadre
encode('br-hero-escritorio.mp4', "scale='min(1920,iw)':-2,setsar=1", OBJETIVO.escritorio, 6000);
// Móvil: recorte central vertical 9:16 a 720 × 1280
encode('br-hero-movil.mp4', "crop='trunc(min(iw,ih*9/16)/2)*2':ih,scale=720:1280,setsar=1", OBJETIVO.movil, 2500);

// Imágenes de respaldo: la que se pase o el primer fotograma del vídeo
let base = posterIn;
if (!base) {
  base = path.join(tmp, 'fotograma.png');
  execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-frames:v', '1', base]);
}
const img = sharp(base).rotate();
const meta = await img.metadata();
await img.clone().resize({ width: Math.min(1920, meta.width ?? 1920), withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(out, 'br-hero-poster.jpg'));
const cw = Math.min(meta.width, Math.round((meta.height * 9) / 16));
await img
  .clone()
  .extract({ left: Math.round((meta.width - cw) / 2), top: 0, width: cw, height: meta.height })
  .resize({ width: 720, height: 1280, fit: 'cover' })
  .jpeg({ quality: 76, mozjpeg: true })
  .toFile(path.join(out, 'br-hero-poster-movil.jpg'));
for (const f of ['br-hero-poster.jpg', 'br-hero-poster-movil.jpg']) console.log(`${f}: ${Math.round(fs.statSync(path.join(out, f)).size / 1024)} KB`);
fs.rmSync(tmp, { recursive: true, force: true });
