import vinext from "vinext";
import { defineConfig } from "vite";

// Printora berjalan sebagai server Node dengan basis data MySQL (lihat .env dan lib/mysql.mjs).
// Konfigurasi Cloudflare Workers/D1 sebelumnya telah dilepas.
export default defineConfig({
  plugins: [vinext()],
});
