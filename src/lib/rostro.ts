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

/** Toma un cuadro del video (o redimensiona una imagen) y lo devuelve como JPEG ≤ 1280 px. */
export function aJpeg(el: HTMLVideoElement | HTMLImageElement, espejo = false): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  const { w, h } = dimensiones(el);
  const escala = Math.min(1, 1280 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * escala);
  canvas.height = Math.round(h * escala);
  const ctx = canvas.getContext('2d')!;
  if (espejo) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok({ blob: b, canvas }) : mal(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85));
}
