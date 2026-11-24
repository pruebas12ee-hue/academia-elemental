// =====================================================================
//  db.js · Todo lo que lee o guarda datos pasa por aquí.
//  Si hay datos de Supabase en config.js se usa Supabase;
//  si no, un "modo demostración" que guarda en el navegador (localStorage).
//  Ambos modos tienen exactamente las mismas funciones.
// =====================================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const MODO_DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------
//  Modo Supabase
// ---------------------------------------------------------------------
async function crearSupabase() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Pequeña ayuda: si Supabase devuelve error, lo lanzamos con un mensaje legible
  const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

  return {
    // --- público ---
    listarCiclos: async () => ok(await sb.from('ciclos').select('*').eq('visible', true).order('inicio_clases')),
    examenesConClave: async () => ok(await sb.rpc('examenes_con_clave')),
    calificar: async (examen, dni, nombre, respuestas, duracion) =>
      ok(await sb.rpc('calificar', { p_examen: examen, p_dni: dni, p_nombre: nombre, p_respuestas: respuestas, p_duracion: duracion })),
    misIntentos: async (dni) => ok(await sb.rpc('mis_intentos', { p_dni: dni })),

    // --- sesión del profesor ---
    sesion: async () => (await sb.auth.getSession()).data.session?.user ?? null,
    entrar: async (email, clave) => ok(await sb.auth.signInWithPassword({ email, password: clave })).user,
    salir: async () => { await sb.auth.signOut(); },

    // --- panel de administración ---
    todosLosCiclos: async () => ok(await sb.from('ciclos').select('*').order('inicio_clases', { ascending: false })),
    guardarCiclo: async ({ id, ...c }) => id
      ? ok(await sb.from('ciclos').update(c).eq('id', id))
      : ok(await sb.from('ciclos').insert(c)),
    borrarCiclo: async (id) => ok(await sb.from('ciclos').delete().eq('id', id)),

    listarAlumnos: async (cicloId) => {
      let q = sb.from('alumnos').select('*').order('nombres');
      if (cicloId) q = q.eq('ciclo_id', cicloId);
      return ok(await q);
    },
    guardarAlumno: async ({ id, ...a }) => {
      const r = id ? await sb.from('alumnos').update(a).eq('id', id) : await sb.from('alumnos').insert(a);
      if (r.error?.code === '23505') throw new Error('Ya existe un alumno con ese DNI');
      return ok(r);
    },
    borrarAlumno: async (id) => ok(await sb.from('alumnos').delete().eq('id', id)),

    asistenciasDe: async (alumnoIds) => alumnoIds.length
      ? ok(await sb.from('asistencias').select('*').in('alumno_id', alumnoIds))
      : [],
    guardarAsistencias: async (filas) => ok(await sb.from('asistencias').upsert(filas)),

    listarIntentos: async () => ok(await sb.from('intentos').select('*').order('creado', { ascending: false }).limit(1000)),
    listarClaves: async () => ok(await sb.from('claves').select('*')),
    guardarClave: async (examen_id, respuestas) => ok(await sb.from('claves').upsert({ examen_id, respuestas })),
  };
}

