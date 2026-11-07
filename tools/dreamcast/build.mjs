#!/usr/bin/env node
// Builds dreamcast.html - a single, self-contained Dreamcast player.
//
//   node tools/dreamcast/build.mjs
//
// 1. Fetches the pinned Flycast WebAssembly core from npm (romdev-core-flycast) into
//    .cache/ and verifies its SHA-256.
// 2. Patches the Emscripten glue so it runs in a browser (the upstream build is
//    Node-only: it forces NODERAWFS and calls require("path") unconditionally).
// 3. Gzips the glue + wasm and inlines them, with src/app.js and src/shell.html, into
//    one HTML file that works straight from file:// - no server, no install.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, ".cache");
const CORE_PKG = "romdev-core-flycast";
const CORE_VERSION = "0.4.2";
const PINNED = {
  "flycast_libretro.wasm": "72f7f6e3052b7bac923d4fdfed2507530ab9a66aafc90479b99029ea67fab0c8",
  "flycast_libretro.js": "b1a0338881b7ba18b403010cd239a59855512aacec8a6bcc81230d5967ba5d04",
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function fetchCore() {
  const dir = path.join(CACHE, "core");
  const wasm = path.join(dir, "package", "wasm");
  if (Object.keys(PINNED).every((f) => existsSync(path.join(wasm, f)))) return wasm;
  mkdirSync(dir, { recursive: true });
  console.log(`fetching ${CORE_PKG}@${CORE_VERSION} from npm...`);
  execFileSync("npm", ["pack", `${CORE_PKG}@${CORE_VERSION}`, "--pack-destination", dir, "--silent"], {
    cwd: dir,
    stdio: ["ignore", "inherit", "inherit"],
  });
  const tgz = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  if (!tgz) throw new Error("npm pack produced no tarball");
  execFileSync("tar", ["xzf", tgz], { cwd: dir });
  return wasm;
}

function patchGlue(src) {
  let out = src;
  const once = (from, to, label) => {
    const n = out.split(from).length - 1;
    if (n !== 1) throw new Error(`glue patch "${label}" matched ${n} times (expected 1) - core version changed?`);
    out = out.replace(from, () => to);
  };
  // Upstream hard-fails outside Node because it swaps the whole FS for NODERAWFS.
  // In the browser we keep Emscripten's normal in-memory FS (MEMFS) instead.
  once(
    'if(!ENVIRONMENT_IS_NODE){throw new Error("NODERAWFS is currently only supported on Node.js environment.")}',
    "",
    "drop NODERAWFS guard",
  );
  once("for(var _key in NODERAWFS){", "if(ENVIRONMENT_IS_NODE)for(var _key in NODERAWFS){", "gate NODERAWFS override");
  return out;
}

const wasmDir = fetchCore();
const wasm = readFileSync(path.join(wasmDir, "flycast_libretro.wasm"));
const glue = readFileSync(path.join(wasmDir, "flycast_libretro.js"), "utf8");
for (const [name, buf] of [["flycast_libretro.wasm", wasm], ["flycast_libretro.js", Buffer.from(glue)]]) {
  const got = sha256(buf);
  if (got !== PINNED[name]) throw new Error(`${name} checksum mismatch\n  expected ${PINNED[name]}\n  got      ${got}`);
}

const b64 = (buf) => gzipSync(buf, { level: 9 }).toString("base64");
const glueB64 = b64(Buffer.from(patchGlue(glue)));
const wasmB64 = b64(wasm);

const shell = readFileSync(path.join(HERE, "src", "shell.html"), "utf8");
const app = readFileSync(path.join(HERE, "src", "app.js"), "utf8");
if (/<\/script/i.test(app)) throw new Error("app.js must not contain a literal </script");

const html = shell
  .replace("/*__APP__*/", () => app)
  .replace("__CORE_GLUE__", () => glueB64)
  .replace("__CORE_WASM__", () => wasmB64)
  .replaceAll("__CORE_VERSION__", `${CORE_PKG} ${CORE_VERSION}`);

const outFile = path.join(HERE, "dreamcast.html");
writeFileSync(outFile, html);
console.log(`wrote ${path.relative(process.cwd(), outFile)} (${(html.length / 1048576).toFixed(2)} MB)`);
