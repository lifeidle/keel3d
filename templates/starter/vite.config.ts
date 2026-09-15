import { defineConfig } from 'vite';

// base: './' —— 产物用相对路径，丢到任意子目录/静态托管都能跑。
// target: 'esnext' —— 框架是 WebGPU-only，不做降级；rapier 的 wasm 也需要它。
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
  },
});
