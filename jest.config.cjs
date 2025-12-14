module.exports = {
  testEnvironment: 'jsdom',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!lucide-react)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'lucide-react': '<rootDir>/tests/jest/lucide-react-mock.tsx',
    '^.+\\.(css|less|scss)$': '<rootDir>/tests/jest/style-mock.cjs',
    '^.+\\.(png|jpg|jpeg|svg)$': '<rootDir>/tests/jest/file-mock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  testMatch: ['**/?(*.)+(test).[tj]s?(x)'],
};
