import baseConfig from '@jonoshheba/eslint-config';

export default [
  ...baseConfig,
  {
    rules: {
      // NestJS emitDecoratorMetadata requires runtime class value imports for DI tokens
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
