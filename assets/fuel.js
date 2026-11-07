"use strict";

const KG_PER_POUND = 0.45359237;
const VOLUME_UNITS = Object.freeze({
  litres: { label: "litres", litresPerUnit: 1 },
  usGallons: { label: "US gallons", litresPerUnit: 3.785411784 },
  imperialGallons: { label: "imperial gallons", litresPerUnit: 4.54609 }
});
const MASS_UNITS = Object.freeze({
  kg: { label: "kg", minimumTolerance: 0.5 },
  lbs: { label: "lbs", minimumTolerance: 1 }
});

function massToKilograms(quantity, unit) {
  if (!Object.hasOwn(MASS_UNITS, unit) || !Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Mass must be finite and nonnegative, in kg or lbs.");
  }
  const kg = unit === "kg" ? quantity : quantity * KG_PER_POUND;
  if (!Number.isFinite(kg)) throw new Error("Converted mass must remain finite.");
  return kg;
}

function fuelVolumeToLitres(quantity, volumeUnit) {
  if (!Object.hasOwn(VOLUME_UNITS, volumeUnit) || !Number.isFinite(quantity) || quantity < 0) {
    throw new Error("Fuel volume must be finite and nonnegative, in litres, US gallons, or imperial gallons.");
  }
  const litres = quantity * VOLUME_UNITS[volumeUnit].litresPerUnit;
  if (!Number.isFinite(litres)) throw new Error("Fuel volume must remain finite.");
  return litres;
}

function fuelQuantityFromLitres(litres, unit, specificGravity) {
  if ((!Object.hasOwn(VOLUME_UNITS, unit) && !Object.hasOwn(MASS_UNITS, unit)) ||
      !Number.isFinite(litres) || litres < 0 || !Number.isFinite(specificGravity) || specificGravity <= 0) {
    throw new Error("Fuel volume must be finite and nonnegative, specific gravity positive, and the requested unit supported.");
  }
  let quantity;
  if (Object.hasOwn(VOLUME_UNITS, unit)) {
    quantity = litres / VOLUME_UNITS[unit].litresPerUnit;
  } else {
    const kg = litres * specificGravity;
    quantity = unit === "kg" ? kg : kg / KG_PER_POUND;
  }
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("Converted fuel quantity must be finite and nonnegative.");
  return quantity;
}
