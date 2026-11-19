# fpvirtual-crepe-editor

Editor WYSIWYG de materiales **LiaScript** para Moodle («Materiales
Editables»), basado en [Crepe/Milkdown](https://milkdown.dev). Sustituye al
fork de LiveEditor como capa de edición; el backend (plugin
`local_liamateriales` y engine `materiales_liascript-git`) vive en el repo
`moodle-liascript-git` y no se modifica desde aquí.

> **Estado: Fase 0 (PoC, go/no-go).** Resultados y recomendación en
> [docs/informe-m0.md](docs/informe-m0.md). El guardado contra Moodle
> (LmsBridge, 409/401) llega en M1.

## Cómo funciona la fidelidad LiaScript

LiaScript no es CommonMark. Para no perder ni reescribir su sintaxis:

1. **Cabecera fuera del editor** (`src/liascript/header.ts`): el comentario
   inicial `<!-- … -->` se separa antes del parse y se vuelve a anteponer
   literal. El bloque `liascript-lms` que inyecta Moodle se extrae y se
   elimina.
2. **Bloques protegidos** (`classify.ts`, `lia-block.ts`): un transformer
   remark, el primero de la cadena, sustituye cada bloque de nivel superior
   con sintaxis LiaScript (quizzes, efectos, narración, macros, HTML, código
   con flags, `~sub~`/`^sup^`, multimedia `!?[]`, enlaces por referencia,
   encabezados setext) por un nodo atómico que guarda el **recorte literal**
   de la fuente. Los bloques contiguos (sin línea en blanco) y los bloques
   `****` de animaciones y soluciones se agrupan, porque LiaScript los asocia
   por adyacencia. Se muestran como tarjetas: los quizzes con su resumen y el
   resto con la fuente en solo lectura.
3. **Serialización que preserva la fuente** (`preserve.ts`): al guardar,
   cada bloque no editado se emite con su texto original y su separación
   original. Solo los bloques editados salen en la forma que normaliza
   remark. Guardar sin cambios devuelve el documento byte a byte.

## Desarrollo

Requisitos: Node 24.

```bash
npm ci
npm run dev            # http://localhost:5173/?demo carga un material de ejemplo
npm test               # dialecto + round-trip de fixtures + rendimiento
npm run typecheck
npm run build          # dist/ estático
npm run liaex:check    # equivalencia con el parser real de LiaScript (Docker)
```

`npm test` genera `reports/` (round-trip, rendimiento, documentos
canónicos); `liaex:check` compara la huella de `liaex -f fullJson`
(secciones, quizzes, encuestas, tareas y cabecera) del original y de la
versión re-serializada entera, que es el peor caso.

### Fixtures

- `fixtures/real/`: materiales reales del repo de contenidos.
- `fixtures/casos/`: casos extremos (cabecera con imports y macros, todos
  los tipos de quiz, efectos y narración, ejecutables, prosa GFM).

Cada fixture nuevo entra automáticamente en la suite.

## Apertura desde Moodle

El editor lee la URL del material de:

- `?url=<content.php…>` (contrato del editor), o
- `?/open/file/<content.php…>` (y `?%2Fopen%2Ffile%2F…`), que es la forma
  que genera hoy el plugin para el fork. Basta con apuntar el ajuste
  `liaeditor_url` del plugin a este editor.

## Despliegue

`npm run build` genera `dist/`, una app estática con rutas relativas. Hay
que servirla tras Nginx con HTTPS en un subdominio propio, que es el origen
que el plugin admite por CORS:

```nginx
server {
    listen 443 ssl http2;
    server_name editor.example.org;
    root /srv/fpvirtual-crepe-editor/dist;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://moodle.example.org; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:" always;
    location / { try_files $uri /index.html; }
}
```

## Licencia

AGPL-3.0 (ver [LICENSE](LICENSE)).
