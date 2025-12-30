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

// Expand 3-digit hex color to 6-digit
// e.g., #F00 -> #FF0000, #ABC -> #AABBCC
export function expandHexColor(color: string): string {
  if (color.length === 4) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return color.toUpperCase();
}

// Preprocess DBML to extract TableGroup colors and notes
// TableGroup Foo [color: #FF6B6B, note: 'description'] { ... } is not supported by @dbml/core
// We extract the attributes and make them available for rendering
export function preprocessTableGroupColors(dbml: string): {
  processed: string;
  groupColors: Record<string, string>;
  groupNotes: Record<string, string>;
} {
  const groupColors: Record<string, string> = {};
  const groupNotes: Record<string, string> = {};

  // Match: TableGroup Name [...attributes...] {
  const tableGroupRegex = /TableGroup\s+(\w+)\s*\[([^\]]*)\]\s*\{/gi;

  let match;
  while ((match = tableGroupRegex.exec(dbml)) !== null) {
    const groupName = match[1];
    const attributes = match[2];

    // Extract color (supports both #RGB and #RRGGBB)
    const colorMatch = attributes.match(
      /color\s*:\s*(#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?)/i,
    );
    if (colorMatch) {
      groupColors[groupName] = expandHexColor(colorMatch[1]);
    }

    // Extract note (supports single and double quotes)
    const noteMatch = attributes.match(/note\s*:\s*['"]([^'"]*)['"]/i);
    if (noteMatch) {
      groupNotes[groupName] = noteMatch[1];
    }
  }

  // Remove [...] from TableGroup declarations to make valid DBML
  const processed = dbml.replace(
    /TableGroup\s+(\w+)\s*\[[^\]]*\]\s*\{/gi,
    'TableGroup $1 {',
  );

  return { processed, groupColors, groupNotes };
}

export type { ExportFormat, ImportFormat };
