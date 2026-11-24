// =====================================================================
//  comun.js · Piezas que usan todas las páginas:
//  cabecera, pie de página, fechas, estado de un ciclo, etc.
// =====================================================================
import { MODO_DEMO } from './db.js';
import { CONTACTO } from './config.js';

const ENLACES = [
  ['index.html', 'Inicio'],
  ['index.html#ciclos', 'Ciclos'],
  ['simulacros.html', 'Simulacros'],
  ['historial.html', 'Mi historial'],
];

/** Dibuja la cabecera y el pie. `activa` es el nombre del archivo actual. */
export function pintarMarco(activa) {
  const nav = ENLACES.map(([href, txt]) =>
    `<a href="${href}" ${href === activa ? 'aria-current="page"' : ''}>${txt}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    ${MODO_DEMO ? `<div class="aviso-demo">Modo demostración: los datos se guardan solo en este navegador.
      Conecta Supabase en <code>js/config.js</code> para usarlo de verdad.</div>` : ''}
    <header class="cabecera">
      <div class="contenedor cabecera-in">
        <a class="marca" href="index.html">
          <img src="img/emblema.png" alt="" width="40" height="40">
          <span><b>academia</b> elemental</span>
        </a>
        <button class="menu-btn" aria-label="Abrir menú" aria-expanded="false">☰</button>
        <nav class="nav">${nav}</nav>
      </div>
    </header>`);

  document.body.insertAdjacentHTML('beforeend', `
    <footer class="pie">
      <div class="contenedor pie-in">
        <div>
          <img src="img/logo.png" alt="Academia Elemental" class="pie-logo">
          <p class="lema">Alta educación<br>Futuro a la acción</p>
        </div>
        <div>
          <h4>Contacto</h4>
          ${CONTACTO.whatsapp ? `<p><a href="https://wa.me/${CONTACTO.whatsapp}">WhatsApp</a></p>` : ''}
          ${CONTACTO.telefono ? `<p>Teléfono: ${CONTACTO.telefono}</p>` : ''}
          ${CONTACTO.direccion ? `<p>${CONTACTO.direccion}</p>` : ''}
          ${CONTACTO.facebook ? `<p><a href="${CONTACTO.facebook}">Facebook</a></p>` : ''}
          ${!CONTACTO.whatsapp && !CONTACTO.telefono ? '<p class="tenue">Agrega tus datos en js/config.js</p>' : ''}
        </div>
        <div>
          <h4>Enlaces</h4>
          <p><a href="simulacros.html">Simulacros</a></p>
          <p><a href="historial.html">Mi historial</a></p>
          <p><a href="admin.html">Acceso docentes</a></p>
        </div>
      </div>
      <p class="contenedor derechos">© ${new Date().getFullYear()} Academia Elemental</p>
    </footer>`);

  // Menú para celular
  const btn = document.querySelector('.menu-btn');
  btn.addEventListener('click', () => {
    const abierto = document.querySelector('.nav').classList.toggle('abierto');
    btn.setAttribute('aria-expanded', abierto);
  });
}

/** Evita que un texto escrito por alguien se interprete como HTML. */
export function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** '2026-12-05' -> '5 de diciembre de 2026' */
export function fechaLarga(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Fecha y hora corta para el historial */
export function fechaHora(iso) {
  return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Fecha de hoy en formato '2026-11-24' (hora local) */
export function hoyISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Días que faltan desde hoy hasta una fecha (negativo si ya pasó) */
export function diasHasta(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(a, m - 1, d) - hoy) / 86400000);
}

/** Decide en qué estado está un ciclo según las fechas */
export function estadoCiclo(c) {
  const hoy = hoyISO();
  if (c.fin_clases && hoy > c.fin_clases) return { id: 'fin', texto: 'Finalizado' };
  if (c.inicio_clases && hoy >= c.inicio_clases) return { id: 'curso', texto: 'En curso' };
  if (!c.inscripcion_inicio || hoy >= c.inscripcion_inicio) return { id: 'abierto', texto: 'Inscripciones abiertas' };
  return { id: 'pronto', texto: 'Próximamente' };
}

/** 3725 segundos -> '1:02:05' */
export function reloj(seg) {
  seg = Math.max(0, Math.round(seg));
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
}

/** Lista de exámenes disponibles (data/examenes/indice.json) */
export async function cargarIndice() {
  return (await fetch('data/examenes/indice.json')).json();
}

/** Un examen completo con sus preguntas */
export async function cargarExamen(id) {
  const r = await fetch(`data/examenes/${encodeURIComponent(id)}.json`);
  if (!r.ok) throw new Error('No se encontró el examen');
  return r.json();
}

/** Dibuja las fórmulas matemáticas (usa KaTeX, cargado en la página) */
export function dibujarFormulas(el) {
  window.renderMathInElement?.(el, {
    delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
    throwOnError: false,
  });
}

/** Valida un DNI peruano (8 dígitos) */
export const dniValido = (dni) => /^\d{8}$/.test(dni);

/** Recordar el último alumno en este dispositivo para no volver a escribirlo */
export const alumnoGuardado = {
  leer: () => { try { return JSON.parse(localStorage.getItem('ae-alumno')) || {}; } catch { return {}; } },
  guardar: (a) => { try { localStorage.setItem('ae-alumno', JSON.stringify(a)); } catch { /* ignorar */ } },
};
