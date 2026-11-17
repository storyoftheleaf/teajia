type ParcelLine = { quantity: number; quantity_unit: string };

/** A single approved parcel profile for retail tea exports. */
export function quoteUsCheckoutShipping(
  lines: ParcelLine[],
  rateUsdPerKg: string | undefined,
  packagingGrams: string | undefined,
  maxPackedGrams: string | undefined,
): { usd: number; packedGrams: number } | null {
  if (!/^\d+(\.\d{1,2})?$/.test(rateUsdPerKg ?? '') ||
      !/^\d+$/.test(packagingGrams ?? '') || !/^\d+$/.test(maxPackedGrams ?? '') ||
      !lines.length || lines.some(line => line.quantity_unit !== 'g' ||
        !Number.isSafeInteger(line.quantity) || line.quantity <= 0)) return null;

  const rateCents = Math.round(Number(rateUsdPerKg) * 100);
  const maxGrams = Number(maxPackedGrams);
  const packedGrams = lines.reduce((sum, line) => sum + line.quantity, Number(packagingGrams));
  const costInThousandthsOfACent = packedGrams * rateCents;
  if (rateCents <= 0 || !Number.isSafeInteger(maxGrams) || !Number.isSafeInteger(costInThousandthsOfACent) ||
      packedGrams > maxGrams) return null;

  const cents = Math.round(costInThousandthsOfACent / 1000);
  return cents > 0 ? { usd: cents / 100, packedGrams } : null;
}
