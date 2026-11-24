#!/usr/bin/env python3
"""
Convierte un examen de Word (.docx) al formato JSON que usa la web.

Uso:
    python3 herramientas/convertir_examen.py ARCHIVO.docx ID "Título del examen" [--max 55]

Ejemplo:
    python3 herramientas/convertir_examen.py Examen.docx intensivo-2025-a "CEPRE Intensivo 2025 - Área A"

Qué hace:
  1. Usa pandoc para leer el Word (texto, fórmulas, tablas e imágenes).
  2. Separa cada pregunta ("**1.**", "**2.**", ...) y sus alternativas a) b) c) d) e).
  3. Guarda las imágenes en img/examenes/ID/ y el examen en data/examenes/ID.json.
  4. Agrega el examen a data/examenes/indice.json (la lista que ve el alumno).

Requisito: tener pandoc instalado (https://pandoc.org).
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent  # carpeta del proyecto


def pandoc(texto_md: str) -> str:
    """Convierte un trozo de Markdown a HTML (las fórmulas quedan como \\( ... \\))."""
    r = subprocess.run(
        ["pandoc", "-f", "markdown", "-t", "html", "--mathjax", "--wrap=none"],
        input=texto_md, capture_output=True, text=True, check=True,
    )
    return r.stdout.strip()


def html_en_linea(texto_md: str) -> str:
    """Igual que pandoc(), pero sin el <p> que envuelve un solo párrafo."""
    html = pandoc(texto_md)
    m = re.fullmatch(r"<p>(.*)</p>", html, re.S)
    return m.group(1) if m else html


def separar_opciones(texto: str):
    """Recibe 'a\\) 7  b) 6  c) 8 ...' y devuelve {'a': '7', 'b': '6', ...}."""
    partes = re.split(r"(?:^|(?<=\s))([a-e])\\?\)\s", texto)
    # partes = ['', 'a', '7  ', 'b', '6  ', ...]
    opciones = {}
    for i in range(1, len(partes) - 1, 2):
        letra, contenido = partes[i], partes[i + 1]
        contenido = contenido.replace("\\\n", " ").strip()
        opciones[letra] = contenido
    return opciones


def main():
    args = sys.argv[1:]
    maximo = 55
    if "--max" in args:
        i = args.index("--max")
        maximo = int(args[i + 1])
        del args[i:i + 2]
    if len(args) != 3:
        print(__doc__)
        sys.exit(1)
    docx, ex_id, titulo = Path(args[0]), args[1], args[2]

    carpeta_img = RAIZ / "img" / "examenes" / ex_id
    with tempfile.TemporaryDirectory() as tmp:
        # 1) Word -> Markdown, extrayendo imágenes
        subprocess.run(
            ["pandoc", str(docx), "-t", "markdown", "--wrap=none",
             f"--extract-media={tmp}", "-o", f"{tmp}/examen.md"],
            check=True,
        )
        md = Path(f"{tmp}/examen.md").read_text(encoding="utf-8")

        # Copiar imágenes y cambiar sus rutas por rutas de la web
        if carpeta_img.exists():
            shutil.rmtree(carpeta_img)
        carpeta_img.mkdir(parents=True)
        for img in Path(tmp).glob("media/*"):
            shutil.copy(img, carpeta_img / img.name)
        md = md.replace(f"{tmp}/media/", f"img/examenes/{ex_id}/")

    # 2) Recorrer el texto: "## Curso" abre un curso; "**N.**" abre una pregunta
    preguntas, curso, actual = [], "", None
    for linea in md.splitlines():
        if linea.startswith("## "):
            curso = linea[3:].replace("--", "–").strip()
            actual = None
            continue
        m = re.match(r"\*\*(\d+)\.\*\*\s*(.*)", linea)
        if m:
            actual = {"n": int(m.group(1)), "curso": curso, "lineas": [m.group(2)]}
            preguntas.append(actual)
        elif actual is not None:
            actual["lineas"].append(linea)

    # 3) Separar enunciado y alternativas de cada pregunta
    resultado = []
    for p in preguntas:
        if p["n"] > maximo:
            continue
        lineas = p["lineas"]
        # las alternativas empiezan en la ÚLTIMA línea que comienza con "a)"
        inicio = max(i for i, l in enumerate(lineas) if re.match(r"a\\?\)\s", l))
        enunciado_md = "\n".join(lineas[:inicio]).strip()
        opciones_md = separar_opciones("\n".join(lineas[inicio:]).strip())
        if list(opciones_md) != list("abcde"):
            sys.exit(f"Pregunta {p['n']}: no encontré las 5 alternativas -> {list(opciones_md)}")
        resultado.append({
            "n": p["n"],
            "curso": p["curso"],
            "enunciado": pandoc(enunciado_md),
            "opciones": {k: html_en_linea(v) for k, v in opciones_md.items()},
        })
        print(f"  pregunta {p['n']:>2} ok ({p['curso']})")

    # 4) Guardar
    destino = RAIZ / "data" / "examenes"
    destino.mkdir(parents=True, exist_ok=True)
    examen = {"id": ex_id, "titulo": titulo, "duracion_min": 90, "preguntas": resultado}
    (destino / f"{ex_id}.json").write_text(
        json.dumps(examen, ensure_ascii=False, indent=1), encoding="utf-8")

    indice_ruta = destino / "indice.json"
    indice = json.loads(indice_ruta.read_text(encoding="utf-8")) if indice_ruta.exists() else []
    indice = [e for e in indice if e["id"] != ex_id]
    cursos = list(dict.fromkeys(p["curso"] for p in resultado))
    indice.append({"id": ex_id, "titulo": titulo, "preguntas": len(resultado),
                   "duracion_min": 90, "cursos": len(cursos)})
    indice_ruta.write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nListo: {len(resultado)} preguntas -> data/examenes/{ex_id}.json")


if __name__ == "__main__":
    main()
