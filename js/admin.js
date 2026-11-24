// =====================================================================
//  admin.js · Panel del docente
//  Pestañas: Ciclos · Alumnos · Asistencia · Resultados · Claves
// =====================================================================
import { db, MODO_DEMO } from './db.js';
import { pintarMarco, escapar, fechaLarga, estadoCiclo, hoyISO, fechaHora, reloj, cargarIndice, dniValido } from './comun.js';

pintarMarco('admin.html');

const $ = (id) => document.getElementById(id);
const contenido = $('tab-contenido');
const indice = await cargarIndice();
const tituloDe = (id) => indice.find((e) => e.id === id)?.titulo ?? id;

// ---------------------------------------------------------------------
//  Sesión
// ---------------------------------------------------------------------
if (!MODO_DEMO) document.querySelector('.demo-solo').remove();

async function mostrarSegunSesion() {
  const usuario = await db.sesion();
  $('form-login').classList.toggle('oculto', !!usuario);
  $('panel').classList.toggle('oculto', !usuario);
  if (usuario) { $('usuario').textContent = usuario.email; abrirPestana('ciclos'); }
}

$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('error-login').textContent = '';
  try {
    await db.entrar($('email').value.trim(), $('clave').value);
    mostrarSegunSesion();
  } catch (e) {
    $('error-login').textContent = e.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : e.message;
  }
});
$('salir').addEventListener('click', async () => { await db.salir(); mostrarSegunSesion(); });

// ---------------------------------------------------------------------
//  Pestañas
// ---------------------------------------------------------------------
const PESTANAS = { ciclos: tabCiclos, alumnos: tabAlumnos, asistencia: tabAsistencia, resultados: tabResultados, claves: tabClaves };

document.querySelector('.pestanas').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-tab]');
  if (b) abrirPestana(b.dataset.tab);
});

async function abrirPestana(nombre) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === nombre));
  contenido.innerHTML = '<p class="cargando">Cargando…</p>';
  try {
    await PESTANAS[nombre]();
  } catch (e) {
    contenido.innerHTML = `<p class="vacio">Error: ${escapar(e.message)}</p>`;
  }
}

/** Ejecuta una acción mostrando el error si falla */
async function intentar(fn, alTerminar) {
  try { await fn(); alTerminar?.(); } catch (e) { alert(e.message); }
}

const opcionesCiclos = (ciclos, elegido, conTodos) =>
  (conTodos ? '<option value="">Todos los ciclos</option>' : '') +
  ciclos.map((c) => `<option value="${c.id}" ${String(c.id) === String(elegido) ? 'selected' : ''}>${escapar(c.nombre)}</option>`).join('');

