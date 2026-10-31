import type { StudioImage } from "./profile";

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_EDGE = 1600;
const MAX_DATA_URL = 3_200_000;

export async function fileToStudioImage(file: File): Promise<StudioImage> {
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    throw new Error("Use a PNG, JPEG or WebP image.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Image must be under 12 MB.");
  }
  const url = URL.createObjectURL(file);
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The source image could not be decoded."));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
  const width = Math.max(1, Math.round(bitmap.naturalWidth * scale));
  const height = Math.max(1, Math.round(bitmap.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read the image.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL && quality > 0.5) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > MAX_DATA_URL) {
    throw new Error("Image is still too large. Try a smaller photo.");
  }
  return { dataUrl, name: file.name, width, height };
}
