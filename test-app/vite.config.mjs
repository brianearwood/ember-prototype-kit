import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { extensions, classicEmberSupport, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';

const fromNodeModules = (path) =>
  fileURLToPath(new URL(`./node_modules/${path}`, import.meta.url));

export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [
          fromNodeModules('@hashicorp/design-system-tokens/dist/products/css'),
          fromNodeModules('@hashicorp/design-system-components/dist/styles'),
        ],
      },
    },
  },
  plugins: [
    classicEmberSupport(),
    ember(),
    babel({
      babelHelpers: 'runtime',
      extensions,
    }),
  ],
});
