# Informe M0 — PoC del editor Crepe (go/no-go)

**Fecha**: 2026-11-19 · **Versiones**: `@milkdown/crepe` 7.23.0, Vue 3.5.45,
Vite 8.3.8 · **Imagen liaex**: `liascript/exporter:latest` (3,9 GB)

## Resumen

**Recomendación: GO condicionado.** Todos los umbrales cuantitativos de la
Fase 0 se cumplen sobre el corpus disponible. Hay dos condiciones antes de
comprometer M1:

1. **Ampliar el corpus con materiales reales de producción.** Hoy son solo
   3 materiales reales, y son cortos, más 5 casos extremos escritos a mano
   (ver «Limitaciones»).
2. **Redefinir R7.** liaex no detecta errores de sintaxis, así que la
   «validación síncrona» tal como está escrita no es posible (ver §4).

## 1. Umbrales de la Fase 0

| Criterio | Umbral | Resultado | |
| --- | --- | --- | --- |
| Fixtures sin diff semántico (`parse → serializar`) | ≥ 95 % | **8/8 (100 %)**, mdast idéntico | ✅ |
| Constructos cubiertos por nodo propio o fallback | 100 % | **100 %**: todo bloque LiaScript llega literal a la salida, también tras editar | ✅ |
| Guardar sin editar es idempotente | — | **8/8 byte a byte** | ✅ |
| Una edición solo toca su bloque | — | **8/8**, y 1 línea de diff en el tema largo | ✅ |
| liaex acepta el serializado y el render es equivalente | todos | **8/8** según la huella `fullJson`, en el peor caso (todo re-serializado) | ✅ |
| Validación con liaex por documento | < ~3 s | **0,85–1,3 s** con contenedor en frío, pero no valida (§4) | ⚠️ |
| Bundle y carga con tema de 50+ páginas | aceptable | inicial **1,50 MB (472 kB gzip)** + 84 kB CSS; tema de 3107 líneas: apertura **1,6 s**, guardado **≈ 70 ms** (jsdom, cota superior) | ✅ |

## 2. Round-trip por fixture

| Fixture | Bloques | Protegido | Tipos protegidos |
| --- | --- | --- | --- |
| real/demo-liascript | 31 | 24 % | quiz ×4, inline ×2 |
| real/ut03-mvc | 27 | 12 % | quiz ×3 |
| real/ut04-pdo | 26 | 10 % | quiz ×3 |
| casos/cabecera-imports | 6 | 39 % | macro ×2 |
| casos/efectos-narracion | 9 | 82 % | effect ×5, html ×1 |
| casos/macros-ejecutables | 20 | 64 % | code-meta, macro, html, inline |
| casos/prosa-gfm | 20 | 16 % | inline ×2, unknown ×1 |
| casos/quizzes | 21 | 60 % | quiz ×7 |

«Protegido» es la fracción del cuerpo que se ve como tarjeta y no se edita
en vista visual. En los materiales reales, que son sobre todo prosa, es del
10–24 %. En documentos muy cargados de LiaScript es mucho mayor; la Fase 2
(formularios de quiz, cajas, Mermaid) es la que lo reduce.

## 3. Decisiones de diseño validadas

- **Recorte literal por posiciones** en lugar de re-serializar la sintaxis
  LiaScript: nada se escapa ni se normaliza (`[[X]]` nunca pasa a `\[\[X]]`).
- **El transformer LiaScript va el primero** de la cadena remark: Milkdown
  resuelve y elimina las definiciones `[ref]: url` antes que nadie, y se
  perderían.
- **Agrupación por adyacencia**: `--{{1}}--` + texto, código + `<script>`
  o `@macro`, `<!-- data-… -->` + tabla, y bloques `****` (animaciones,
  soluciones de quiz). Si no se agrupan, el serializador los separa con una
  línea en blanco y LiaScript pierde la asociación.
- **Preservación por nodo**: cada nodo de nivel superior se serializa
  aislado y se empareja con la forma canónica de su bloque original. Es
  robusto frente a listas contiguas que remark fusiona al re-parsear (la
  primera versión, por re-parseo, fallaba con ellas).
- **Encabezados setext protegidos**: LiaScript solo abre sección con `#`;
  Milkdown convertiría el setext en `##` y crearía una sección nueva (lo
  detectó `liaex:check`).

## 4. Hallazgos que afectan al roadmap

1. **R7 no es viable tal como está escrita.** El parser de LiaScript es
   tolerante: `liaex` termina con código 0 incluso con cabecera sin cerrar
   (que pierde en silencio), quizzes rotos o vallas de código sin cerrar.
   No hay «errores con línea» que devolver en un 422. Propuesta: sustituirla
   por una **comprobación estructural** en el engine (~1 s): la huella
   `fullJson` del documento a guardar frente a la versión anterior. Avisaría
   (sin bloquear) si desaparecen secciones, quizzes o encuestas, o si cambia
   su tipo, y bloquearía solo si la cabecera queda vacía cuando la fuente
   empieza por `<!--`.
2. **liaex necesita red con `import:`.** Descarga los templates en cada
   ejecución (`Load_ReadMe_Result -> Network error` con `--network none`).
   El engine lanza liaex con `--network none`, así que **publicar falla con
   cualquier material que importe templates**. Hay que permitir salida HTTP
   (idealmente con lista de dominios permitidos) o resolver los imports
   antes.
3. **Errores de contenido en `demo-liascript.md`**, confirmados con la
   huella de liaex: la sección «opción única» (`[[( )]]`/`[[(X)]]`) se
   interpreta como dos quizzes de texto con respuesta «( )» y «(X)», y
   «Encuestas (sin nota)» (`[( )]`) es en realidad un quiz puntuable.
4. **La inyección del bloque `liascript-lms` no es reversible** (`lib.php`
   hace `rtrim` de la cabecera y añade una línea en blanco). El editor
   compensa quitando esa línea al extraer el bloque, pero lo correcto es
   inyectar sin alterar la cabecera.
5. **Contrato de apertura**: el plugin genera `?/open/file/<url>`, la ruta
   del fork, y no `?url=`. El editor acepta ambas, así que se puede probar
   cambiando solo `liaeditor_url`.

## 5. Limitaciones de esta medición

- **Corpus pequeño**: 3 materiales reales cortos. Antes de M1 hacen falta
  materiales reales de producción, sobre todo los que usen el template de
  cajas `@nota/@aviso/@error` (aún no visto) y temas de 50+ páginas reales
  en vez del sintético.
- Rendimiento medido en **jsdom** (cota superior). Falta medir en navegador
  con un tema real (Fase 4).
- El bundle inicial incluye KaTeX y CodeMirror; cargarlos bajo demanda
  (P6) queda para M4.
- La interfaz solo se ha comprobado con una captura headless de Chrome
  (prosa, KaTeX, código, tarjetas de quiz y fuente protegida). No hay
  pruebas e2e de interacción.

## 6. Siguientes pasos propuestos (M1)

1. Conseguir materiales reales y añadirlos a `fixtures/real/`.
2. Decidir el nuevo R7 (comprobación estructural, §4.1) y su contrato
   (aviso frente a 422).
3. Backend: red para liaex con imports; inyección reversible del bloque LMS.
4. Editor: port de `LmsBridge` (save/409/401/refresh), barra de guardado,
   panel de cabecera, modo fuente y snapshot en IndexedDB.
