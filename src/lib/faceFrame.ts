/**
 * Finding a face in a photo, so the photo editor can open with the face
 * already centred and filling the frame, the way a phone's editor does.
 *
 * The browser's own FaceDetector is used where it exists. Everywhere else a
 * small face model (MediaPipe's BlazeFace, 230 KB) runs on the device. The
 * model and its engine are served from this site, never a Google address, so
 * it works from China too, and they load only the first time a photo editor
 * opens. Nothing leaves the device.
 *
 * Finding no face is a normal answer: the editor then opens on the whole
 * photo, as it always did.
 */
import type { PixelCrop } from './cropImage';
import modelUrl from './faceModel/blaze_face_short_range.tflite?url';
import wasmLoaderPath from '@mediapipe/tasks-vision/wasm/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm?url';

/** A face's box in the photo's own pixels. */
export interface FaceBox { x: number; y: number; width: number; height: number; score?: number }

type Detect = (image: HTMLImageElement | HTMLCanvasElement) => Promise<FaceBox[]>;

let detectorPromise: Promise<Detect | null> | null = null;

interface NativeFaceDetector { detect(image: CanvasImageSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>> }

async function nativeDetector(): Promise<Detect | null> {
  const Native = (globalThis as unknown as { FaceDetector?: new (o: object) => NativeFaceDetector }).FaceDetector;
  if (!Native) return null;
  try {
    const native = new Native({ fastMode: true, maxDetectedFaces: 5 });
    // Some browsers expose the name but refuse to run it; try once.
    const probe = document.createElement('canvas'); probe.width = probe.height = 8;
    await native.detect(probe);
    return async image => (await native.detect(image)).map(face => ({
      x: face.boundingBox.x, y: face.boundingBox.y, width: face.boundingBox.width, height: face.boundingBox.height,
    }));
  } catch { return null; }
}

async function modelDetector(): Promise<Detect | null> {
  try {
    const { FaceDetector } = await import('@mediapipe/tasks-vision');
    const detector = await FaceDetector.createFromOptions(
      { wasmLoaderPath, wasmBinaryPath },
      { baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' }, runningMode: 'IMAGE', minDetectionConfidence: 0.55 },
    );
    return async image => detector.detect(image).detections.flatMap(found => found.boundingBox ? [{
      x: found.boundingBox.originX, y: found.boundingBox.originY,
      width: found.boundingBox.width, height: found.boundingBox.height,
      score: found.categories?.[0]?.score,
    }] : []);
  } catch { return null; }
}

function getDetector(): Promise<Detect | null> {
  detectorPromise ??= (async () => (await nativeDetector()) ?? (await modelDetector()))();
  return detectorPromise;
}

/** Load a picture for detecting. Same rules as the editor: CORS-clean so the canvas can read it. */
export function loadFaceImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

const biggest = (faces: FaceBox[]) => faces.reduce<FaceBox | null>((best, face) =>
  !best || face.width * face.height * (face.score ?? 1) > best.width * best.height * (best.score ?? 1) ? face : best, null);

/**
 * The main face in a photo, or null. Looks at the whole photo first; the face
 * model sees the photo small, so a face far off in a shop photo can be missed,
 * and then the four overlapping quarters are looked at closer.
 * Gives up quietly after `timeoutMs` so the editor is never held waiting.
 */
export async function findFace(image: HTMLImageElement, timeoutMs = 4000): Promise<FaceBox | null> {
  const work = (async () => {
    const detect = await getDetector();
    if (!detect || !image.naturalWidth) return null;
    const whole = biggest(await detect(image));
    if (whole) return whole;
    const W = image.naturalWidth, H = image.naturalHeight;
    const tw = Math.round(W * 0.6), th = Math.round(H * 0.6);
    const found: FaceBox[] = [];
    for (const [ox, oy] of [[0, 0], [W - tw, 0], [0, H - th], [W - tw, H - th]]) {
      const canvas = document.createElement('canvas');
      canvas.width = tw; canvas.height = th;
      canvas.getContext('2d')?.drawImage(image, ox, oy, tw, th, 0, 0, tw, th);
      for (const face of await detect(canvas)) found.push({ ...face, x: face.x + ox, y: face.y + oy });
    }
    return biggest(found);
  })().catch(() => null);
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([work, timeout]);
}

/**
 * The frame to open on, in percent of the photo (react-easy-crop's
 * `initialCroppedAreaPercentages`): the frame's shape, about two and a half
 * faces tall so head and shoulders show, the face a little above centre, kept
 * inside the photo. A face already filling the photo gives the whole photo.
 */
export function faceFramePercent(face: FaceBox, natural: { width: number; height: number }, aspect = 1): PixelCrop {
  const W = natural.width, H = natural.height;
  let height = Math.max(face.height, face.width) * 2.4;
  let width = height * aspect;
  const fit = Math.min(1, W / width, H / height);
  width *= fit; height *= fit;
  const cx = face.x + face.width / 2;
  const cy = face.y + face.height / 2 + height * 0.08;
  const x = Math.min(Math.max(0, cx - width / 2), W - width);
  const y = Math.min(Math.max(0, cy - height / 2), H - height);
  return { x: (x / W) * 100, y: (y / H) * 100, width: (width / W) * 100, height: (height / H) * 100 };
}

/** The same frame in the photo's pixels, for saving without opening the editor. */
export function faceFramePixels(face: FaceBox, natural: { width: number; height: number }, aspect = 1): PixelCrop {
  const p = faceFramePercent(face, natural, aspect);
  return {
    x: Math.round((p.x / 100) * natural.width), y: Math.round((p.y / 100) * natural.height),
    width: Math.round((p.width / 100) * natural.width), height: Math.round((p.height / 100) * natural.height),
  };
}
