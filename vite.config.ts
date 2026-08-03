import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions:{
      output:{
        manualChunks(id){
          const normalized=id.replaceAll("\\","/");
          if(/\/src\/(?:i18n|[^/]+-i18n|map-labels)\.ts$/.test(normalized))return "localization";
        }
      }
    }
  },
  server: { host: "127.0.0.1" }
});
