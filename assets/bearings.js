"use strict";

function normalize(angle) {
  return ((angle % 360) + 360) % 360;
}

function signedAngle(angle) {
  return normalize(angle + 180) - 180;
}

function formatBearing(angle, decimals = 0) {
  const rounded = normalize(Number(normalize(angle).toFixed(decimals)));
  return rounded.toFixed(decimals).padStart(decimals ? 4 + decimals : 3, "0") + "\u00b0";
}
