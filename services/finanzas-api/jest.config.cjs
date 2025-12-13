module.exports = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  verbose: true,
  testMatch: ["**/*.spec.ts"],
  clearMocks: true,
  extensionsToTreatAsEsm: [".ts"],
  setupFiles: ["<rootDir>/tests/jest.env.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!(uuid)/)"
  ],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true }]
  },
};
