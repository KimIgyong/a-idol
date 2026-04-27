/**
 * Lightweight jest setup for hook-level unit tests. We deliberately do NOT
 * use `jest-expo` / react-native preset — those load the full Metro/Native
 * runtime and we only need to exercise pure JS hooks with `fetch` mocked.
 *
 * The expo-constants + @a-idol/shared paths are redirected via moduleNameMapper.
 */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.spec.tsx'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          target: 'es2020',
          module: 'commonjs',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          moduleResolution: 'node',
          isolatedModules: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    '^expo-constants$': '<rootDir>/src/__mocks__/expo-constants.ts',
    '^@a-idol/shared$': '<rootDir>/../shared/src/index.ts',
  },
  clearMocks: true,
};