// ---------------------------------------------------------------------
//  Modo demostración (localStorage)
// ---------------------------------------------------------------------
function crearDemo() {
  const LLAVE = 'academia-elemental-demo';
  const hoy = new Date();
  const dia = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + n).toISOString().slice(0, 10);

  const leer = () => {
    try {
      const d = JSON.parse(localStorage.getItem(LLAVE));
      if (d) return d;
    } catch { /* sin datos */ }
    // Datos de ejemplo para que la página no se vea vacía
    return {
      sec: 10, sesion: null, claves: {}, intentos: [], alumnos: [], asistencias: [],
      ciclos: [
        { id: 1, nombre: 'Ciclo Intensivo 2027', descripcion: 'Preparación intensiva para el examen CEPRE.', inscripcion_inicio: dia(-10), inicio_clases: dia(12), fin_clases: dia(70), horario: 'Lunes a viernes, 8:00 a. m. – 1:00 p. m.', costo: 'S/ 350', visible: true },
        { id: 2, nombre: 'Ciclo Regular 2027-I', descripcion: 'Repaso completo de todos los cursos del Área A.', inscripcion_inicio: dia(25), inicio_clases: dia(45), fin_clases: dia(160), horario: 'Lunes a sábado, 3:00 p. m. – 7:00 p. m.', costo: 'S/ 480', visible: true },
        { id: 3, nombre: 'Ciclo Semestral 2026-II', descripcion: 'Ciclo actual en desarrollo.', inscripcion_inicio: dia(-90), inicio_clases: dia(-60), fin_clases: dia(30), horario: 'Lunes a viernes, 8:00 a. m. – 12:00 m.', costo: 'S/ 420', visible: true },
      ],
    };
  };
  const guardar = (d) => localStorage.setItem(LLAVE, JSON.stringify(d));
  const cambiar = (fn) => { const d = leer(); const r = fn(d); guardar(d); return r; };
  const nuevoId = (d) => ++d.sec;
  const upsert = (lista, obj, d) => {
    if (obj.id) Object.assign(lista.find((x) => x.id === Number(obj.id)), obj);
    else lista.push({ ...obj, id: nuevoId(d) });
  };

  return {
    listarCiclos: async () => leer().ciclos.filter((c) => c.visible).sort((a, b) => (a.inicio_clases > b.inicio_clases ? 1 : -1)),
    examenesConClave: async () => Object.keys(leer().claves),
    calificar: async (examen, dni, nombre, respuestas, duracion) => cambiar((d) => {
      const clave = d.claves[examen];
      if (!clave) throw new Error('Este examen todavía no tiene clave de respuestas');
      if (!/^\d{8}$/.test(dni)) throw new Error('El DNI debe tener 8 dígitos');
      let correctas = 0, incorrectas = 0, en_blanco = 0;
      [...clave].forEach((c, i) => {
        const r = respuestas[i];
        if (!'abcde'.includes(r || '-')) en_blanco++;
        else if (r === c) correctas++;
        else incorrectas++;
      });
      const nota = Math.round((correctas * 20 / clave.length) * 100) / 100;
      d.intentos.push({ id: nuevoId(d), examen_id: examen, dni, nombre, respuestas: respuestas.slice(0, clave.length), correctas, incorrectas, en_blanco, nota, duracion_seg: duracion, creado: new Date().toISOString() });
      return { correctas, incorrectas, en_blanco, nota, clave };
    }),
    misIntentos: async (dni) => {
      const d = leer();
      return d.intentos.filter((i) => i.dni === dni).map((i) => ({ ...i, clave: d.claves[i.examen_id] })).reverse();
    },

    sesion: async () => leer().sesion,
    entrar: async (email) => cambiar((d) => (d.sesion = { email })),
    salir: async () => cambiar((d) => { d.sesion = null; }),

    todosLosCiclos: async () => leer().ciclos.slice().sort((a, b) => (a.inicio_clases < b.inicio_clases ? 1 : -1)),
    guardarCiclo: async (c) => cambiar((d) => upsert(d.ciclos, c, d)),
    borrarCiclo: async (id) => cambiar((d) => { d.ciclos = d.ciclos.filter((c) => c.id !== id); }),

    listarAlumnos: async (cicloId) => leer().alumnos
      .filter((a) => !cicloId || a.ciclo_id === Number(cicloId))
      .sort((a, b) => a.nombres.localeCompare(b.nombres)),
    guardarAlumno: async (a) => cambiar((d) => {
      if (d.alumnos.some((x) => x.dni === a.dni && x.id !== Number(a.id))) throw new Error('Ya existe un alumno con ese DNI');
      upsert(d.alumnos, a, d);
    }),
    borrarAlumno: async (id) => cambiar((d) => {
      d.alumnos = d.alumnos.filter((a) => a.id !== id);
      d.asistencias = d.asistencias.filter((a) => a.alumno_id !== id);
    }),

    asistenciasDe: async (ids) => leer().asistencias.filter((a) => ids.includes(a.alumno_id)),
    guardarAsistencias: async (filas) => cambiar((d) => {
      for (const f of filas) {
        d.asistencias = d.asistencias.filter((a) => !(a.alumno_id === f.alumno_id && a.fecha === f.fecha));
        d.asistencias.push(f);
      }
    }),

    listarIntentos: async () => leer().intentos.slice().reverse(),
    listarClaves: async () => Object.entries(leer().claves).map(([examen_id, respuestas]) => ({ examen_id, respuestas })),
    guardarClave: async (examen, respuestas) => cambiar((d) => { d.claves[examen] = respuestas; }),
  };
}

export const db = MODO_DEMO ? crearDemo() : await crearSupabase();
