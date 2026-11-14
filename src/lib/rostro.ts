/**
 * Reconocimiento facial en el navegador con face-api.js (RF-16).
 * La librería y los modelos (public/modelos, ~7 MB) se cargan solo al llegar a la
 * verificación. Las imágenes no salen del navegador para la comparación.
 */
type FaceApi = typeof import('face-api.js');
type Entrada = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

let carga: Promise<FaceApi> | null = null;

export function cargarModelos(): Promise<FaceApi> {
  carga ??= (async () => {
    const faceapi = await import('face-api.js');
    const ruta = `${import.meta.env.BASE_URL}modelos`;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(ruta),
      faceapi.nets.faceLandmark68Net.loadFromUri(ruta),
      faceapi.nets.faceRecognitionNet.loadFromUri(ruta),
    ]);
    return faceapi;
  })().catch((e) => { carga = null; throw e; });
  return carga;
}

export interface Punto { x: number; y: number }
export interface LecturaRostro {
  /** Número de rostros detectados en la imagen. */
  cantidad: number;
  /** Puntos faciales del rostro principal (68 puntos). */
  puntos?: Punto[];
  /** Caja del rostro principal, relativa al tamaño de la imagen (0–1). */
  caja?: { x: number; y: number; ancho: number; alto: number };
}

function dimensiones(el: Entrada) {
  if (el instanceof HTMLVideoElement) return { w: el.videoWidth, h: el.videoHeight };
  if (el instanceof HTMLImageElement) return { w: el.naturalWidth, h: el.naturalHeight };
  return { w: el.width, h: el.height };
}

/** Detección rápida con puntos faciales (para la prueba de vida en video). */
export async function leerRostro(el: Entrada, tamano = 224): Promise<LecturaRostro> {
  const faceapi = await cargarModelos();
  const r = await faceapi
    .detectAllFaces(el, new faceapi.TinyFaceDetectorOptions({ inputSize: tamano, scoreThreshold: 0.5 }))
    .withFaceLandmarks();
  if (!r.length) return { cantidad: 0 };
  const principal = r.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a));
  const { w, h } = dimensiones(el);
  const b = principal.detection.box;
  return {
    cantidad: r.length,
    puntos: principal.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
    caja: { x: b.x / w, y: b.y / h, ancho: b.width / w, alto: b.height / h },
  };
}

/**
 * Descriptor facial (128 valores) del rostro más grande de la imagen.
 * Para la foto del DNI el rostro es pequeño: se usa una entrada más grande.
 */
export async function descriptor(el: Entrada, tamano = 416): Promise<Float32Array | null> {
  const faceapi = await cargarModelos();
  const r = await faceapi
    .detectAllFaces(el, new faceapi.TinyFaceDetectorOptions({ inputSize: tamano, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (!r.length) return null;
  return r.reduce((a, b) => (b.detection.box.area > a.detection.box.area ? b : a)).descriptor;
}

/**
 * Descriptor más confiable para fotos donde el rostro sale pequeño (p. ej. la foto del DNI):
 * 1) busca la cara probando varios tamaños de entrada y un umbral bajo,
 * 2) la recorta con margen y la amplía a ~400 px,
 * 3) calcula el descriptor sobre ese recorte (los puntos faciales salen mucho más precisos).
 */
export async function descriptorRobusto(el: HTMLCanvasElement | HTMLImageElement): Promise<Float32Array | null> {
  const faceapi = await cargarModelos();
  const { w, h } = dimensiones(el);

  let caja: { x: number; y: number; width: number; height: number } | null = null;
  for (const tam of [608, 416, 320]) {
    const det = await faceapi.detectAllFaces(el, new faceapi.TinyFaceDetectorOptions({ inputSize: tam, scoreThreshold: 0.3 }));
    if (det.length) {
      const b = det.reduce((a, c) => (c.box.area > a.box.area ? c : a)).box;
      caja = { x: b.x, y: b.y, width: b.width, height: b.height };
      break;
    }
  }
  if (!caja) return null;

  const margen = 0.6;
  const sx = Math.max(0, caja.x - caja.width * margen);
  const sy = Math.max(0, caja.y - caja.height * margen);
  const sw = Math.min(w - sx, caja.width * (1 + 2 * margen));
  const sh = Math.min(h - sy, caja.height * (1 + 2 * margen));
  const escala = 400 / sw;
  const recorte = document.createElement('canvas');
  recorte.width = Math.round(sw * escala);
  recorte.height = Math.round(sh * escala);
  const ctx = recorte.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(el, sx, sy, sw, sh, 0, 0, recorte.width, recorte.height);

  const r = await faceapi
    .detectSingleFace(recorte, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return r?.descriptor ?? descriptor(el, 608);
}

export function distancia(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

/* ---------- Prueba de vida a partir de los 68 puntos faciales ---------- */
const d = (p: Punto, q: Punto) => Math.hypot(p.x - q.x, p.y - q.y);

/** Relación de aspecto del ojo (EAR): baja bruscamente al parpadear. */
export function aperturaOjos(p: Punto[]) {
  const ear = (o: Punto[]) => (d(o[1], o[5]) + d(o[2], o[4])) / (2 * d(o[0], o[3]));
  return (ear(p.slice(36, 42)) + ear(p.slice(42, 48))) / 2;
}

/** Giro horizontal de la cabeza: 0.5 = de frente; se aleja de 0.5 al girar. */
export function giroCabeza(p: Punto[]) {
  const izq = p[0].x, der = p[16].x, nariz = p[30].x;
  return (nariz - izq) / (der - izq);
}

/** Toma un cuadro del video (o redimensiona una imagen) y lo devuelve como JPEG de lado máximo `maximo` px. */
export function aJpeg(el: HTMLVideoElement | HTMLImageElement, espejo = false, maximo = 1280): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  const { w, h } = dimensiones(el);
  const escala = Math.min(1, maximo / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  const ctx = canvas.getContext('2d')!;
  if (espejo) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok({ blob: b, canvas }) : mal(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85));
}
