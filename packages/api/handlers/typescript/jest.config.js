module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageProvider: "v8",
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.ts?(x)",
    "<rootDir>/@(test|src)/**/*(*.)@(spec|test).ts?(x)",
  ],
  clearMocks: true,
  collectCoverage: true,
  coverageReporters: ["json", "lcov", "clover", "cobertura", "text"],
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: ["/node_modules/", ".integration.test.[jt]sx?"],
  testPathIgnorePatterns: ["/node_modules/", ".integration.test.[jt]sx?"],
  watchPathIgnorePatterns: ["/node_modules/"],
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "test-reports",
      },
    ],
  ],
  transform: {
    "^.+\\.[t]sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.dev.json",
      },
    ],
  },
};
