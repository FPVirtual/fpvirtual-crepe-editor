# Macros y bloques ejecutables

## Código ejecutable

```js
let suma = 0
for (let i = 1; i <= 10; i++) suma += i
console.log(suma)
```
<script>@input</script>

## Proyecto con varios ficheros

```js     -main.js
import { saludo } from './saludo.js'
console.log(saludo('mundo'))
```
```js     +saludo.js
export const saludo = (n) => `Hola, ${n}`
```
@LIA.eval(`["main.js", "saludo.js"]`, `node main.js`)

## SQL con plantilla

```sql
SELECT * FROM alumnos WHERE curso = '2DAW';
```
@AlaSQL.eval

## Python con Pyodide

```python
import math
print(math.sqrt(16))
```
@Pyodide.eval

## Diagrama Mermaid con macro

```text @mermaid
graph LR
  A[Profesor] --> B[Editor]
  B --> C[Git]
```

## Vídeo, audio y oEmbed

!?[Introducción al MVC](https://www.youtube.com/watch?v=dQw4w9WgXcQ)

?[Pronunciación](https://example.org/audio.mp3)

??[Mapa](https://www.openstreetmap.org/#map=10/40.4/-3.7)

## Texto con subíndices y superíndices

La fórmula del agua es H~2~O y la energía E=mc^2^.

## Código Java con anotaciones (no son macros)

```java
@Override
public String toString() { return "ok"; }
```

Un correo como profesor@example.org no es una macro.
