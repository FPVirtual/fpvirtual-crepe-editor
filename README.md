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
> - enlace «Publicar…» a la página Publicar del plugin (con el material
>   elegido; publicar se hace allí, con la sesión de Moodle);
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
   resto con su fuente. Cada tarjeta se edita como texto («Editar» o doble
   clic; `card-view.ts`): al aplicar se vuelve a parsear, así que lo tecleado
   llega literal a Git. El menú «/» tiene un grupo LiaScript con plantillas
   (`templates.ts`) y las macros que define la cabecera.
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
npm run e2e            # tras build: editar → guardar → 409 → forzar → imágenes en Chrome
```

`npm run e2e` levanta un backend simulado que reproduce las respuestas de
`content.php`, `save.php`, `token.php` y `asset.php`. Controla Chrome
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

Temas: `verde` (claro, por defecto), `oscuro` y `contraste` (AAA, 7:1). Se eligen
con cuatro iconos en la barra (`ThemeSelect.vue`, grupo de opciones accesible con
flechas; iconos SVG en línea de `AppIcon.vue`: pantalla = automático, sol, luna y
contraste). La elección se guarda; en «automático» se sigue `prefers-contrast` y
`prefers-color-scheme`. `?theme=<id>` fuerza un tema. Los tests comprueban el
contraste WCAG de cada tema y que no haya colores literales fuera de la paleta.

### Mismo aspecto que la web publicada

El área de edición se ve como la web estática que publica el engine
(formato `web`, estética vuepress-theme-hope):

- **Cajas** (`@nota`, `@consejo`, `@aviso`, `@importante`, `@error`, cuando
  son una línea sola): contenedor de aviso con título e icono, con los
  colores de estado del tema (`info`, `success`, `warning`, `special`,
  `danger`). El texto admite negrita, cursiva y código
  (`src/liascript/box.ts`). Las demás macros siguen como tarjeta de código.
- **Quizzes**: tarjeta con borde y opciones con su marcador (radio o
  casilla), la correcta marcada y etiquetada.
- **Bloques de código**: token `--md-color-code-block-bg` (`#ecf4fa` en
  claro, `#282c34` en oscuro), distinto del de código en línea.

La web usa estos mismos colores (estados y resaltado `--md-syntax-*`), así
que el contraste que comprueban los tests vale para las dos.

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

### Paneles laterales

Dos paneles plegables con su propio icono en la esquina superior derecha
(plegados quedan como una franja con el icono; se recuerda su estado):

- **Índice** (izquierda): títulos que abren sección en LiaScript.
- **LiaScript** (derecha): ejemplos de todo lo que LiaScript ofrece y el
  editor no muestra (quizzes, encuestas, animaciones, narración, código,
  multimedia, formato, gráficos), con imagen del resultado real, buscador y
  botones *Insertar* / *Copiar*; incluye las macros de la cabecera. Los
  ejemplos viven en `src/liascript/catalog.ts`, que también alimenta el menú
  «/» y los tests.

Las imágenes (`public/lia-examples/*.webp`) se generan con el LiaScript real:

```bash
npm run lia:previews          # todos (Docker + liascript/exporter + Chrome)
npm run lia:previews -- chart # solo algunos
```

### Ayuda

`ayuda.html` (botón «Ayuda», en otra pestaña con botón «Volver al editor»)
explica el uso del editor, adaptado de la documentación de Crepe. No carga
Crepe. Las funciones avanzadas de LiaScript están en el panel lateral.

## Tema de los contenidos exportados

Los contenidos publicados (SCORM, H5P, PDF, ePub) los renderiza LiaScript,
no el editor. Para que tengan el mismo aspecto, `src/theme/liascript.ts`
traduce un tema del editor a una hoja CSS para el runtime de LiaScript. El
engine la incluye y la aplica al exportar. Si cambia el tema, hay que
regenerarla y copiarla al engine:

```bash
npm run theme:liascript -- verde ../moodle-liaeditor-git/engine/src/materiales_liascript/publish/themes/verde.css
```

## Apertura desde Moodle

El plugin abre el editor con un **código de apertura** de un solo uso
(60 s) en el fragmento de la URL: `#open=<código>&src=<content.php>`. El
fragmento no se envía a ningún servidor; el editor lo borra de la barra de
direcciones y lo canjea con `POST content.php {code}`, que devuelve el
material con el token de edición. El token solo vive en la memoria del
editor: se envía en el cuerpo de las peticiones (guardar, renovar, pedir
imágenes y recargar con `POST content.php {token}`), nunca en una URL.
El enlace «Publicar…» (`publish_url` del bloque LMS, solo si el usuario
puede publicar y del mismo origen que Moodle) no lleva token.

Formatos antiguos, con el token en la URL (solo si el plugin tiene activo
su ajuste `legacy_open_url`, pensado para el fork de LiveEditor):

- `?url=<content.php…>`, o
- `?/open/file/<content.php…>` (y `?%2Fopen%2Ffile%2F…`).

## Imágenes

Las imágenes viven en el repositorio de contenidos, junto al material
(`img/…`), con rutas relativas en el Markdown, como en LiaScript.

