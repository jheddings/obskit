import type { Config } from "jest"

const config: Config = {
    testEnvironment: "node",
    testMatch: ["<rootDir>/tests/**/*.test.ts"],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "ESNext",
                    moduleResolution: "bundler",
                    target: "ES2020",
                    strict: true,
                    jsx: "react-jsx",
                    isolatedModules: true,
                    moduleDetection: "force",
                    skipLibCheck: true,
                    noUncheckedIndexedAccess: true,
                    exactOptionalPropertyTypes: true,
                    // ts-jest 29.x injects moduleResolution=node10 internally
                    // (kulshekhar/ts-jest#4499) — suppress until ts-jest is fixed
                    ignoreDeprecations: "6.0",
                },
            },
        ],
    },
}

export default config
