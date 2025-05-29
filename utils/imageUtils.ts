
// utils/imageUtils.ts
export async function quantizeImageToPixelGrid(
  imageDataUrl: string,
  targetPixelWidth: number,
  targetPixelHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Important for canvas operations if image is from another origin

    img.onload = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      if (naturalWidth === 0 || naturalHeight === 0 || targetPixelWidth === 0 || targetPixelHeight === 0) {
        reject(new Error("Image or target dimensions for quantization are zero."));
        return;
      }

      // Canvas for drawing the source image to read its pixel data
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = naturalWidth;
      srcCanvas.height = naturalHeight;
      const ctxSrc = srcCanvas.getContext('2d');
      if (!ctxSrc) {
        reject(new Error("Could not get source canvas context for quantization."));
        return;
      }
      ctxSrc.drawImage(img, 0, 0);

      // Canvas for drawing the destination (quantized) image
      const destCanvas = document.createElement('canvas');
      destCanvas.width = targetPixelWidth;
      destCanvas.height = targetPixelHeight;
      const ctxDest = destCanvas.getContext('2d');
      if (!ctxDest) {
        reject(new Error("Could not get destination canvas context for quantization."));
        return;
      }
      
      ctxDest.imageSmoothingEnabled = false;

      for (let y = 0; y < targetPixelHeight; y++) {
        for (let x = 0; x < targetPixelWidth; x++) {
          // Calculate corresponding pixel in source image (nearest neighbor)
          const srcX = Math.floor(x * naturalWidth / targetPixelWidth);
          const srcY = Math.floor(y * naturalHeight / targetPixelHeight);
          
          const clampedSrcX = Math.max(0, Math.min(srcX, naturalWidth - 1));
          const clampedSrcY = Math.max(0, Math.min(srcY, naturalHeight - 1));

          const pixelData = ctxSrc.getImageData(clampedSrcX, clampedSrcY, 1, 1).data;
          
          ctxDest.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
          ctxDest.fillRect(x, y, 1, 1);
        }
      }
      resolve(destCanvas.toDataURL('image/png'));
    };

    img.onerror = (errorEvent) => {
      console.error("Error loading image for quantization processing:", errorEvent);
      reject(new Error("Failed to load image for quantization. Check console for details."));
    };

    img.src = imageDataUrl;
  });
}
