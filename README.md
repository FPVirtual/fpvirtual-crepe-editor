# fpvirtual-crepe-editor

Editor WYSIWYG de materiales **LiaScript** para Moodle («Materiales
Editables»), basado en [Crepe/Milkdown](https://milkdown.dev). Sustituye al
fork de LiveEditor como capa de edición; el backend (plugin
`local_liamateriales` y engine `materiales_liascript-git`) vive en el repo
`moodle-liascript-git` y no se modifica desde aquí.

> **Estado: M1 en curso.** Fase 0 cerrada con *go condicionado*
> ([docs/informe-m0.md](docs/informe-m0.md)). Ya funciona el ciclo con
> Moodle:
> - abrir desde «Editar»;
> - guardar (botón y Ctrl+S), con conflicto 409 (ver diferencias, recargar
>   o forzar) y sesión caducada;
> - renovar el token;
> - publicar en H5P, ePub o PDF;
> - borrador local en IndexedDB y aviso al salir con cambios.
>
> Pendiente en M1: panel de cabecera y modo fuente.

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
npm run e2e            # tras build: editar → guardar → 409 → forzar → publicar en Chrome
```

`npm run e2e` levanta un backend simulado que reproduce las respuestas de
`content.php`, `save.php`, `token.php` y `publish_api.php`. Controla Chrome
headless por DevTools Protocol y deja una captura en `reports/e2e.png`.

`npm test` genera `reports/` (round-trip, rendimiento, documentos
canónicos); `liaex:check` compara la huella de `liaex -f fullJson`
(secciones, quizzes, encuestas, tareas y cabecera) del original y de la
versión re-serializada entera, que es el peor caso.

### Fixtures

- `fixtures/real/`: materiales reales del repo de contenidos.
- `fixtures/casos/`: casos extremos (cabecera con imports y macros, todos
  los tipos de quiz, efectos y narración, ejecutables, prosa GFM).

Cada fixture nuevo entra automáticamente en la suite.

## Temas del editor

Sistema de tokens en tres capas (`src/theme/`):

1. **Paleta** (`palette.ts`): valores crudos. Es el único sitio con colores literales.
2. **Semántica** (`tokens.ts`): `--md-color-*`, `--md-syntax-*` y tipografía; cada
   tema (`themes.ts`) asigna un valor de la paleta a cada token.
3. **Componente**: `hope.css` (único mapeo `--md-*` → `--crepe-*` y estética
   vuepress-theme-hope sobre ProseMirror) y `styles.css` solo usan `var(--md-*)`.

Temas: `verde` (claro, por defecto), `oscuro` y `contraste` (AAA, 7:1). El selector
de la barra guarda la elección; en «automático» se sigue `prefers-contrast` y
`prefers-color-scheme`. `?theme=<id>` fuerza un tema. Los tests comprueban el
contraste WCAG de cada tema y que no haya colores literales fuera de la paleta.

### Marca (logo y título)

La barra superior muestra el logo del centro y el título de la app. Se
configuran en `src/branding.ts` o, sin tocar código, con variables al compilar
(por ejemplo en `.env.local`):

```bash
VITE_BRAND_TITLE="Editor Materiales v2"
VITE_BRAND_LOGO=./branding/logo.png      # ruta en public/ o URL absoluta
VITE_BRAND_LOGO_DARK=                    # opcional: logo para temas oscuros
VITE_BRAND_LOGO_ALT="FP Virtual Aragón"
VITE_BRAND_LINK=                         # opcional: enlace del logo
```

Sin logo oscuro propio, en el tema oscuro el logo se muestra sobre una placa
clara (token `--md-color-logo-bg`).

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
