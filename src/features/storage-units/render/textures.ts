"use client";

import * as THREE from "three";

/** Corrugated roll-up door texture: vertical ribs, a track frame, and a handle bar. */
export function makeDoorTexture(paintedGrey: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = paintedGrey ? "#8a8f93" : "#c2733a";
  const shade = paintedGrey ? "#71767a" : "#9c5a2b";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const ribWidth = 10;
  for (let x = 0; x < size; x += ribWidth) {
    ctx.fillStyle = (x / ribWidth) % 2 === 0 ? shade : base;
    ctx.fillRect(x, 0, ribWidth / 2, size);
  }

  // Track frame.
  ctx.fillStyle = "#4a4844";
  ctx.fillRect(0, 0, size, 10);
  ctx.fillRect(0, size - 14, size, 14);
  ctx.fillRect(0, 0, 8, size);
  ctx.fillRect(size - 8, 0, 8, size);

  // Handle.
  ctx.fillStyle = "#2c2b28";
  ctx.fillRect(size / 2 - 24, size - 40, 48, 8);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Concrete-with-taped-lines floor texture, tiled across the whole zone. */
export function makeFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6f6f6a";
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 40 - 20;
    ctx.fillStyle = v > 0 ? "#7c7c76" : "#63635e";
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#c9a53a";
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Wire-mesh security cage texture for the open-plenum ceiling. */
export function makeCageTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#2a2a28";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "#57564f";
  ctx.lineWidth = 2;
  const step = 16;
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
  ctx.fillStyle = "#14304f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#e8ead9";
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = "#e8ead9";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
