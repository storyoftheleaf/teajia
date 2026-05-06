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
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d canvas context');

  // High-quality downscale.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      'image/jpeg',
      QUALITY,
    );
  });
}

// Convert a File or remote URL to an object URL the cropper can use without CORS issues.
// For remote http(s) URLs we fetch as a blob first so the canvas isn't tainted on export.
export async function fileOrUrlToObjectUrl(input: File | Blob | string): Promise<string> {
  if (typeof input !== 'string') {
    return URL.createObjectURL(input);
  }
  if (input.startsWith('data:') || input.startsWith('blob:')) {
    return input;
  }
  const res = await fetch(input, { mode: 'cors', cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
