module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  verbose: true,
  testMatch: ["**/*.spec.ts"],
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/jest.env.setup.js"],
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
