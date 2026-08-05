// Produces a square JPEG Blob from a source image URL/blob and a pixel crop area
// (the format react-easy-crop returns via onCropComplete). Output is always
// 1:1 aspect ratio, sized to OUTPUT_SIZE × OUTPUT_SIZE. Used by SquareCropModal.

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUTPUT_SIZE = 1600;
const QUALITY = 0.88;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function cropToSquareBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  options?: { size?: number; quality?: number; rotation?: number },
): Promise<Blob> {
  const size = options?.size ?? OUTPUT_SIZE;
  const quality = options?.quality ?? QUALITY;
  const rotation = options?.rotation ?? 0;
  const image = await loadImage(imageSrc);

  // When a rotation is applied, react-easy-crop reports pixelCrop relative
  // to the rotated image bounding box, so we have to rotate the source
  // into a working canvas first, then crop from that.
  let source: CanvasImageSource = image;
  if (rotation % 360 !== 0) {
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const stageW = Math.ceil(image.width * cos + image.height * sin);
    const stageH = Math.ceil(image.width * sin + image.height * cos);
    const stage = document.createElement('canvas');
    stage.width = stageW;
    stage.height = stageH;
    const sctx = stage.getContext('2d');
    if (!sctx) throw new Error('Could not get 2d canvas context');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.translate(stageW / 2, stageH / 2);
    sctx.rotate(rad);
    sctx.drawImage(image, -image.width / 2, -image.height / 2);
    source = stage;
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d canvas context');

  // High-quality downscale.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    source,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/jpeg',
      quality,
    );
  });
}

// Convert a File / Blob into an object URL for the cropper. For string URLs
// (http(s) / data: / blob:) we just return the URL as-is and rely on the
// Cropper's internal <img> with crossOrigin='anonymous' for both display
// and canvas export. The previous fetch-to-blob roundtrip was a workaround
// for canvas tainting, but it had two failure modes: (a) any CORS hiccup
// on retry left the editor showing a black square with no error, and (b)
// React Strict Mode's double-invoke could revoke the blob URL the second
// invocation was using. Server-side, the upload host (R2) returns ACAO
// for these URLs anyway, so the fetch step bought nothing.
export async function fileOrUrlToObjectUrl(input: File | Blob | string): Promise<string> {
  if (typeof input !== 'string') {
    return URL.createObjectURL(input);
  }
  return input;
}
