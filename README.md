# Academia Elemental · Página web

Página de la academia con:

- **Ciclos**: fechas de inscripción, inicio y fin; el estado (Próximamente / Inscripciones abiertas / En curso) se calcula solo.
- **Simulacros**: exámenes CEPRE pasados (55 preguntas, 1 h 30 min, nota sobre 20) con cronómetro, revisión pregunta por pregunta y resultados por curso.
- **Mi historial**: cada alumno ve todas sus notas escribiendo su DNI.
- **Panel docente** (`admin.html`): ciclos, alumnos, asistencia, resultados de todos (descargables a Excel) y claves de respuestas.

## Cómo está hecho (para aprender)

| Archivo | Qué es |
|---|---|
| `index.html`, `simulacros.html`, `examen.html`, `historial.html`, `admin.html` | Las páginas (HTML = estructura) |
| `css/estilos.css` | El diseño. Los colores de la marca están arriba, en `:root` |
| `js/config.js` | **Lo único que tienes que editar**: datos de Supabase y de contacto |
| `js/db.js` | Todo lo que lee o guarda datos (Supabase o modo demostración) |
| `js/comun.js` | Cabecera, pie y funciones que usan todas las páginas |
| `js/inicio.js`, `js/simulacros.js`, `js/examen.js`, `js/historial.js`, `js/admin.js` | La lógica de cada página |
| `data/examenes/*.json` | Los exámenes ya convertidos desde Word |
| `img/examenes/` | Las imágenes de las preguntas |
| `supabase/esquema.sql` | La base de datos (tablas y seguridad) |
| `herramientas/convertir_examen.py` | Convierte un examen de Word a JSON |

## Verla en tu computadora

Las páginas cargan archivos JSON, así que se deben abrir con un pequeño servidor (no con doble clic). Dentro de la carpeta del proyecto:

```bash
python3 -m http.server 8080
```

Luego abre <http://localhost:8080>. Sin configurar Supabase funciona en **modo demostración** (los datos quedan solo en tu navegador). En el panel docente entra con cualquier correo.

## Conectar Supabase (datos reales)

1. Crea una cuenta gratis en <https://supabase.com> y un proyecto nuevo.
2. Ve a **SQL Editor**, pega todo el archivo `supabase/esquema.sql` y presiona **Run**.
3. En el mismo editor, registra tu correo de profesor:
   ```sql
   insert into public.admins (email) values ('tu-correo@gmail.com');
   ```
4. Ve a **Authentication → Users → Add user** y crea tu usuario con ese correo y una contraseña.
5. En **Authentication → Sign In / Providers**, desactiva **Allow new users to sign up** (así nadie más puede crearse una cuenta).
6. En **Project Settings → API** copia **Project URL** y la clave **anon public** dentro de `js/config.js`.
7. Entra a `admin.html` → pestaña **Claves** y carga la clave de cada examen.

> La clave *anon* puede ser pública: la seguridad la dan las reglas del archivo SQL. Los alumnos nunca leen las claves; el servidor califica.

## Agregar un examen nuevo

El Word debe tener el mismo formato que los anteriores (cursos con título y preguntas numeradas `1.`, `2.`… con alternativas `a)` a `e)`). Necesitas [pandoc](https://pandoc.org) instalado.

```bash
python3 herramientas/convertir_examen.py "Examen nuevo.docx" ordinario-2027-a "CEPRE Ordinario 2027 – Área A"
```

Luego sube los cambios y carga su clave en el panel.

## Publicarla en internet gratis (GitHub Pages)

1. Sube esta carpeta a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Branch: main / (root) → Save**.
3. En un par de minutos estará en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
