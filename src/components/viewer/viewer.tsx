import parseDatabaseToER from '@/services/er';
import {
  loadCollapsedGroups,
  loadDiagramState,
  loadGroupSizes,
  loadZoom,
  saveCollapsedGroups,
  saveGroupSizes,
  saveNodePositions,
  saveZoom,
  type GroupSize,
} from '@/services/storage';
import { DagreLayout } from '@antv/layout';
import { Graph, Model } from '@antv/x6';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import { debounce } from 'lodash-es';
import React, { useEffect, useRef, useState } from 'react';
import ZoomControls from './ZoomControls';

interface Props {
  database: any;
  tableGroupColors?: Record<string, string>;
  tableGroupNotes?: Record<string, string>;
}

interface NodePosition {
  x: number;
  y: number;
}

// Helper: Apply colors to table nodes
const applyTableColors = (tables: any[]) => {
  tables.forEach((node) => {
    const color = node.getData()?.color;
    if (color) {
      node.setAttrs({
        rect: {
          stroke: color,
          fill: color,
        },
      });
      node.getPorts().forEach((port: any) => {
        if (port.group === 'list') {
          node.portProp(port.id!, 'attrs/portBody/stroke', color);
        }
      });
    }
  });
};

// Helper: Style a single TableGroup container
const styleTableGroup = (
  groupNode: any,
  tables: any[],
  options: {
    silent?: boolean;
    isCollapsed?: boolean;
    manualSize?: GroupSize;
  } = {},
) => {
  const groupData = groupNode.getData();
  const tableNames = groupData?.tableNames || [];
  const color = groupData?.color || '#8B8B8B';
  const note = groupData?.note || '';
  const groupName =
    groupData?.name || groupNode.getAttrByPath('label/text') || 'Group';
  const isCollapsed = options.isCollapsed || false;
  const manualSize = options.manualSize;

  // Find all tables in this group
  const groupTables = tables.filter((table) => {
    const tableName = table.id.split('-').pop();
    return tableNames.includes(tableName);
  });

  // Extract RGB from hex color
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const bgColor = `rgba(${r}, ${g}, ${b}, 0.15)`;

  if (isCollapsed) {
    // Hide all child tables
    groupTables.forEach((table) => {
      table.setVisible(false);
    });

    // Show compact collapsed view
    const collapsedWidth = 200;
    const collapsedHeight = 40;

    // Resize to compact (position is preserved automatically)
    groupNode.resize(collapsedWidth, collapsedHeight);

    groupNode.setAttrs({
      body: {
        stroke: color,
        fill: bgColor,
      },
      header: {
        fill: `rgba(${r}, ${g}, ${b}, 0.3)`,
      },
      collapseBtn: {
        text: '+', // Plus sign for collapsed state
      },
      label: {
        text: `${groupName} (${groupTables.length})`,
        fill: color,
      },
      noteIcon: {
        text: note ? 'i' : '',
      },
      noteTooltip: {
        text: note,
      },
    });
    return;
  }

  // Show all child tables
  groupTables.forEach((table) => {
    table.setVisible(true);
  });

  if (groupTables.length === 0) return;

  // Calculate bounding box for all tables in group
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  groupTables.forEach((table) => {
    const bbox = table.getBBox();
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.width);
    maxY = Math.max(maxY, bbox.y + bbox.height);
  });

  // Add padding
  const padding = 40;
  const labelHeight = 30;

  // Position and size the group container
  const containerX = minX - padding;
  const containerY = minY - padding - labelHeight;

  groupNode.position(containerX, containerY, { silent: options.silent });

  // Use manual size if set, otherwise calculate from tables
  if (manualSize?.isManual) {
    groupNode.resize(manualSize.width, manualSize.height);
  } else {
    groupNode.resize(
      maxX - minX + padding * 2,
      maxY - minY + padding * 2 + labelHeight,
    );
  }

  // Apply color and styling
  groupNode.setAttrs({
    body: {
      stroke: color,
      fill: bgColor,
    },
    header: {
      fill: `rgba(${r}, ${g}, ${b}, 0.3)`,
    },
    collapseBtn: {
      text: '−', // Minus sign for expanded state
    },
    label: {
      text: groupName,
      fill: color,
    },
    noteIcon: {
      text: note ? 'i' : '',
    },
    noteTooltip: {
      text: note,
    },
  });
};

