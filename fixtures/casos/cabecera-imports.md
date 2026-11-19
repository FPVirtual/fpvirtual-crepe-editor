<!--
author:   Equipo FP Virtual
email:    equipo@example.org
version:  1.2.0
language: es
narrator: Spanish Female
title:    Cabecera con imports y macros

import: https://raw.githubusercontent.com/LiaTemplates/Pyodide/0.1.4/README.md
        https://raw.githubusercontent.com/liaTemplates/AVR8js/main/README.md

@nota
<div class="nota" style="border-left: 4px solid #2b7; padding: .5em 1em">
**Nota:** @0
</div>
@end

@aviso: <span class="aviso">⚠ @0</span>

script: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js
-->

# Cabecera con imports y macros

La cabecera define dos macros propias (`@nota` y `@aviso`) y dos imports
con versión fijada.

@nota(Este párrafo usa la macro de nota definida en la cabecera.)

Un aviso en línea: @aviso(cuidado con la versión de PHP) dentro de prosa.

## Sección normal

Texto que **no** usa nada de LiaScript y debe poder editarse.
