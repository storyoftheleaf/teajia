/**
 * Client-side image compression via canvas API.
 * Resizes to fit within maxDimension and converts to JPEG.
 *
 * Pass `square: true` to center-crop the input to a square before resizing:
 * useful for entry photos that always render in square thumbnails so we don't
 * waste DB bytes on letterboxed pixels nobody ever sees.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.75,
  options?: { square?: boolean }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Source rect, center-cropped to a square if requested
      let srcX = 0;
      let srcY = 0;
      let srcW = img.width;
      let srcH = img.height;
      if (options?.square) {
        const side = Math.min(srcW, srcH);
        srcX = Math.round((srcW - side) / 2);
        srcY = Math.round((srcH - side) / 2);
        srcW = side;
        srcH = side;
      }

      // Destination rect, scaled to fit within maxDimension while preserving
      // the (possibly cropped) source aspect ratio
      let dstW = srcW;
      let dstH = srcH;
      if (dstW > maxDimension || dstH > maxDimension) {
        if (dstW > dstH) {
          dstH = Math.round((dstH * maxDimension) / dstW);
          dstW = maxDimension;
        } else {
          dstW = Math.round((dstW * maxDimension) / dstH);
          dstH = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, dstW, dstH);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
