-- =====================================================================
--  Academia Elemental · Base de datos en Supabase
--  Cómo usarlo: en Supabase abre "SQL Editor", pega TODO este archivo
--  y presiona "Run". Se puede volver a ejecutar sin problema.
-- =====================================================================

-- ---------- 1. Administradores (profesores que pueden entrar al panel) ----------
create table if not exists public.admins (
  email text primary key
);

-- Devuelve true si quien hace la consulta inició sesión con un correo de "admins"
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where email = auth.jwt() ->> 'email');
$$;

-- ---------- 2. Tablas ----------
create table if not exists public.ciclos (
  id                 bigint generated always as identity primary key,
  nombre             text not null,
  descripcion        text,
  inscripcion_inicio date,
  inicio_clases      date,
  fin_clases         date,
  horario            text,
  costo              text,
  visible            boolean not null default true,
  creado             timestamptz not null default now()
);

create table if not exists public.alumnos (
  id       bigint generated always as identity primary key,
  dni      text not null unique,
  nombres  text not null,
  ciclo_id bigint references public.ciclos(id) on delete set null,
  telefono text,
  creado   timestamptz not null default now()
);

create table if not exists public.asistencias (
  alumno_id bigint not null references public.alumnos(id) on delete cascade,
  fecha     date   not null,
  estado    text   not null check (estado in ('presente', 'tarde', 'falta')),
  primary key (alumno_id, fecha)
);

-- Clave de respuestas: una letra por pregunta, ej. 'abdce...' (55 letras)
create table if not exists public.claves (
  examen_id  text primary key,
  respuestas text not null check (respuestas ~ '^[a-e]+$')
);

-- Cada vez que un alumno rinde un simulacro
create table if not exists public.intentos (
  id           bigint generated always as identity primary key,
  examen_id    text not null,
  dni          text not null,
  nombre       text not null,
  respuestas   text not null,          -- una letra por pregunta, '-' = en blanco
  correctas    int  not null,
  incorrectas  int  not null,
  en_blanco    int  not null,
  nota         numeric(4,2) not null,  -- sobre 20
  duracion_seg int,
  creado       timestamptz not null default now()
);
create index if not exists intentos_dni_idx on public.intentos (dni);

-- ---------- 3. Seguridad (Row Level Security) ----------
-- Por defecto nadie puede leer ni escribir nada; luego damos permisos puntuales.
alter table public.admins      enable row level security;
alter table public.ciclos      enable row level security;
alter table public.alumnos     enable row level security;
alter table public.asistencias enable row level security;
alter table public.claves      enable row level security;
alter table public.intentos    enable row level security;

-- Ciclos: todos ven los visibles; solo el admin los modifica
drop policy if exists "ciclos_leer" on public.ciclos;
create policy "ciclos_leer" on public.ciclos for select using (visible or public.es_admin());
drop policy if exists "ciclos_admin" on public.ciclos;
create policy "ciclos_admin" on public.ciclos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Alumnos, asistencias, claves e intentos: solo el admin
drop policy if exists "alumnos_admin" on public.alumnos;
create policy "alumnos_admin" on public.alumnos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "asistencias_admin" on public.asistencias;
create policy "asistencias_admin" on public.asistencias for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "claves_admin" on public.claves;
create policy "claves_admin" on public.claves for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "intentos_admin" on public.intentos;
create policy "intentos_admin" on public.intentos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ---------- 4. Funciones que usan los alumnos ----------
-- Los alumnos nunca leen la clave directamente: el servidor califica y guarda.
create or replace function public.calificar(
  p_examen text, p_dni text, p_nombre text, p_respuestas text, p_duracion int
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_clave text; v_c int := 0; v_i int := 0; v_b int := 0; v_nota numeric; v_r text;
begin
  select respuestas into v_clave from claves where examen_id = p_examen;
  if v_clave is null then raise exception 'Este examen todavía no tiene clave de respuestas'; end if;
  if p_dni !~ '^[0-9]{8}$' then raise exception 'El DNI debe tener 8 dígitos'; end if;
  if length(trim(p_nombre)) < 3 then raise exception 'Escribe tu nombre completo'; end if;

  for k in 1 .. length(v_clave) loop
    v_r := substr(p_respuestas, k, 1);
    if v_r is null or v_r not in ('a','b','c','d','e') then v_b := v_b + 1;
    elsif v_r = substr(v_clave, k, 1)                  then v_c := v_c + 1;
    else                                                     v_i := v_i + 1;
    end if;
  end loop;
  v_nota := round(v_c * 20.0 / length(v_clave), 2);

  insert into intentos (examen_id, dni, nombre, respuestas, correctas, incorrectas, en_blanco, nota, duracion_seg)
  values (p_examen, p_dni, trim(p_nombre), left(p_respuestas, length(v_clave)), v_c, v_i, v_b, v_nota, p_duracion);

  return json_build_object('correctas', v_c, 'incorrectas', v_i, 'en_blanco', v_b,
                           'nota', v_nota, 'clave', v_clave);
end $$;

-- Historial de un alumno a partir de su DNI (incluye la clave para revisar)
create or replace function public.mis_intentos(p_dni text)
returns table (id bigint, examen_id text, nombre text, respuestas text, correctas int,
               incorrectas int, en_blanco int, nota numeric, duracion_seg int,
               creado timestamptz, clave text)
language sql stable security definer set search_path = public as $$
  select i.id, i.examen_id, i.nombre, i.respuestas, i.correctas, i.incorrectas, i.en_blanco,
         i.nota, i.duracion_seg, i.creado, c.respuestas
  from intentos i left join claves c on c.examen_id = i.examen_id
  where i.dni = p_dni
  order by i.creado desc;
$$;

-- Qué exámenes ya tienen clave (los demás aparecen como "próximamente")
create or replace function public.examenes_con_clave()
returns setof text language sql stable security definer set search_path = public as $$
  select examen_id from claves;
$$;

grant execute on function public.calificar(text, text, text, text, int) to anon, authenticated;
grant execute on function public.mis_intentos(text)                     to anon, authenticated;
grant execute on function public.examenes_con_clave()                    to anon, authenticated;

-- ---------- 5. TU CORREO DE ADMINISTRADOR ----------
-- Cambia el correo por el que usarás para entrar al panel y ejecuta esta línea.
-- insert into public.admins (email) values ('tu-correo@ejemplo.com') on conflict do nothing;
