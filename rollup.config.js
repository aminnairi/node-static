import {resolve} from "path";
import {terser} from "rollup-plugin-terser";
import json from "@rollup/plugin-json";
import {external} from "@aminnairi/rollup-plugin-external";
import babel from "@rollup/plugin-babel";
import remove from "rollup-plugin-delete";

export default {
  input: resolve("sources", "static.mjs"),
  plugins: [
    remove({
      targets: [
        resolve("release", "**", "*")
      ]
    }),
    external(),
    json(),
    babel({
      babelrc: false,
      babelHelpers: "bundled",
      presets: [
        "@babel/preset-env"
      ]
    }),
    terser()
  ],
  output: {
    file: resolve("release", "static.js"),
    banner: "#!/usr/bin/env node",
    format: "cjs"
  }
}
