import esbuild from "esbuild";
import fs from "fs-extra";
import path from "path";

let watch = process.argv.includes("-w");

/*
Here's the complicated situation:

1. Monaco has its own web worker for doing editor computations (?), at
   editor.worker.js. The URL for this file must match MonacoEnvironment.getWorkerUrl.

2. Rust Analyzer has a top-level worker ra-worker.js that:
   * calls into the wasm-pack-generated wasm_demo.js, 
   * which has a URL referencing the WASM file wasm_demo_bg.wasm,
   * which uses wasm_bindgen_rayon, which has a file workerHelpers.js that recursively 
     imports wasm_demo.js, and has a self-referential URL to itself (workerHelpers.js).  

We eagerly bundle all their dependencies so each file has no imports. All that leaves
is for downstream bundlers (e.g. Vite) to find the `new URL` calls and copy in the 
relevant assets.
*/

async function main() {
  fs.mkdirSync("dist", {recursive: true});

  let c0 = await esbuild.context({
    entryPoints: ["src/lib.tsx"],
    format: "esm",
    outdir: "dist",
    external: [
      "react",
      "./fake_alloc.rs?raw",
      "./fake_core.rs?raw",
      "./fake_std.rs?raw",
    ],
    loader: {
      ".ttf": "file",
    },
    bundle: true,
  });

  let c1 = await esbuild.context({
    entryPoints: ["node_modules/monaco-editor/esm/vs/editor/editor.worker.js"],
    format: "iife",
    outdir: "dist",
    bundle: true,
  });

  let c2 = await esbuild.context({
    entryPoints: ["src/ra-worker.js"],
    format: "esm",
    outdir: "dist",
    bundle: true,
  });

  // wasm-bindgen-rayon has some random hash appended to it, so we have to search
  const SNIPPETS_DIR = "src/ra-wasm/snippets";
  let base = fs
    .readdirSync(SNIPPETS_DIR)
    .find(p => p.startsWith("wasm-bindgen-rayon"));
  let c3 = await esbuild.context({
    entryPoints: [path.join(SNIPPETS_DIR, base, "src/workerHelpers.js")],
    format: "esm",
    outdir: "dist",
    bundle: true,
  });

  let c4 = await esbuild.context({
    entryPoints: ["src/build-utils.ts"],
    format: "cjs",
    outdir: "dist",    
    platform: "node",
    outExtension: { ".js": ".cjs" },
  });

  let files = ["fake_alloc.rs", "fake_core.rs", "fake_std.rs", "ra-wasm/wasm_demo_bg.wasm"];
  files.forEach(file => fs.copyFileSync(`./src/${file}`, `dist/${path.basename(file)}`));

  let ctxts = [c0, c1, c2, c3, c4];

  await Promise.all(
    ctxts.map(async c => {
      if (watch) await c.watch();
      else {
        await c.rebuild();
        await c.dispose();
      }
    })
  );
}

main();