// Viewer is a component that renders the ER diagram
const Viewer: React.FC<Props> = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [zoom, setZoom] = useState(1);
  const [savedPositions, setSavedPositions] = useState<Record<
    string,
    NodePosition
  > | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(loadCollapsedGroups());
  });
  const [groupManualSizes, setGroupManualSizes] = useState<
    Record<string, GroupSize>
  >(() => {
    return loadGroupSizes();
  });

  // Create dagreLayout once using useRef to avoid recreating on every render
  const dagreLayoutRef = useRef(
    new DagreLayout({
      type: 'dagre',
      rankdir: 'LR',
      align: 'UL',
      ranksep: 80,
      nodesep: 60,
      controlPoints: true,
    }),
  );

  const updateTableGroupPositionsRef = useRef<(() => void) | null>(null);

  // Group dragging state refs
  const isGroupDraggingRef = useRef<boolean>(false);
  const groupDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const childTableStartPositionsRef = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  const currentDragGroupRef = useRef<string | null>(null);

  // Collapsed groups ref for access in event handlers
  const collapsedGroupsRef = useRef<Set<string>>(collapsedGroups);
  collapsedGroupsRef.current = collapsedGroups;

  // Manual sizes ref for access in event handlers
  const groupManualSizesRef =
    useRef<Record<string, GroupSize>>(groupManualSizes);
  groupManualSizesRef.current = groupManualSizes;

  // Toggle collapse handler
  const handleCollapseToggle = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      saveCollapsedGroups(Array.from(next));
      return next;
    });
  };

  // Create debounced functions once using useRef
  const debouncedSaveZoomRef = useRef(
    debounce((zoom: number) => {
      saveZoom(zoom);
    }, 500),
  );

  const debouncedSavePositionsRef = useRef(
    debounce((graph: Graph) => {
      saveNodePositions(graph);
    }, 1000),
  );

  // Merge saved positions with Dagre layout
  const mergePositions = (
    layoutModel: Model.FromJSONData,
    saved: Record<string, NodePosition>,
  ): Model.FromJSONData => {
    const nodes = (layoutModel.nodes || []).map((node) => {
      const savedPos = saved[node.id];
      if (savedPos) {
        // Use saved position
        return { ...node, x: savedPos.x, y: savedPos.y };
      }
      // New node - use Dagre position
      return node;
    });

    return { ...layoutModel, nodes, edges: layoutModel.edges };
  };

  // Initialize graph once when component mounts
  useEffect(() => {
    if (containerRef.current && !graphRef.current) {
      const graph = new Graph({
        container: containerRef.current,
        connecting: {
          anchor: {
            name: 'midSide',
            args: {
              direction: 'H',
            },
          },
          allowBlank: false,
          allowEdge: false,
          allowNode: false,
        },
        background: {
          color: '#F2F7FA',
        },
        interacting: {
          nodeMovable: true,
          edgeMovable: false,
          edgeLabelMovable: false,
          arrowheadMovable: false,
          vertexMovable: false,
          vertexAddable: false,
          vertexDeletable: false,
        },
        embedding: {
          enabled: true, // Enable parent-child embedding features
          findParent: 'bbox', // Find parent by bounding box
          frontOnly: false, // Allow clicking through to parent even if children on top
        },
        panning: true,
        mousewheel: {
          enabled: true,
          modifiers: ['ctrl', 'meta'],
          factor: 1.1,
        },
      });

      graph.use(
        new Snapline({
          enabled: true,
        }),
      );

      // Enable resizing for table-group nodes only
      graph.use(
        new Transform({
          resizing: {
            enabled: (node) => node.shape === 'table-group',
            minWidth: 150,
            minHeight: 50,
            preserveAspectRatio: false,
          },
          rotating: false,
        }),
      );

      // Listen to zoom changes
      graph.on('scale', ({ sx }) => {
        setZoom(sx);
        // Save zoom to localStorage (debounced)
        debouncedSaveZoomRef.current(sx);
      });

      // Track node position before drag starts
      graph.on('node:mousedown', ({ node }) => {
        // Detect if clicking on table-group (for group dragging)
        if (node.shape === 'table-group') {
          const pos = node.position();
          isGroupDraggingRef.current = true;
          groupDragStartRef.current = { x: pos.x, y: pos.y };
          currentDragGroupRef.current = node.id;

          // Store starting positions of all child tables
          const groupData = node.getData();
          const tableNames = groupData?.tableNames || [];
          const tables = graph.getNodes().filter((n) => n.shape === 'er-rect');

          childTableStartPositionsRef.current.clear();
          tables.forEach((table) => {
            const tableName = table.id.split('-').pop();
            if (tableNames.includes(tableName)) {
              const tablePos = table.position();
              childTableStartPositionsRef.current.set(table.id, {
                x: tablePos.x,
                y: tablePos.y,
              });
            }
          });
        }
      });

      // Handle group dragging - move all child tables together
      graph.on('node:moving', ({ node }) => {
        if (node.shape === 'table-group' && isGroupDraggingRef.current) {
          const groupStart = groupDragStartRef.current;
          if (!groupStart) return;

          const currentPos = node.position();
          const dx = currentPos.x - groupStart.x;
          const dy = currentPos.y - groupStart.y;

          // Move all child tables by the same delta
          childTableStartPositionsRef.current.forEach((startPos, tableId) => {
            const table = graph.getCellById(tableId);
            if (table) {
              table.position(startPos.x + dx, startPos.y + dy, {
                silent: true,
              });
            }
          });
        }
      });

      // Listen to position changes during drag for real-time updates
      graph.on('node:change:position', ({ node }) => {
        // Skip container update if we're dragging the group itself
        if (isGroupDraggingRef.current) return;

        if (node.shape === 'er-rect') {
          // Real-time container update when table is being dragged
          if (updateTableGroupPositionsRef.current) {
            updateTableGroupPositionsRef.current();
          }
        }
      });

      // Reset group dragging state on mouse up
      graph.on('node:mouseup', () => {
        if (isGroupDraggingRef.current) {
          isGroupDraggingRef.current = false;
          groupDragStartRef.current = null;
          currentDragGroupRef.current = null;
          childTableStartPositionsRef.current.clear();
        }
      });

      // Handle collapse button click
      graph.on('node:click', ({ node, e }) => {
        if (node.shape === 'table-group') {
          // Check if click is on collapse button (left side of header, first 25px)
          const localX = e.offsetX;
          if (localX < 25) {
            handleCollapseToggle(node.id);
          }
        }
      });

      // Handle manual resize of table-group
      graph.on('node:resized', ({ node }) => {
        if (node.shape === 'table-group') {
          const size = node.getSize();
          setGroupManualSizes((prev) => {
            const next = {
              ...prev,
              [node.id]: {
                width: size.width,
                height: size.height,
                isManual: true,
              },
            };
            saveGroupSizes(next);
            return next;
          });
        }
      });

      // Double-click to reset manual size
      graph.on('node:dblclick', ({ node }) => {
        if (node.shape === 'table-group') {
          // Reset to auto-size
          setGroupManualSizes((prev) => {
            const next = { ...prev };
            delete next[node.id];
            saveGroupSizes(next);
            return next;
          });
        }
      });

      // Listen to node drag completion (for saving positions only)
      graph.on('node:moved', () => {
        // Save all node positions after drag completes
        debouncedSavePositionsRef.current(graph);
      });

      // Load saved zoom
      const savedZoom = loadZoom();
      if (savedZoom) {
        graph.zoomTo(savedZoom);
        setZoom(savedZoom);
      }

      graphRef.current = graph;
    }

    // Cleanup on unmount
    return () => {
      if (graphRef.current) {
        graphRef.current.dispose();
        graphRef.current = null;
      }
    };
  }, []);

  // Load saved positions on mount
  useEffect(() => {
    const state = loadDiagramState();
    if (state) {
      setSavedPositions(state.positions);
    }
  }, []);

  // Update graph data when database changes
  useEffect(() => {
    if (graphRef.current && props.database) {
      const erModel = parseDatabaseToER(
        props.database,
        props.tableGroupColors,
        props.tableGroupNotes,
      );
      let layoutedModel = dagreLayoutRef.current.layout(erModel);

      // Merge with saved positions if available
      if (savedPositions) {
        layoutedModel = mergePositions(layoutedModel, savedPositions);
      }

      // Clear existing data
      graphRef.current.clearCells();

      // Load new data
      graphRef.current.fromJSON(layoutedModel);

      // Apply custom colors and position TableGroups
      const tableGroups = graphRef.current
        .getNodes()
        .filter((n) => n.shape === 'table-group');
      const tables = graphRef.current
        .getNodes()
        .filter((n) => n.shape === 'er-rect');

      // Apply colors to table nodes
      applyTableColors(tables);

      // Position and style TableGroup containers
      const updateTableGroupPositions = () => {
        tableGroups.forEach((groupNode) => {
          const isCollapsed = collapsedGroupsRef.current.has(groupNode.id);
          const manualSize = groupManualSizesRef.current[groupNode.id];
          styleTableGroup(groupNode, tables, {
            silent: true,
            isCollapsed,
            manualSize,
          });
        });
      };

      // Store function in ref so it can be accessed from event handlers
      updateTableGroupPositionsRef.current = updateTableGroupPositions;

      // Initial positioning
      updateTableGroupPositions();

      // Center content only if no saved positions
      if (!savedPositions) {
        graphRef.current.centerContent();
      }
    }
  }, [props.database, savedPositions, collapsedGroups, groupManualSizes]);

  const handleClearPositions = () => {
    // Clear saved positions and manual sizes, trigger re-layout
    setSavedPositions(null);
    setGroupManualSizes({});
    saveGroupSizes({});

    // Re-render with fresh Dagre layout
    if (graphRef.current && props.database) {
      const erModel = parseDatabaseToER(
        props.database,
        props.tableGroupColors,
        props.tableGroupNotes,
      );
      const layoutedModel = dagreLayoutRef.current.layout(erModel);

      graphRef.current.clearCells();
      graphRef.current.fromJSON(layoutedModel);

      // Apply custom colors and position TableGroups
      const tableGroups = graphRef.current
        .getNodes()
        .filter((n) => n.shape === 'table-group');
      const tables = graphRef.current
        .getNodes()
        .filter((n) => n.shape === 'er-rect');

      applyTableColors(tables);
      tableGroups.forEach((groupNode) => {
        const isCollapsed = collapsedGroupsRef.current.has(groupNode.id);
        styleTableGroup(groupNode, tables, { isCollapsed });
      });

      graphRef.current.centerContent();
    }
  };

  return (
    <div className="react-shape-app">
      <div className="app-content" ref={containerRef} />
      <ZoomControls
        graph={graphRef.current}
        currentZoom={zoom}
        onClearPositions={handleClearPositions}
      />
    </div>
  );
};

export default Viewer;
