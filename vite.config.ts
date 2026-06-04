import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Workspace packages can drag in their own copy of react/react-dom; force
  // a single resolution so hooks dispatch through one React instance.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
