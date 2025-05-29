import { defineConfig, UserConfig, ConfigEnv } from 'vite';
import path from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl'
import vue from '@vitejs/plugin-vue'

declare const __dirname: string;

export default defineConfig((env: ConfigEnv): UserConfig => {
  let common: UserConfig = {
    plugins: [
      basicSsl(),
      vue()
    ],
    server: {
      port: 5000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    root: './',
    base: '/',
    publicDir: './public',
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@framework': path.resolve(__dirname, 'src/FrameworkSrc'),
        '@motionsyncframework': path.resolve(__dirname, 'src/MotionSyncFrameworkSrc'),
      }
    },
    esbuild: {
      include: [
        './src/**/*.ts',
      ],
    },
    build: {
      target: 'modules',
      assetsDir: 'assets',
      outDir: './dist',
      sourcemap: env.mode == 'development' ? true : false,
    },
  };
  return common;
});
