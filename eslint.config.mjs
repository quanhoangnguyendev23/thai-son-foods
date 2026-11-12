import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Thư mục build phụ khi build song song với dev server (NEXT_DIST_DIR=.next-build)
    ".next-build/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    // Bản sao lưu giao diện (không biên dịch, chỉ để khôi phục)
    "_backup/**",
  ]),
  {
    // Cùng phạm vi file với eslint-config-next (nơi khai báo plugin react-hooks); thiếu dòng này thì file .cjs báo
    // "could not find plugin react-hooks" và lint dừng hẳn.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    // File CommonJS (.cjs, vd. plugin PostCSS) bắt buộc dùng require().
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
