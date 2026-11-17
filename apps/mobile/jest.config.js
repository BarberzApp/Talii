module.exports = {
  preset: 'react-native',
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  transformIgnorePatterns: [
    // Transform ESM/untranspiled packages (react-native, expo, sentry, navigation, ...).
    // Works for both apps/mobile/node_modules and the hoisted root node_modules.
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native-.*|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|@stripe/.*|sentry-expo|native-base|unimodules|@unimodules/.*|react-native-.*|lucide-react-native|twrnc|@supabase/.*|@barber-app/.*))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: [
    '**/__tests__/**/*.(ts|tsx|js)',
    '**/*.(test|spec).(ts|tsx|js)',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/index.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    // Specific mappings must come before the generic @/* pattern
    '^@/shared/(.*)$': '<rootDir>/app/shared/$1',
    '^@/components/(.*)$': '<rootDir>/app/shared/components/$1',
    '^@/hooks/(.*)$': '<rootDir>/app/shared/hooks/$1',
    '^@/lib/(.*)$': '<rootDir>/app/shared/lib/$1',
    '^@/types/(.*)$': '<rootDir>/app/shared/types/$1',
    '^@/utils/(.*)$': '<rootDir>/app/shared/utils/$1',
    '^@/pages/(.*)$': '<rootDir>/app/pages/$1',
    '^@/navigation/(.*)$': '<rootDir>/app/navigation/$1',
    '^@barber-app/shared$': '<rootDir>/../../packages/shared/src',
  },
  testTimeout: 10000,
  verbose: true,
  maxWorkers: 1,
}