// ---------------------------------------------------------------------
//  CICLOS
// ---------------------------------------------------------------------
async function tabCiclos() {
  const ciclos = await db.todosLosCiclos();
  contenido.innerHTML = `
    <div class="tarjeta">
      <h3 id="titulo-form-ciclo" style="color:var(--azul)">Nuevo ciclo</h3>
      <form id="form-ciclo">
        <input type="hidden" name="id">
        <div class="fila">
          <div class="campo"><label>Nombre</label><input name="nombre" required placeholder="Ciclo Intensivo 2027"></div>
          <div class="campo"><label>Horario</label><input name="horario" placeholder="Lunes a viernes, 8 a. m. – 1 p. m."></div>
          <div class="campo"><label>Costo</label><input name="costo" placeholder="S/ 350"></div>
        </div>
        <div class="fila">
          <div class="campo"><label>Inicio de inscripciones</label><input type="date" name="inscripcion_inicio"></div>
          <div class="campo"><label>Inicio de clases</label><input type="date" name="inicio_clases" required></div>
          <div class="campo"><label>Fin de clases</label><input type="date" name="fin_clases"></div>
        </div>
        <div class="campo"><label>Descripción</label><input name="descripcion" placeholder="Breve descripción del ciclo"></div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px"><input type="checkbox" name="visible" checked style="width:auto"> Mostrar en la página</label>
        <button class="btn">Guardar ciclo</button>
        <button type="button" class="btn btn-borde oculto" id="cancelar-ciclo">Cancelar edición</button>
      </form>
    </div>
    <div class="tarjeta" style="margin-top:20px">
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Ciclo</th><th>Estado</th><th>Inscripciones</th><th>Inicio</th><th>Fin</th><th>Visible</th><th></th></tr></thead>
        <tbody>${ciclos.map((c) => {
          const e = estadoCiclo(c);
          return `<tr>
            <td><b>${escapar(c.nombre)}</b></td>
            <td><span class="etiqueta ${e.id}">${e.texto}</span></td>
            <td>${fechaLarga(c.inscripcion_inicio)}</td><td>${fechaLarga(c.inicio_clases)}</td><td>${fechaLarga(c.fin_clases)}</td>
            <td>${c.visible ? 'Sí' : 'No'}</td>
            <td><button class="btn btn-chico btn-borde" data-editar="${c.id}">Editar</button>
                <button class="btn btn-chico btn-peligro" data-borrar="${c.id}">Borrar</button></td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="tenue">Aún no hay ciclos.</td></tr>'}</tbody>
      </table></div>
    </div>`;

  const form = $('form-ciclo');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const ciclo = {
      nombre: f.nombre.trim(), horario: f.horario || null, costo: f.costo || null, descripcion: f.descripcion || null,
      inscripcion_inicio: f.inscripcion_inicio || null, inicio_clases: f.inicio_clases || null, fin_clases: f.fin_clases || null,
      visible: form.visible.checked,
    };
    if (f.id) ciclo.id = Number(f.id);
    intentar(() => db.guardarCiclo(ciclo), tabCiclos);
  });
  $('cancelar-ciclo').addEventListener('click', tabCiclos);

  contenido.querySelector('tbody').addEventListener('click', (ev) => {
    const ed = ev.target.closest('[data-editar]');
    const bo = ev.target.closest('[data-borrar]');
    if (ed) {
      const c = ciclos.find((x) => x.id === Number(ed.dataset.editar));
      for (const k of ['id', 'nombre', 'horario', 'costo', 'descripcion', 'inscripcion_inicio', 'inicio_clases', 'fin_clases']) form[k].value = c[k] ?? '';
      form.visible.checked = c.visible;
      $('titulo-form-ciclo').textContent = `Editando: ${c.nombre}`;
      $('cancelar-ciclo').classList.remove('oculto');
      form.scrollIntoView({ behavior: 'smooth' });
    }
    if (bo && confirm('¿Borrar este ciclo? Los alumnos quedarán sin ciclo asignado.')) {
      intentar(() => db.borrarCiclo(Number(bo.dataset.borrar)), tabCiclos);
    }
  });
}

// ---------------------------------------------------------------------
//  ALUMNOS
// ---------------------------------------------------------------------
async function tabAlumnos(filtro = '') {
  const [ciclos, alumnos] = await Promise.all([db.todosLosCiclos(), db.listarAlumnos(filtro || null)]);
  const nombreCiclo = (id) => ciclos.find((c) => c.id === id)?.nombre ?? '—';

  contenido.innerHTML = `
    <div class="tarjeta">
      <h3 style="color:var(--azul)">Registrar alumno</h3>
      <form id="form-alumno">
        <input type="hidden" name="id">
        <div class="fila">
          <div class="campo"><label>DNI</label><input name="dni" inputmode="numeric" maxlength="8" required></div>
          <div class="campo"><label>Nombres y apellidos</label><input name="nombres" required></div>
          <div class="campo"><label>Ciclo</label><select name="ciclo_id" required>${opcionesCiclos(ciclos, filtro)}</select></div>
          <div class="campo"><label>Teléfono</label><input name="telefono" inputmode="tel"></div>
        </div>
        <p class="error" id="error-alumno"></p>
        <button class="btn">Guardar alumno</button>
      </form>
    </div>
    <div class="tarjeta" style="margin-top:20px">
      <div class="barra-acciones">
        <div class="campo"><label>Ver</label><select id="filtro-ciclo">${opcionesCiclos(ciclos, filtro, true)}</select></div>
        <span class="tenue">${alumnos.length} alumno${alumnos.length === 1 ? '' : 's'}</span>
      </div>
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>DNI</th><th>Nombre</th><th>Ciclo</th><th>Teléfono</th><th></th></tr></thead>
        <tbody>${alumnos.map((a) => `<tr>
          <td>${escapar(a.dni)}</td><td>${escapar(a.nombres)}</td><td>${escapar(nombreCiclo(a.ciclo_id))}</td><td>${escapar(a.telefono || '')}</td>
          <td><button class="btn btn-chico btn-borde" data-editar="${a.id}">Editar</button>
              <button class="btn btn-chico btn-peligro" data-borrar="${a.id}">Borrar</button></td></tr>`).join('')
          || '<tr><td colspan="5" class="tenue">No hay alumnos registrados.</td></tr>'}</tbody>
      </table></div>
    </div>`;

  $('filtro-ciclo').addEventListener('change', (ev) => tabAlumnos(ev.target.value));

  const form = $('form-alumno');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    if (!dniValido(f.dni.trim())) { $('error-alumno').textContent = 'El DNI debe tener 8 dígitos.'; return; }
    const alumno = { dni: f.dni.trim(), nombres: f.nombres.trim(), ciclo_id: Number(f.ciclo_id), telefono: f.telefono || null };
    if (f.id) alumno.id = Number(f.id);
    intentar(() => db.guardarAlumno(alumno), () => tabAlumnos(filtro));
  });

  contenido.querySelector('tbody').addEventListener('click', (ev) => {
    const ed = ev.target.closest('[data-editar]');
    const bo = ev.target.closest('[data-borrar]');
    if (ed) {
      const a = alumnos.find((x) => x.id === Number(ed.dataset.editar));
      for (const k of ['id', 'dni', 'nombres', 'ciclo_id', 'telefono']) form[k].value = a[k] ?? '';
      form.scrollIntoView({ behavior: 'smooth' });
    }
    if (bo && confirm('¿Borrar este alumno y su asistencia?')) {
      intentar(() => db.borrarAlumno(Number(bo.dataset.borrar)), () => tabAlumnos(filtro));
    }
  });
}

// ---------------------------------------------------------------------
//  ASISTENCIA
// ---------------------------------------------------------------------
let asisCiclo = '';
let asisFecha = hoyISO();

async function tabAsistencia() {
  const ciclos = await db.todosLosCiclos();
  if (!ciclos.length) { contenido.innerHTML = '<p class="vacio">Primero crea un ciclo.</p>'; return; }
  if (!ciclos.some((c) => String(c.id) === String(asisCiclo))) {
    asisCiclo = (ciclos.find((c) => estadoCiclo(c).id === 'curso') ?? ciclos[0]).id;
  }
  const alumnos = await db.listarAlumnos(asisCiclo);
  const registros = await db.asistenciasDe(alumnos.map((a) => a.id));

  // Estado de cada alumno en la fecha elegida (editable en pantalla antes de guardar)
  const marcas = {};
  for (const r of registros) if (r.fecha === asisFecha) marcas[r.alumno_id] = r.estado;

  // Resumen del ciclo
  const fechas = [...new Set(registros.map((r) => r.fecha))];
  const resumen = (id) => {
    const mios = registros.filter((r) => r.alumno_id === id);
    const cuenta = (e) => mios.filter((r) => r.estado === e).length;
    const p = cuenta('presente'), t = cuenta('tarde'), f = cuenta('falta');
    const pct = mios.length ? Math.round(((p + t) / mios.length) * 100) : null;
    return { p, t, f, pct };
  };

  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="barra-acciones">
        <div class="campo"><label>Ciclo</label><select id="asis-ciclo">${opcionesCiclos(ciclos, asisCiclo)}</select></div>
        <div class="campo"><label>Fecha</label><input type="date" id="asis-fecha" value="${asisFecha}"></div>
        <button class="btn btn-chico btn-borde" id="todos-presentes">Todos presentes</button>
      </div>
      ${alumnos.length ? `
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Alumno</th><th>${fechaLarga(asisFecha)}</th><th class="num">Asist.</th><th class="num">Tard.</th><th class="num">Faltas</th><th class="num">% asistencia</th></tr></thead>
        <tbody>${alumnos.map((a) => {
          const r = resumen(a.id);
          return `<tr>
            <td>${escapar(a.nombres)}<br><small class="tenue">${escapar(a.dni)}</small></td>
            <td><div class="asis-botones" data-alumno="${a.id}">
              ${[['presente', 'P', 'Presente'], ['tarde', 'T', 'Tarde'], ['falta', 'F', 'Falta']].map(([e, l, t]) =>
                `<button data-e="${e}" title="${t}" aria-pressed="${marcas[a.id] === e}">${l}</button>`).join('')}
            </div></td>
            <td class="num">${r.p}</td><td class="num">${r.t}</td><td class="num">${r.f}</td>
            <td class="num">${r.pct === null ? '—' : `${r.pct}%`}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:16px;flex-wrap:wrap">
        <button class="btn" id="guardar-asis">Guardar asistencia</button>
        <span class="tenue" id="estado-asis">${fechas.length} día${fechas.length === 1 ? '' : 's'} registrado${fechas.length === 1 ? '' : 's'} en este ciclo</span>
      </div>` : '<p class="vacio">Este ciclo no tiene alumnos. Regístralos en la pestaña “Alumnos”.</p>'}
    </div>`;

  $('asis-ciclo').addEventListener('change', (ev) => { asisCiclo = ev.target.value; tabAsistencia(); });
  $('asis-fecha').addEventListener('change', (ev) => { asisFecha = ev.target.value || hoyISO(); tabAsistencia(); });
  if (!alumnos.length) return;

  contenido.querySelector('tbody').addEventListener('click', (ev) => {
    const b = ev.target.closest('.asis-botones button');
    if (!b) return;
    const id = Number(b.parentElement.dataset.alumno);
    marcas[id] = b.dataset.e;
    b.parentElement.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    $('estado-asis').textContent = 'Cambios sin guardar';
  });
  $('todos-presentes').addEventListener('click', () => {
    for (const a of alumnos) marcas[a.id] = 'presente';
    contenido.querySelectorAll('.asis-botones button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.e === 'presente'));
    $('estado-asis').textContent = 'Cambios sin guardar';
  });
  $('guardar-asis').addEventListener('click', () => {
    const filas = Object.entries(marcas).map(([alumno_id, estado]) => ({ alumno_id: Number(alumno_id), fecha: asisFecha, estado }));
    if (!filas.length) { alert('Marca al menos un alumno.'); return; }
    intentar(() => db.guardarAsistencias(filas), tabAsistencia);
  });
}

// ---------------------------------------------------------------------
//  RESULTADOS DE SIMULACROS
// ---------------------------------------------------------------------
async function tabResultados() {
  const intentos = await db.listarIntentos();
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="barra-acciones">
        <div class="campo"><label>Examen</label><select id="f-examen"><option value="">Todos</option>
          ${indice.map((e) => `<option value="${e.id}">${escapar(e.titulo)}</option>`).join('')}</select></div>
        <div class="campo"><label>Buscar alumno</label><input id="f-texto" placeholder="Nombre o DNI"></div>
        <button class="btn btn-chico btn-borde" id="descargar">Descargar Excel (CSV)</button>
      </div>
      <div id="tabla-intentos"></div>
    </div>`;

  const filtrar = () => {
    const ex = $('f-examen').value;
    const txt = $('f-texto').value.trim().toLowerCase();
    return intentos.filter((i) => (!ex || i.examen_id === ex) &&
      (!txt || i.dni.includes(txt) || i.nombre.toLowerCase().includes(txt)));
  };
  const pintar = () => {
    const lista = filtrar();
    const prom = lista.length ? lista.reduce((s, i) => s + Number(i.nota), 0) / lista.length : 0;
    $('tabla-intentos').innerHTML = lista.length ? `
      <p class="tenue">${lista.length} intento${lista.length === 1 ? '' : 's'} · promedio ${prom.toFixed(2)}</p>
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Fecha</th><th>Alumno</th><th>DNI</th><th>Examen</th><th class="num">Nota</th><th class="num">C / I / B</th><th class="num">Tiempo</th><th></th></tr></thead>
        <tbody>${lista.map((i) => `<tr>
          <td>${fechaHora(i.creado)}</td><td>${escapar(i.nombre)}</td><td>${escapar(i.dni)}</td>
          <td>${escapar(tituloDe(i.examen_id))}</td><td class="num"><b>${Number(i.nota).toFixed(2)}</b></td>
          <td class="num">${i.correctas} / ${i.incorrectas} / ${i.en_blanco}</td>
          <td class="num">${i.duracion_seg ? reloj(i.duracion_seg) : '—'}</td>
          <td><a class="btn btn-chico btn-borde" href="examen.html?id=${encodeURIComponent(i.examen_id)}&dni=${i.dni}&intento=${i.id}" target="_blank">Ver</a></td>
        </tr>`).join('')}</tbody>
      </table></div>` : '<p class="vacio">Todavía no hay resultados.</p>';
  };
  $('f-examen').addEventListener('change', pintar);
  $('f-texto').addEventListener('input', pintar);
  $('descargar').addEventListener('click', () => {
    const filas = [['Fecha', 'Alumno', 'DNI', 'Examen', 'Nota', 'Correctas', 'Incorrectas', 'En blanco', 'Minutos'],
      ...filtrar().map((i) => [fechaHora(i.creado), i.nombre, i.dni, tituloDe(i.examen_id), i.nota, i.correctas, i.incorrectas, i.en_blanco, Math.round((i.duracion_seg || 0) / 60)])];
    const csv = filas.map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `resultados-${hoyISO()}.csv`;
    a.click();
  });
  pintar();
}

// ---------------------------------------------------------------------
//  CLAVES DE RESPUESTAS
// ---------------------------------------------------------------------
async function tabClaves() {
  const claves = Object.fromEntries((await db.listarClaves()).map((c) => [c.examen_id, c.respuestas]));
  contenido.innerHTML = `
    <p class="tenue">Escribe la clave de cada examen como una sola fila de letras, en orden desde la pregunta 1
      (por ejemplo <code>abdce…</code>). Mientras un examen no tenga clave, los alumnos lo verán como “Próximamente”.</p>
    ${indice.map((e) => `
      <div class="tarjeta" style="margin-bottom:16px" data-examen="${e.id}">
        <h3 style="color:var(--azul)">${escapar(e.titulo)}
          <span class="etiqueta ${claves[e.id] ? 'curso' : ''}" style="vertical-align:middle">${claves[e.id] ? 'Con clave' : 'Sin clave'}</span></h3>
        <div class="campo" style="margin-bottom:4px">
          <input class="entrada-clave" maxlength="${e.preguntas}" value="${escapar(claves[e.id] || '')}"
                 placeholder="${e.preguntas} letras (a–e)" spellcheck="false" autocomplete="off"
                 style="font-family:monospace;letter-spacing:.15em;text-transform:lowercase">
        </div>
        <small class="tenue contador"></small>
        <div class="clave-grid"></div>
        <button class="btn btn-chico guardar-clave">Guardar clave</button>
      </div>`).join('')}`;

  contenido.querySelectorAll('[data-examen]').forEach((caja) => {
    const total = indice.find((e) => e.id === caja.dataset.examen).preguntas;
    const input = caja.querySelector('.entrada-clave');
    const vista = () => {
      input.value = input.value.toLowerCase().replace(/[^a-e]/g, '');
      caja.querySelector('.contador').textContent = `${input.value.length} de ${total} letras`;
      caja.querySelector('.clave-grid').innerHTML = Array.from({ length: total }, (_, i) =>
        `<div>${i + 1}<b>${input.value[i] || '·'}</b></div>`).join('');
    };
    input.addEventListener('input', vista);
    vista();
    caja.querySelector('.guardar-clave').addEventListener('click', () => {
      if (input.value.length !== total) { alert(`La clave debe tener exactamente ${total} letras (tiene ${input.value.length}).`); return; }
      intentar(() => db.guardarClave(caja.dataset.examen, input.value), tabClaves);
    });
  });
}

mostrarSegunSesion();
