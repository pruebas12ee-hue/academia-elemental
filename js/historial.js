// Historial de simulacros de un alumno (por DNI).
import { db } from './db.js';
import { pintarMarco, escapar, cargarIndice, fechaHora, reloj, dniValido, alumnoGuardado } from './comun.js';

pintarMarco('historial.html');

const form = document.getElementById('form-dni');
const salida = document.getElementById('resultado');
const indice = await cargarIndice();
const tituloDe = (id) => indice.find((e) => e.id === id)?.titulo ?? id;

form.addEventListener('submit', (ev) => { ev.preventDefault(); buscar(form.dni.value.trim()); });

// Si el alumno ya usó este dispositivo, buscar automáticamente
const guardado = alumnoGuardado.leer();
if (guardado.dni) { form.dni.value = guardado.dni; buscar(guardado.dni); }

async function buscar(dni) {
  const error = document.getElementById('error');
  error.textContent = '';
  if (!dniValido(dni)) { error.textContent = 'El DNI debe tener 8 dígitos.'; return; }
  salida.innerHTML = '<p class="cargando">Buscando…</p>';

  let intentos;
  try { intentos = await db.misIntentos(dni); } catch (e) { salida.innerHTML = ''; error.textContent = e.message; return; }

  if (!intentos.length) {
    salida.innerHTML = '<p class="vacio">Todavía no hay simulacros con este DNI. <a href="simulacros.html">¡Da el primero!</a></p>';
    return;
  }

  const notas = intentos.map((i) => Number(i.nota));
  const mejor = Math.max(...notas);
  const promedio = notas.reduce((a, b) => a + b, 0) / notas.length;

  salida.innerHTML = `
    <section class="tarjeta">
      <h3 style="color:var(--azul);margin-bottom:4px">${escapar(intentos[0].nombre)}</h3>
      <p class="tenue" style="margin:0">DNI ${escapar(dni)}</p>
      <div class="cifras">
        <div class="cifra"><b>${intentos.length}</b>Simulacros</div>
        <div class="cifra bien"><b>${mejor.toFixed(2)}</b>Mejor nota</div>
        <div class="cifra"><b>${promedio.toFixed(2)}</b>Promedio</div>
      </div>
    </section>
    <section class="tarjeta" style="margin-top:20px">
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Fecha</th><th>Examen</th><th class="num">Nota</th><th class="num">Correctas</th><th class="num">Incorrectas</th><th class="num">Blanco</th><th class="num">Tiempo</th><th></th></tr></thead>
        <tbody>${intentos.map((i) => `
          <tr>
            <td>${fechaHora(i.creado)}</td>
            <td>${escapar(tituloDe(i.examen_id))}</td>
            <td class="num"><b>${Number(i.nota).toFixed(2)}</b></td>
            <td class="num">${i.correctas}</td>
            <td class="num">${i.incorrectas}</td>
            <td class="num">${i.en_blanco}</td>
            <td class="num">${i.duracion_seg ? reloj(i.duracion_seg) : '—'}</td>
            <td><a class="btn btn-chico btn-borde" href="examen.html?id=${encodeURIComponent(i.examen_id)}&dni=${dni}&intento=${i.id}">Revisar</a></td>
          </tr>`).join('')}
        </tbody>
      </table></div>
    </section>`;
}
