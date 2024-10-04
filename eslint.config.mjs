import eslint from "@eslint/js";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
    eslint.configs.recommended,
    ...typescriptEslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        rules: {
            curly: "warn",
            eqeqeq: "warn",
            "no-throw-literal": "warn",
            semi: "off",
        },
    }
);
