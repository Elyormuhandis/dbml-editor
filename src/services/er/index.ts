import Database from '@dbml/core/types/model_structure/database';
import Field from '@dbml/core/types/model_structure/field';
import Ref from '@dbml/core/types/model_structure/ref';
import Table from '@dbml/core/types/model_structure/table';

// Helper function to extract color from table note
// Note format: "group: Keycloak, color: #6724BB" or just "color: #FF6B6B"
function extractColorFromNote(note: string | null): string | null {
  if (!note) return null;

  // Match "color: #RRGGBB" or "color:#RRGGBB"
  const colorMatch = note.match(/color:\s*(#[0-9A-Fa-f]{6})/);
  if (colorMatch && colorMatch[1]) {
    return colorMatch[1];
  }

  return null;
}

function parseFieldToPort(
  field: Field,
  schemaName: string,
  tableName: string,
): any {
  let label = field.name;
  if (field.pk) {
    label += ' 🔑';
  }
  if (field.not_null) {
    label += ' 🚫';
  }
  return {
    id: `${schemaName}-${tableName}-${field.name}`,
    group: 'list',
    attrs: {
      portNameLabel: {
        text: label,
      },
      portTypeLabel: {
        text: field.type.type_name || 'unknown',
      },
    },
  };
}

function parseNoteToPort(
  note: string,
  schemaName: string,
  tableName: string,
): any {
  return {
    id: `${schemaName}-${tableName}-note`,
    group: 'note',
    attrs: {
      note: {
        text: note,
      },
    },
  };
}

function parseTableToNode(table: Table, schemaName: string): any {
  let fields: any[] = [];
  for (let k = 0; k < table.fields.length; k++) {
    const f = table.fields[k];
    const field = parseFieldToPort(f, schemaName, table.name);
    fields.push(field);
  }
  if (table.note) {
    const note = parseNoteToPort(table.note, schemaName, table.name);
    fields.push(note);
  }

  // Extract color from table note
  const color = extractColorFromNote(table.note);

  const node: any = {
    id: `${schemaName}-${table.name}`,
    shape: 'er-rect',
    label: table.name,
    width: 150,
    height: 24,
    zIndex: 10, // Above containers for clickability
    ports: fields,
  };

  // Add color to node data if present
  if (color) {
    node.data = { color };
  }

  return node;
}

// Map DBML relation to crow's foot marker
function getMarkerForRelation(relation: string): string {
  // DBML relations: '1' (one), '*' (many), '1..1', '0..1', '0..*', etc.
  if (relation === '*' || relation === '0..*') {
    return 'crowfoot'; // Many (crow's foot)
  } else if (relation === '1' || relation === '1..1') {
    return 'one'; // One (perpendicular line)
  } else if (relation === '0..1') {
    return 'zeroOrOne'; // Zero or one (circle + line)
  } else {
    return 'one'; // Default to one
  }
}

function parseRef(ref: Ref): any {
  if (ref.endpoints.length !== 2) {
    console.warn('ref.endpoints.length !== 2');
    return null;
  }
  const source = ref.endpoints[0];
  const target = ref.endpoints[1];

  const sourceFieldName = source.fieldNames[0];
  const targetFieldName = target.fieldNames[0];
  const sSchemaName = source.schemaName || 'public';
  const tSchemaName = target.schemaName || 'public';

  // Get crow's foot markers for source and target
  const sourceMarker = getMarkerForRelation(source.relation);
  const targetMarker = getMarkerForRelation(target.relation);

  return {
    id: ``,
    shape: 'edge',
    router: {
      name: 'er',
      args: {
        offset: 16,
        min: 4,
        direction: 'H',
      },
    },
    source: {
      cell: `${sSchemaName}-${source.tableName}`,
      port: `${sSchemaName}-${source.tableName}-${sourceFieldName}`,
    },
    target: {
      cell: `${tSchemaName}-${target.tableName}`,
      port: `${tSchemaName}-${target.tableName}-${targetFieldName}`,
    },
    attrs: {
      line: {
        stroke: '#5F95FF',
        strokeWidth: 2,
        sourceMarker: {
          name: sourceMarker,
          size: 8,
        },
        targetMarker: {
          name: targetMarker,
          size: 8,
        },
      },
    },
    labels: [
      {
        attrs: {
          label: {
            text: source.relation,
            fontFamily: 'monospace',
            fontSize: 10,
          },
        },
        position: 0.2,
      },
      {
        attrs: {
          label: {
            text: target.relation,
            fontFamily: 'monospace',
            fontSize: 10,
          },
        },
        position: 0.8,
      },
    ],
  };
}

function parseDatabaseToER(
  database: Database,
  tableGroupColors?: Record<string, string>,
): any {
  // parse nodes
  let nodes: any[] = [];
  let groupContainers: any[] = [];

  for (let i = 0; i < database.schemas.length; i++) {
    const schema = database.schemas[i];

    // Create TableGroup containers
    if (schema.tableGroups && schema.tableGroups.length > 0) {
      for (let g = 0; g < schema.tableGroups.length; g++) {
        const group = schema.tableGroups[g];
        const tableNames = group.tables.map((t: any) => t.name);

        // Extract color: first check tableGroupColors, then first table's note
        let groupColor = '#8B8B8B'; // default gray

        // Priority 1: TableGroup [color: ...] syntax (preprocessed)
        if (tableGroupColors && tableGroupColors[group.name]) {
          groupColor = tableGroupColors[group.name];
        }
        // Priority 2: First table's note color
        else if (group.tables.length > 0) {
          const firstTable = group.tables[0];
          const extractedColor = extractColorFromNote(firstTable.note);
          if (extractedColor) {
            groupColor = extractedColor;
          }
        }

        groupContainers.push({
          id: `${schema.name}-group-${group.name}`,
          shape: 'table-group',
          label: group.name,
          width: 400,
          height: 300,
          zIndex: 0, // Above background, below tables
          movable: true, // Explicitly enable dragging
          attrs: {
            body: {
              pointerEvents: 'none', // Let clicks pass through to header
            },
          },
          data: {
            tableNames,
            color: groupColor,
          },
        });
      }
    }

    // Create table nodes
    for (let j = 0; j < database.schemas[i].tables.length; j++) {
      const table = database.schemas[i].tables[j];
      const node = parseTableToNode(table, schema.name);
      nodes.push(node);
    }
  }

  // parse edges
  let edges: any[] = [];
  for (let i = 0; i < database.schemas.length; i++) {
    const schema = database.schemas[i];
    for (let j = 0; j < schema.refs.length; j++) {
      const ref = database.schemas[i].refs[j];
      const edge = parseRef(ref);
      if (edge === null) {
        continue;
      }
      console.log(edge);
      edges.push(edge);
    }
  }

  // Add group containers to nodes (at the beginning so they render first)
  return { nodes: [...groupContainers, ...nodes], edges: edges };
}

export default parseDatabaseToER;
