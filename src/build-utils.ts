import fs from "fs";
import path from "path";

export interface GenerateAssetsOptions {
  outDir: string;
  serverUrl: string;
}

export let generateAssets = ({ outDir, serverUrl }: GenerateAssetsOptions) => {
  let files = ["editor.worker.js", "ra-worker.js", "wasm_demo_bg.wasm"];
  files.forEach(f =>
    fs.copyFileSync(
      path.join("node_modules/@wcrichto/rust-editor/dist", f),
      path.join(outDir, f)
    )
  );

  ["ra-worker"].forEach(name => {
    let assetPath = path.join(outDir, `${name}.js`);
    let contents = fs.readFileSync(assetPath, "utf-8");
    contents = contents.replace(
      /import\.meta\.url/g,
      JSON.stringify(serverUrl + "/")
    );
    fs.writeFileSync(assetPath, contents);
  });
};
