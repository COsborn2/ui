import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";

const sourceDirectory = fileURLToPath(new URL("../src/", import.meta.url)).replaceAll("\\", "/");

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: "@storybook/react-vite",
  core: { disableTelemetry: true },
  viteFinal(config) {
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [...(config.optimizeDeps?.include ?? []), "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
    };
    const previousOnwarn = config.build?.rollupOptions?.onwarn;
    config.build = {
      ...config.build,
      rollupOptions: {
        ...config.build?.rollupOptions,
        onwarn(warning, defaultHandler) {
          // Storybook's preview runs entirely in the browser. RSC directives
          // remain in the separately built npm package, but do not apply here.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE" && warning.message.includes('"use client"')) return;

          // esbuild omits the directive's source mapping. Only ignore that
          // companion warning for our files that actually start with it.
          if (warning.code === "SOURCEMAP_ERROR" && warning.pos === 0
            && warning.message.endsWith("Error when using sourcemap for reporting an error: Can't resolve original location of error.")
            && warning.id?.startsWith(sourceDirectory)) {
            try {
              if (/^(["'])use client\1;/.test(readFileSync(warning.id, "utf8"))) return;
            } catch {
              // An unreadable source cannot be classified; retain its warning.
            }
          }
          if (previousOnwarn) previousOnwarn(warning, defaultHandler);
          else defaultHandler(warning);
        },
      },
    };
    return config;
  },
};

export default config;
