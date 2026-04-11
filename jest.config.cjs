/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@open-mercato/core/(.*)$': '<rootDir>/../open-mercato/packages/core/src/$1',
    '^@open-mercato/shared/(.*)$': '<rootDir>/../open-mercato/packages/shared/src/$1',
    '^@open-mercato/ui/(.*)$': '<rootDir>/../open-mercato/packages/ui/src/$1',
    '^#generated/(.*)$': '<rootDir>/../open-mercato/packages/core/generated/$1',
    '^@mikro-orm/core$': '<rootDir>/node_modules/@mikro-orm/core',
    '^@mikro-orm/postgresql$': '<rootDir>/node_modules/@mikro-orm/postgresql',
    '^react$': '<rootDir>/node_modules/react',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime',
    '^react-dom$': '<rootDir>/node_modules/react-dom',
    '^zod$': '<rootDir>/node_modules/zod',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
  },
  transformIgnorePatterns: [],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.dom.setup.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  passWithNoTests: true,
}
