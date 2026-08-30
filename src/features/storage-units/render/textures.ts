"use client";

import * as THREE from "three";

/**
 * One wall panel: a white partition surface with a blue roll-up door (or, rarely, a
 * repainted grey one) inset in the middle — matching a real storage corridor, where most
 * of the wall is plain and the door is the accent, not the other way around. Baked
 * straight into the canvas rather than split across separate wall/door geometry, so the
 * per-zone wall tint (multiplied over this texture) only needs to stay close to white.
 */
export function makeDoorTexture(paintedGrey: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f0f0ee";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#dcdcd8";
  ctx.fillRect(0, size - 10, size, 10); // base/kick plate line

  const doorBase = paintedGrey ? "#9aa0a6" : "#1f4fc4";
  const doorShade = paintedGrey ? "#80868c" : "#173d99";
  const doorLeft = size * 0.13;
  const doorRight = size * 0.87;
  const doorTop = size * 0.06;
  const doorBottom = size * 0.92;
  const doorWidth = doorRight - doorLeft;

  // Track frame around the door opening.
  ctx.fillStyle = "#1a2036";
  ctx.fillRect(doorLeft - 6, doorTop - 6, doorWidth + 12, doorBottom - doorTop + 12);

  // Corrugated ribs, clipped to the door opening.
  ctx.save();
  ctx.beginPath();
  ctx.rect(doorLeft, doorTop, doorWidth, doorBottom - doorTop);
  ctx.clip();
  ctx.fillStyle = doorBase;
  ctx.fillRect(doorLeft, doorTop, doorWidth, doorBottom - doorTop);
  const ribWidth = 9;
  for (let x = doorLeft; x < doorRight; x += ribWidth) {
    ctx.fillStyle = (Math.round((x - doorLeft) / ribWidth)) % 2 === 0 ? doorShade : doorBase;
    ctx.fillRect(x, doorTop, ribWidth / 2, doorBottom - doorTop);
  }
  ctx.restore();

  // Handle.
  ctx.fillStyle = "#12162a";
  ctx.fillRect(size / 2 - 20, doorBottom - 28, 40, 7);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Neutral speckled floor texture, tiled across the whole zone. Deliberately close to
 * mid-grey rather than tinted toward either the tan polished-concrete or grey-carpet
 * look, since Corridor.tsx multiplies this against a per-cell material color — a neutral
 * base keeps that multiply honest for both.
 */
export function makeFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#b3b3ae";
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.4;
  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 40 - 20;
    ctx.fillStyle = v > 0 ? "#bfbfba" : "#a3a39e";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White drop-ceiling tile texture, with faint panel seams. */
export function makeCageTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f2f2ef";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#d7d7d2";
  ctx.lineWidth = 2;
  const step = 32;
  for (let x = 0; x <= size; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 0; y <= size; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A red EXIT placard rendered to a small plane above a doorway. */
export function makeExitSignTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 96;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#d3372c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("EXIT", w / 2, h / 2 + 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A facility placard with an aisle/unit range, e.g. "A-100 – A-148". */
export function makePlacardTexture(label: string): THREE.CanvasTexture {
  const w = 256;
  const h = 96;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#173d99";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#f2f2ef";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = "#f2f2ef";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
