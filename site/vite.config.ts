import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Chemins relatifs : le site fonctionne sous https://<nom>.github.io/riftbound-tracker/ sans configuration.
  base: './',
  plugins: [vue(), tailwindcss()],
});
