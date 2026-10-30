// Copies onnxruntime-web's WebAssembly build into public/ort/ (git-ignored), for the "Hey Vita" wake word. It is loaded from
// there at runtime, only when a patient turns the wake word on, and never bundled into the site's JavaScript.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");
mkdirSync(to, { recursive: true });
for (const f of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) copyFileSync(join(from, f), join(to, f));
console.log("onnxruntime-web copied to public/ort");
