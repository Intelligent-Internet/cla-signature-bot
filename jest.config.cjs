module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { diagnostics: false, useESM: true }]
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/__tests__/mocks/actionsCore.ts',
    '^@actions/github$': '<rootDir>/__tests__/mocks/actionsGithub.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  verbose: true,
  collectCoverage: true,
  coverageReporters: ["json", "lcov", "text", "clover"]
}
