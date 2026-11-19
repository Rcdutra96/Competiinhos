export interface CompressedImageResult {
  blob: Blob;
  contentType: 'image/webp' | 'image/jpeg';
  extension: 'webp' | 'jpg';
  width: number;
  height: number;
  sizeBytes: number;
  formattedSize: string;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 1024) {
    return `${Math.max(0, Math.round(bytes))} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });
}

function computeTargetDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxSide: number
): { width: number; height: number } {
  const safeW = Math.max(1, sourceWidth);
  const safeH = Math.max(1, sourceHeight);
  const longest = Math.max(safeW, safeH);
  const scale = longest > maxSide ? maxSide / longest : 1;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export async function compressCanvasToBlob(
  canvas: HTMLCanvasElement
): Promise<CompressedImageResult> {
  const webpBlob = await canvasToBlob(canvas, 'image/webp', 0.65);
  if (webpBlob && webpBlob.type === 'image/webp') {
    return {
      blob: webpBlob,
      contentType: 'image/webp',
      extension: 'webp',
      width: canvas.width,
      height: canvas.height,
      sizeBytes: webpBlob.size,
      formattedSize: formatFileSize(webpBlob.size),
    };
  }

  const jpegBlob = await canvasToBlob(canvas, 'image/jpeg', 0.68);
  if (jpegBlob) {
    return {
      blob: jpegBlob,
      contentType: 'image/jpeg',
      extension: 'jpg',
      width: canvas.width,
      height: canvas.height,
      sizeBytes: jpegBlob.size,
      formattedSize: formatFileSize(jpegBlob.size),
    };
  }

  throw new Error('Não foi possível comprimir a imagem neste navegador.');
}

export async function compressVideoFrame(
  video: HTMLVideoElement,
  maxSide = 1080
): Promise<CompressedImageResult> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) {
    throw new Error('A câmera ainda não está pronta para captura.');
  }

  const { width, height } = computeTargetDimensions(vw, vh, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto gráfico indisponível para capturar a foto.');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(video, 0, 0, width, height);

  return compressCanvasToBlob(canvas);
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Não foi possível decodificar a imagem selecionada.'));
    img.src = objectUrl;
  });
}

export async function compressImageFile(
  file: File | Blob,
  maxSide = 1080
): Promise<CompressedImageResult> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const { width, height } = computeTargetDimensions(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxSide
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexto gráfico indisponível para comprimir a foto.');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    return await compressCanvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
