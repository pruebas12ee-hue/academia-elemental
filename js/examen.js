// =====================================================================
//  examen.js · Rendir un simulacro y ver los resultados.
//
//  examen.html?id=X                    -> rendir (el avance está en localStorage)
//  examen.html?id=X&dni=D&intento=N    -> revisar un intento ya calificado
// =====================================================================
import { db } from './db.js';
import { pintarMarco, escapar, cargarExamen, dibujarFormulas, reloj, fechaHora } from './comun.js';

const params = new URLSearchParams(location.search);
const idExamen = params.get('id');
const LLAVE_PROGRESO = `ae-progreso-${idExamen}`;
const LETRAS = ['a', 'b', 'c', 'd', 'e'];

const $ = (id) => document.getElementById(id);
let examen;

try {
  examen = await cargarExamen(idExamen);
} catch {
  location.href = 'simulacros.html';
}
document.title = `${examen.titulo} · Academia Elemental`;

if (params.has('intento')) {
  await abrirRevision();
} else {
  iniciarExamen();
}
$('cargando').remove();

// ---------------------------------------------------------------------
//  1. RENDIR EL EXAMEN
// ---------------------------------------------------------------------
function iniciarExamen() {
  let progreso;
  try { progreso = JSON.parse(localStorage.getItem(LLAVE_PROGRESO)); } catch { /* nada */ }
  if (!progreso) { location.href = 'simulacros.html'; return; }

  const preguntas = examen.preguntas;
  const total = preguntas.length;
  const limiteMs = progreso.inicio + examen.duracion_min * 60 * 1000;
  let entregando = false;

  $('vista-examen').classList.remove('oculto');
  $('titulo-examen').textContent = examen.titulo;
  $('alumno-examen').textContent = `${progreso.nombre} · DNI ${progreso.dni}`;
  $('cuenta-total').textContent = total;
  $('mapa').innerHTML = preguntas.map((p, i) => `<button data-i="${i}" aria-label="Pregunta ${p.n}">${p.n}</button>`).join('');

  const guardar = () => localStorage.setItem(LLAVE_PROGRESO, JSON.stringify(progreso));

  function mostrarPregunta(i) {
    progreso.actual = Math.max(0, Math.min(total - 1, i));
    guardar();
    const p = preguntas[progreso.actual];
    const elegida = progreso.respuestas[progreso.actual];
    $('pregunta').innerHTML = `
      <div class="curso">${escapar(p.curso)}</div>
      <div class="numero">Pregunta ${p.n} de ${total}</div>
      <div class="enunciado">${p.enunciado}</div>
      <div class="opciones">
        ${LETRAS.map((l) => `
          <button class="opcion ${elegida === l ? 'elegida' : ''}" data-letra="${l}" aria-pressed="${elegida === l}">
            <span class="letra">${l}</span><span class="contenido">${p.opciones[l]}</span>
          </button>`).join('')}
      </div>
      <div class="navegacion">
        <button class="btn btn-borde" data-ir="-1" ${progreso.actual === 0 ? 'disabled' : ''}>← Anterior</button>
        ${progreso.actual < total - 1
          ? '<button class="btn btn-azul" data-ir="1">Siguiente →</button>'
          : '<button class="btn" data-entregar>Terminar y entregar</button>'}
      </div>`;
    dibujarFormulas($('pregunta'));
    actualizarMapa();
  }

  function actualizarMapa() {
    const n = Object.keys(progreso.respuestas).length;
    $('cuenta-respondidas').textContent = n;
    $('barra-progreso').style.width = `${(n / total) * 100}%`;
    $('mapa').querySelectorAll('button').forEach((b, i) => {
      b.classList.toggle('respondida', !!progreso.respuestas[i]);
      b.classList.toggle('actual', i === progreso.actual);
    });
  }

  function marcar(letra) {
    const i = progreso.actual;
    // Tocar la misma alternativa otra vez la desmarca (queda en blanco)
    if (progreso.respuestas[i] === letra) delete progreso.respuestas[i];
    else progreso.respuestas[i] = letra;
    guardar();
    mostrarPregunta(i);
  }

  // Clics en la pregunta
  $('pregunta').addEventListener('click', (ev) => {
    const op = ev.target.closest('[data-letra]');
    if (op) return marcar(op.dataset.letra);
    const ir = ev.target.closest('[data-ir]');
    if (ir) { mostrarPregunta(progreso.actual + Number(ir.dataset.ir)); window.scrollTo({ top: 0 }); return; }
    if (ev.target.closest('[data-entregar]')) entregar(false);
  });
  $('mapa').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (b) { mostrarPregunta(Number(b.dataset.i)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('btn-entregar').addEventListener('click', () => entregar(false));

  // Atajos de teclado
  document.addEventListener('keydown', (ev) => {
    if (entregando || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (LETRAS.includes(k)) marcar(k);
    else if (ev.key === 'ArrowRight') mostrarPregunta(progreso.actual + 1);
    else if (ev.key === 'ArrowLeft') mostrarPregunta(progreso.actual - 1);
  });

  // Cronómetro (cuenta regresiva)
  const crono = $('cronometro');
  const tic = () => {
    const resta = (limiteMs - Date.now()) / 1000;
    crono.textContent = reloj(resta);
    crono.classList.toggle('alerta', resta <= 600 && resta > 300);
    crono.classList.toggle('critico', resta <= 300);
    if (resta <= 0) entregar(true);
  };
  const intervalo = setInterval(tic, 1000);
  tic();

  // Avisar si intenta cerrar la pestaña durante el examen
  const avisoSalida = (ev) => { ev.preventDefault(); ev.returnValue = ''; };
  window.addEventListener('beforeunload', avisoSalida);

  async function entregar(porTiempo) {
    if (entregando) return;
    const enBlanco = total - Object.keys(progreso.respuestas).length;
    if (!porTiempo) {
      const msg = enBlanco
        ? `Tienes ${enBlanco} pregunta${enBlanco === 1 ? '' : 's'} sin responder. ¿Entregar de todos modos?`
        : '¿Entregar el examen?';
      if (!confirm(msg)) return;
    }
    entregando = true;
    clearInterval(intervalo);
    $('btn-entregar').disabled = true;

    const respuestas = preguntas.map((_, i) => progreso.respuestas[i] || '-').join('');
    const duracion = Math.min(examen.duracion_min * 60, Math.round((Date.now() - progreso.inicio) / 1000));
    try {
      const r = await db.calificar(idExamen, progreso.dni, progreso.nombre, respuestas, duracion);
      localStorage.removeItem(LLAVE_PROGRESO);
      window.removeEventListener('beforeunload', avisoSalida);
      $('vista-examen').classList.add('oculto');
      mostrarResultado({ ...r, respuestas, duracion_seg: duracion, nombre: progreso.nombre, dni: progreso.dni, creado: new Date().toISOString(), porTiempo });
    } catch (e) {
      entregando = false;
      $('btn-entregar').disabled = false;
      alert(`No se pudo entregar: ${e.message}\nTus respuestas siguen guardadas. Revisa tu conexión e inténtalo otra vez.`);
    }
  }

  mostrarPregunta(progreso.actual || 0);
}

// ---------------------------------------------------------------------
//  2. REVISAR UN INTENTO ANTERIOR (desde "Mi historial")
// ---------------------------------------------------------------------
async function abrirRevision() {
  const intentos = await db.misIntentos(params.get('dni'));
  const intento = intentos.find((i) => String(i.id) === params.get('intento'));
  if (!intento) { location.href = 'historial.html'; return; }
  mostrarResultado(intento);
}

// ---------------------------------------------------------------------
//  3. PANTALLA DE RESULTADOS
// ---------------------------------------------------------------------
function mostrarResultado(r) {
  pintarMarco('');
  $('vista-resultado').classList.remove('oculto');
  window.scrollTo({ top: 0 });

  const preguntas = examen.preguntas;
  const clave = r.clave || '';
  const estadoDe = (i) => (r.respuestas[i] === '-' || !r.respuestas[i] ? 'blanco' : r.respuestas[i] === clave[i] ? 'bien' : 'mal');

  // Aciertos por curso
  const cursos = {};
  preguntas.forEach((p, i) => {
    cursos[p.curso] ??= { total: 0, bien: 0 };
    cursos[p.curso].total++;
    if (estadoDe(i) === 'bien') cursos[p.curso].bien++;
  });

  const nota = Number(r.nota);
  const colorNota = nota >= 14 ? 'var(--verde)' : nota >= 11 ? 'var(--naranja)' : 'var(--rojo)';

  $('resultado').innerHTML = `
    <section class="tarjeta">
      ${r.porTiempo ? '<p class="etiqueta abierto" style="margin-top:0">El tiempo terminó y el examen se entregó automáticamente</p>' : ''}
      <div class="resultado-cabeza">
        <div class="nota-circulo" style="--p:${(nota / 20) * 100};--color-nota:${colorNota}">
          <div><b>${nota.toFixed(2).replace(/\.00$/, '')}</b><small>de 20</small></div>
        </div>
        <div>
          <h2 style="margin-bottom:4px">${escapar(examen.titulo)}</h2>
          <p class="tenue" style="margin:0">${escapar(r.nombre)} · DNI ${escapar(r.dni || params.get('dni'))} · ${fechaHora(r.creado)}</p>
          <div class="cifras">
            <div class="cifra bien"><b>${r.correctas}</b>Correctas</div>
            <div class="cifra mal"><b>${r.incorrectas}</b>Incorrectas</div>
            <div class="cifra"><b>${r.en_blanco}</b>En blanco</div>
            <div class="cifra"><b>${r.duracion_seg ? reloj(r.duracion_seg) : '—'}</b>Tiempo usado</div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">
        <a class="btn btn-azul" href="historial.html">Ver mi historial</a>
        <a class="btn btn-borde" href="simulacros.html">Otro simulacro</a>
      </div>
    </section>

    <section class="tarjeta" style="margin-top:20px">
      <h3 style="color:var(--azul)">Resultados por curso</h3>
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Curso</th><th class="num">Aciertos</th><th>Rendimiento</th></tr></thead>
        <tbody>${Object.entries(cursos).map(([c, v]) => `
          <tr><td>${escapar(c)}</td><td class="num">${v.bien} / ${v.total}</td>
              <td>${Math.round((v.bien / v.total) * 100)}%<span class="barrita"><div style="width:${(v.bien / v.total) * 100}%"></div></span></td></tr>`).join('')}
        </tbody>
      </table></div>
    </section>

    <section style="margin-top:28px">
      <h3 style="color:var(--azul)">Revisión pregunta por pregunta</h3>
      <div class="filtros" role="group" aria-label="Filtrar preguntas">
        <button class="chip" data-f="todas" aria-pressed="true">Todas</button>
        <button class="chip" data-f="mal" aria-pressed="false">Incorrectas (${r.incorrectas})</button>
        <button class="chip" data-f="blanco" aria-pressed="false">En blanco (${r.en_blanco})</button>
        <button class="chip" data-f="bien" aria-pressed="false">Correctas (${r.correctas})</button>
      </div>
      <div id="revision">
        ${preguntas.map((p, i) => {
          const est = estadoDe(i);
          return `
          <article class="tarjeta pregunta revision ${est === 'blanco' ? '' : est}" data-estado="${est}">
            <span class="estado">${{ bien: '✓ Correcta', mal: '✗ Incorrecta', blanco: '— En blanco' }[est]}</span>
            <div class="curso">${escapar(p.curso)}</div>
            <div class="numero">Pregunta ${p.n}</div>
            <div class="enunciado">${p.enunciado}</div>
            <div class="opciones">
              ${LETRAS.map((l) => {
                const cls = l === clave[i] ? 'correcta' : l === r.respuestas[i] ? 'incorrecta' : '';
                return `<div class="opcion ${cls}"><span class="letra">${l}</span><span class="contenido">${p.opciones[l]}</span></div>`;
              }).join('')}
            </div>
          </article>`;
        }).join('')}
      </div>
    </section>`;

  dibujarFormulas($('resultado'));

  // Filtros de la revisión
  $('resultado').querySelector('.filtros').addEventListener('click', (ev) => {
    const chip = ev.target.closest('.chip');
    if (!chip) return;
    ev.currentTarget.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', c === chip));
    document.querySelectorAll('#revision > article').forEach((a) => {
      a.classList.toggle('oculto', chip.dataset.f !== 'todas' && a.dataset.estado !== chip.dataset.f);
    });
  });
}
