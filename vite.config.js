import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base './' gera caminhos relativos, funcionando tanto em domínio próprio
// quanto em GitHub Pages de projeto (https://usuario.github.io/repositorio/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
