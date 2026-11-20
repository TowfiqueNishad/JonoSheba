import ts from 'typescript';
import { defineConfig } from 'vitest/config';

/**
 * Emits TypeScript decorator metadata (design:paramtypes) for NestJS DI
 * inside Vitest without needing esbuild workarounds or pre-building dist/.
 */
function nestjsDecoratorMetadataPlugin() {
  return {
    name: 'nestjs-decorator-metadata',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.includes('node_modules')) return null;
      if (!/@(?:Injectable|Controller|Module|Global)\s*\(/.test(code)) return null;
      const result = ts.transpileModule(code, {
        fileName: id,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          sourceMap: true,
          inlineSources: true,
        },
      });
      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}

export default defineConfig({
  plugins: [nestjsDecoratorMetadataPlugin()],
  test: {
    environment: 'node',
  },
});
