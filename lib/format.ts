export function formatMass(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg`;
  if (grams >= 10) return `${grams.toFixed(1)} g`;
  return `${grams.toFixed(2)} g`;
}

export function formatVolume(mm3: number): string {
  if (mm3 >= 1_000_000) return `${(mm3 / 1_000_000).toFixed(2)} L`;
  return `${(mm3 / 1000).toFixed(1)} cm³`;
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatMeasure(value: number, unit?: string): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  if (!unit) return `${rounded}`;
  if (unit === "deg") return `${rounded}°`;
  return `${rounded} ${unit}`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