- **Ver**: las rutas relativas se piden con `POST asset.php {token, path}`
  (`asset_endpoint` del bloque LMS) y se pintan como `blob:`
  (`src/lms/images.ts`, `proxyDomURL` de Crepe). Las absolutas, tal cual.
- **Subir** (botón «Subir» del bloque de imagen, solo si se puede guardar y
  el plugin sirve imágenes): la imagen se reduce a 1920 px como máximo y se
  recodifica a JPEG, o a PNG si tiene transparencia (sin EXIF; los GIF no se
  tocan). Se guarda como `img/<nombre>-<hash8>.<ext>` y queda **pendiente**
  (también en el borrador local) hasta el próximo guardado, que la envía en
  el mismo commit que el Markdown. Solo viajan las que el documento sigue
  usando (`src/lms/imageUpload.ts`).
- **Pegar y arrastrar**: igual que el botón. Varias imágenes a la vez se
  preparan una a una; las que no se admiten (SVG, demasiado grandes) se
  saltan con aviso y el resto entra (`src/editor/imagePaste.ts`; el uploader
  de Crepe dejaba el marcador «Upload in progress...» colgado si fallaba una).
- **Texto alternativo**: el pie que se edita bajo la imagen es su texto
  alternativo (`![texto](ruta)`). Crepe usaba ese campo para la proporción;
  `src/editor/imageBlock.ts` lo corrige. Si el material guardado tiene
  imágenes sin texto alternativo, un aviso lo indica (no impide guardar).
- **Ancho**: al pulsar una imagen aparece la barra *Ancho* (10–100 %, del
  ancho del texto o de la columna; 100 % = ancho imprimible del PDF). Se
  guarda como en LiaScript: `![alt](img/x.png)<!-- style="width: 40%;" -->`
  (`src/editor/imageWidth.ts`). El tirador de alto de Crepe se oculta: no
  se guardaba.
- **Borrar**: al guardar, el engine borra de Git las imágenes que el
  material deja de usar. Si se deshace el borrado después, el editor
  reenvía la imagen (`ImageStore`).
- **CSP**: añade `blob:` a `img-src`.

## Versión oficial (incorporar `main`)

La rama de edición del profesor sale de `main` y no se actualiza sola
(LIA-130). Al abrir el material y tras cada guardado, el editor pregunta a
`sync.php` (`sync_endpoint` del bloque LMS) si `main` trae cambios del
material que la rama no tiene:

- **Sin conflictos**: aviso y *Revisar e incorporar…*, con una vista lado a
  lado (`@codemirror/merge`) de la versión actual frente a cómo quedará.
- **Con conflictos**: misma vista, a la izquierda el material con la versión
  oficial en cada conflicto y a la derecha el resultado editable, que parte
  de la versión del profesor; las flechas toman la oficial (como Meld).
- **Fuera del material** (otros ficheros o material retirado de `main`):
  aviso para coordinación, sin incorporar.

*Incorporar* envía `{action: merge, head_sha, main_sha, content?}`; el engine
crea un commit de fusión y el editor recarga el material. Hay que guardar
antes. `MergeDialog.vue` y `@codemirror/merge` se cargan solo al abrir la
revisión (`src/lms/sync.ts`, `src/components/MergeDialog.vue`).

## Columnas

LiaScript no tiene clases de columnas, pero aplica el estilo de un `<div>` a
su Markdown. El editor lee y escribe este formato (comprobado con liaex y en
el PDF de contenido del engine), y lo edita como columnas, no como HTML
protegido (`src/liascript/columns.ts`, `columns-node.ts`):

```markdown
<div class="lia-columnas" style="display: flex; flex-wrap: wrap; gap: 1.5em;">
<div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">

Primera columna (cualquier bloque Markdown o LiaScript).

</div>
<div class="lia-columna" style="flex: 1 1 14em; min-width: 0;">

![Imagen](img/x.png)

</div>
</div>
```

Se insertan desde el menú «/» o el panel LiaScript: *Dos columnas*, *Texto
e imagen* y *Dos imágenes lado a lado*. De 2 a 3 columnas; si las marcas no
forman una estructura completa, quedan como HTML protegido.

## Despliegue

`npm run build` genera `dist/`, una app estática con rutas relativas. Hay
que servirla tras Nginx con HTTPS en un subdominio propio, que es el origen
que el plugin admite por CORS:

```nginx
server {
    listen 443 ssl http2;
    server_name editor.example.org;
    root /srv/fpvirtual-crepe-editor/dist;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://moodle.example.org; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header X-Content-Type-Options "nosniff" always;
    location / { try_files $uri /index.html; }
}
```

Cabeceras de protección (LIA-063):

- **`Referrer-Policy: no-referrer`** (también como `<meta name="referrer">`
  en `index.html`): las imágenes y enlaces externos del material no reciben
  la URL del editor.
- **CSP**: solo conecta con el propio editor y con Moodle (`connect-src`:
  pon ahí el origen real de Moodle); sin plugins, sin `<base>` ajeno y sin
  poder incrustarse en otra web (`frame-ancestors 'none'`).

Comprobación: `curl -I https://editor.example.org/` muestra las tres
cabeceras.

## Licencia

AGPL-3.0 (ver [LICENSE](LICENSE)).
