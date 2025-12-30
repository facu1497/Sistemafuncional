# PDF.js local (v3.11.174)

Este directorio debe contener la versión local de PDF.js usada por la aplicación:

- `pdf.min.js`
- `pdf.worker.min.js`

Para poblarlos, descargá los builds oficiales de la versión 3.11.174 (por ejemplo desde cdnjs) y reemplazá los archivos placeholder. Luego, si querés calcular el hash SRI para el CDN, podés usar:

```bash
openssl dgst -sha256 -binary pdf.min.js | openssl base64 -A
```

Anteponé el prefijo `sha256-` al resultado para completar el atributo `integrity`.

La descarga directa no se ejecutó en este entorno por restricciones de red, por lo que quedaron placeholders para que completes los archivos reales.