import typescriptEslint from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"

export default [
    {
        ignores: ["main.js", "dist/**", "node_modules/**", "*.d.ts", "tmp/**", "plugin/**"],
    },
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: typescriptParser,
            ecmaVersion: 2021,
            sourceType: "script",
            parserOptions: {
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptEslint,
        },
        rules: {
            semi: "off",
            "@typescript-eslint/member-delimiter-style": "off",
            "@typescript-eslint/quotes": "off",
            "@typescript-eslint/indent": "off",
            "@typescript-eslint/comma-dangle": "off",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "warn",
        },
    },
    {
        files: ["**/*.js", "**/*.jsx"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
        },
        rules: {
            semi: "off",
        },
    },
]
