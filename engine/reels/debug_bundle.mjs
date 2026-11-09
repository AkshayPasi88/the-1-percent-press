import { bundle } from "@remotion/bundler";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(root, "public"),
});
console.log("serveUrl:", serveUrl);
console.log("bundle dir listing:", fs.readdirSync(serveUrl).slice(0, 25));
const pub = path.join(serveUrl, "public");
console.log("public exists:", fs.existsSync(pub));
if (fs.existsSync(pub)) {
  console.log("public listing:", fs.readdirSync(pub));
  const fonts = path.join(pub, "fonts");
  if (fs.existsSync(fonts)) console.log("fonts:", fs.readdirSync(fonts));
}
