const PDF_JS_VERSION = "3.11.174";
const PDF_JS_CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}`;
const PDF_JS_CDN = `${PDF_JS_CDN_BASE}/pdf.min.js`;
const PDF_JS_WORKER_CDN = `${PDF_JS_CDN_BASE}/pdf.worker.min.js`;
const PDF_JS_LOCAL = "vendor/pdfjs/pdf.min.js";
const PDF_JS_WORKER_LOCAL = "vendor/pdfjs/pdf.worker.min.js";
// TODO: Sustituir cuando se disponga del hash real del archivo.
const PDF_JS_CDN_INTEGRITY = null;

let pdfJsPromise;
let pdfSource = "cdn";

function configurePdfWorker(pdfLib, source = "cdn") {
  if (pdfLib?.GlobalWorkerOptions) {
    const workerSrc = source === "local" ? PDF_JS_WORKER_LOCAL : PDF_JS_WORKER_CDN;
    if (pdfLib.GlobalWorkerOptions.workerSrc !== workerSrc) {
      pdfLib.GlobalWorkerOptions.workerSrc = workerSrc;
    }
  }
}

function loadScript(src, { integrity, crossOrigin } = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = crossOrigin || "anonymous";
    } else if (crossOrigin) {
      script.crossOrigin = crossOrigin;
    }
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar el script: ${src}`));
    document.head.appendChild(script);
  });
}

async function loadPdfJsFromCdn() {
  await loadScript(PDF_JS_CDN, { integrity: PDF_JS_CDN_INTEGRITY, crossOrigin: "anonymous" });
  if (!window.pdfjsLib) throw new Error("PDF.js se cargó desde CDN pero no expuso pdfjsLib.");
  pdfSource = "cdn";
  configurePdfWorker(window.pdfjsLib, pdfSource);
  return window.pdfjsLib;
}

async function loadPdfJsFromLocal() {
  await loadScript(PDF_JS_LOCAL);
  if (!window.pdfjsLib) throw new Error("La copia local de PDF.js no expuso pdfjsLib.");
  pdfSource = "local";
  configurePdfWorker(window.pdfjsLib, pdfSource);
  return window.pdfjsLib;
}

/**
 * Carga PDF.js (si no está ya presente) y configura el worker.
 * Devuelve una promesa que resuelve con `pdfjsLib`.
 */
function loadPdfJs() {
  if (pdfJsPromise) return pdfJsPromise;

  pdfJsPromise = new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      const currentWorker = window.pdfjsLib?.GlobalWorkerOptions?.workerSrc || "";
      if (currentWorker.includes(PDF_JS_WORKER_LOCAL)) {
        pdfSource = "local";
      }
      configurePdfWorker(window.pdfjsLib, pdfSource);
      resolve(window.pdfjsLib);
      return;
    }

    loadPdfJsFromCdn()
      .then(resolve)
      .catch(async (cdnError) => {
        console.warn("No se pudo cargar PDF.js desde CDN, intentando copia local.", cdnError);
        try {
          const lib = await loadPdfJsFromLocal();
          resolve(lib);
        } catch (localError) {
          reject(new Error(`Falló la carga de PDF.js. CDN: ${cdnError.message}. Local: ${localError.message}`));
        }
      });
  });

  return pdfJsPromise;
}

window.loadPdfJs = loadPdfJs;