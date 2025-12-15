module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests", "<rootDir>/test"],
  verbose: true,
  testMatch: ["**/*.spec.ts"],
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/jest.env.setup.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)"
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: false, tsconfig: "tsconfig.json" }]
  },
};
