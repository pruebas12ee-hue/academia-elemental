// Página de inicio: muestra los ciclos guardados en la base de datos.
import { db } from './db.js';
import { pintarMarco, escapar, fechaLarga, estadoCiclo, diasHasta } from './comun.js';

pintarMarco('index.html');

const contenedor = document.getElementById('lista-ciclos');

try {
  const ciclos = (await db.listarCiclos())
    .map((c) => ({ ...c, estado: estadoCiclo(c) }))
    .filter((c) => c.estado.id !== 'fin'); // los ciclos terminados no se muestran

  if (!ciclos.length) {
    contenedor.innerHTML = '<p class="vacio">Pronto anunciaremos nuevos ciclos.</p>';
  } else {
    contenedor.innerHTML = ciclos.map(tarjetaCiclo).join('');
  }
} catch (e) {
  contenedor.innerHTML = `<p class="vacio">No se pudieron cargar los ciclos (${escapar(e.message)}).</p>`;
}

function tarjetaCiclo(c) {
  let cuenta = '';
  if (c.estado.id === 'pronto') {
    cuenta = `Inscripciones desde el ${fechaLarga(c.inscripcion_inicio)}`;
  } else if (c.estado.id === 'abierto' && c.inicio_clases) {
    const d = diasHasta(c.inicio_clases);
    cuenta = d === 0 ? '¡Las clases empiezan hoy!' : `Inicio de clases en ${d} día${d === 1 ? '' : 's'}`;
  }
  return `
    <article class="tarjeta ciclo" data-estado="${c.estado.id}">
      <span class="etiqueta ${c.estado.id}">${c.estado.texto}</span>
      <h3>${escapar(c.nombre)}</h3>
      ${c.descripcion ? `<p class="tenue" style="margin:0">${escapar(c.descripcion)}</p>` : ''}
      <dl>
        <dt>Inscripciones</dt><dd>${fechaLarga(c.inscripcion_inicio)}</dd>
        <dt>Inicio de clases</dt><dd>${fechaLarga(c.inicio_clases)}</dd>
        ${c.fin_clases ? `<dt>Término</dt><dd>${fechaLarga(c.fin_clases)}</dd>` : ''}
        ${c.horario ? `<dt>Horario</dt><dd>${escapar(c.horario)}</dd>` : ''}
        ${c.costo ? `<dt>Inversión</dt><dd>${escapar(c.costo)}</dd>` : ''}
      </dl>
      ${cuenta ? `<div class="cuenta">${cuenta}</div>` : ''}
    </article>`;
}
