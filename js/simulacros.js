// Lista de simulacros disponibles y formulario para identificarse.
import { db } from './db.js';
import { pintarMarco, escapar, cargarIndice, dniValido, alumnoGuardado } from './comun.js';

pintarMarco('simulacros.html');

const lista = document.getElementById('lista-examenes');
const modal = document.getElementById('modal');
const form = document.getElementById('form-inicio');
let elegido = null;

const [examenes, conClave] = await Promise.all([cargarIndice(), db.examenesConClave().catch(() => [])]);

lista.innerHTML = examenes.map((e) => {
  const listo = conClave.includes(e.id);
  const enCurso = localStorage.getItem(`ae-progreso-${e.id}`);
  return `
    <article class="tarjeta examen-card">
      <span class="etiqueta ${listo ? 'abierto' : ''}">${listo ? 'Disponible' : 'Próximamente'}</span>
      <h3>${escapar(e.titulo)}</h3>
      <div class="datos">
        <span>${e.preguntas} preguntas</span>
        <span>${e.duracion_min} minutos</span>
        <span>${e.cursos} cursos</span>
      </div>
      ${listo
        ? `<button class="btn" data-id="${e.id}">${enCurso ? 'Continuar examen' : 'Empezar'}</button>`
        : '<p class="tenue" style="margin:0;font-size:.9rem">Falta cargar la clave de respuestas.</p>'}
    </article>`;
}).join('');

lista.addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-id]');
  if (!btn) return;
  elegido = examenes.find((e) => e.id === btn.dataset.id);

  // Si ya hay un examen empezado, continuar directamente
  if (localStorage.getItem(`ae-progreso-${elegido.id}`)) {
    location.href = `examen.html?id=${elegido.id}`;
    return;
  }
  const a = alumnoGuardado.leer();
  form.dni.value = a.dni || '';
  form.nombre.value = a.nombre || '';
  document.getElementById('modal-examen').textContent = elegido.titulo;
  document.getElementById('modal-tiempo').textContent = elegido.duracion_min;
  document.getElementById('error-inicio').textContent = '';
  modal.classList.remove('oculto');
  (a.dni ? form.querySelector('.btn:not(.btn-borde)') : form.dni).focus();
});

document.getElementById('cancelar').addEventListener('click', () => modal.classList.add('oculto'));
modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.classList.add('oculto'); });

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const dni = form.dni.value.trim();
  const nombre = form.nombre.value.trim().replace(/\s+/g, ' ');
  const error = document.getElementById('error-inicio');
  if (!dniValido(dni)) { error.textContent = 'El DNI debe tener 8 dígitos.'; return; }
  if (nombre.length < 5) { error.textContent = 'Escribe tus nombres y apellidos.'; return; }

  alumnoGuardado.guardar({ dni, nombre });
  // Estado inicial del examen: guardado en el navegador para no perderlo al recargar
  localStorage.setItem(`ae-progreso-${elegido.id}`, JSON.stringify({
    dni, nombre, inicio: Date.now(), respuestas: {}, actual: 0,
  }));
  location.href = `examen.html?id=${elegido.id}`;
});
