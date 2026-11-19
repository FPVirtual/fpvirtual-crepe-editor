# Prosa GFM

Subtítulo setext
----------------

Texto con *énfasis con asterisco*, _énfasis con guion bajo_, __negrita con
guiones__ y **negrita con asteriscos**. Una línea con salto duro  
y otra con barra invertida\
para terminar.

* Lista con asteriscos
* Segundo elemento
    * Anidado con cuatro espacios

- Lista con guiones
+ Lista con más

3. Lista que empieza en tres
4. Cuarto

1) Lista con paréntesis
2) Segundo

- [ ] Tarea pendiente
- [x] Tarea hecha

| Izquierda | Centro | Derecha |
|:----------|:------:|--------:|
| a | b | c |
|largo sin espacios|x|1|

Enlace automático <https://example.org> y referencia [a la doc][doc].

[doc]: https://liascript.github.io/ "Documentación"

Caracteres especiales: 5 * 3, a_b_c, 100 % seguro, #no-titulo, [corchetes].

***

> Cita con **negrita**
>
> y segundo párrafo.

```
bloque de código sin lenguaje
```

~~~php
<?php echo "tildes como valla"; ?>
~~~

Nota al pie[^n].

[^n]: Texto de la nota.

Fórmula en línea $a^2 + b^2 = c^2$ y en bloque:

$$
x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}
$$
