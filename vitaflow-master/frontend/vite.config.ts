import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import path from "node:path"
import legacy from "@vitejs/plugin-legacy"
import { browserslistToTargets } from "lightningcss"
import browserslist from "browserslist"

const browsers = "chrome >= 60, safari >= 11, edge >= 16"

export default defineConfig({
  plugins: [
    vue(),
    legacy({
      targets: [browsers],
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"]
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  css: {
    lightningcss: {
      targets: browserslistToTargets(browserslist(browsers)),
    },
  },
  build: {
    cssMinify: "lightningcss",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
})
