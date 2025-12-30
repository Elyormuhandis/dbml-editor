import { CompilerDiagnostic } from '@dbml/core';
import { CompilerError } from '@dbml/core/types/parse/error';

type ImportFormat =
  | 'dbml'
  | 'mysql'
  | 'postgres'
  | 'json'
  | 'mssql'
  | 'postgresLegacy';
type ExportFormat = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export default function ErrorFmt(e: CompilerError): string {
  const diags = e.diags
    .map((d: CompilerDiagnostic) => {
      return `${d.location.start.line}:${d.location.start.column} ${d.message}`;
    })
    .join('\n');
  return diags;
}

// Preprocess DBML to extract TableGroup colors
// TableGroup Foo [color: #FF6B6B] { ... } is not supported by @dbml/core
// We extract the color and make it available for rendering
export function preprocessTableGroupColors(dbml: string): {
  processed: string;
  groupColors: Record<string, string>;
} {
  const groupColors: Record<string, string> = {};

  // Match: TableGroup Name [color: #RRGGBB] {
  // Note: Allow optional spaces inside brackets
  const tableGroupRegex = /TableGroup\s+(\w+)\s*\[\s*color\s*:\s*(#[0-9A-Fa-f]{6})\s*\]\s*\{/gi;

  let match;
  while ((match = tableGroupRegex.exec(dbml)) !== null) {
    const groupName = match[1];
    const color = match[2];
    groupColors[groupName] = color;
  }

  // Remove [color: ...] from TableGroup declarations to make valid DBML
  const processed = dbml.replace(
    /TableGroup\s+(\w+)\s*\[\s*color\s*:\s*(#[0-9A-Fa-f]{6})\s*\]\s*\{/gi,
    'TableGroup $1 {',
  );

  return { processed, groupColors };
}

export type { ExportFormat, ImportFormat };
