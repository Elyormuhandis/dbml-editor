import parseDatabaseToER from '@/services/er';
import {
  loadDiagramState,
  loadZoom,
  saveNodePositions,
  saveZoom,
} from '@/services/storage';
import { DagreLayout } from '@antv/layout';
import { Graph, Model } from '@antv/x6';
import { Snapline } from '@antv/x6-plugin-snapline';
import { debounce } from 'lodash-es';
import React, { useEffect, useRef, useState } from 'react';
import ZoomControls from './ZoomControls';

interface Props {
  database: any;
  tableGroupColors?: Record<string, string>;
}

interface NodePosition {
  x: number;
  y: number;
}

// Viewer is a component that renders the ER diagram
const Viewer: React.FC<Props> = (props: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const [zoom, setZoom] = useState(1);
  const [savedPositions, setSavedPositions] = useState<Record<string, NodePosition> | null>(
    null,
  );

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

      // Listen to zoom changes
      graph.on('scale', ({ sx }) => {
        setZoom(sx);
        // Save zoom to localStorage (debounced)
        debouncedSaveZoomRef.current(sx);
      });

      // Track node position before drag starts
      const dragStartPositions = new Map<string, { x: number; y: number }>();

      graph.on('node:mousedown', ({ node }) => {
        const pos = node.position();
        dragStartPositions.set(node.id, { x: pos.x, y: pos.y });
      });

      // Listen to position changes during drag for real-time updates
      graph.on('node:change:position', ({ node }) => {
        if (node.shape === 'er-rect') {
          // Real-time container update when table is being dragged
          if (updateTableGroupPositionsRef.current) {
            updateTableGroupPositionsRef.current();
          }
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
      const erModel = parseDatabaseToER(props.database, props.tableGroupColors);
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
      const tableGroups = graphRef.current.getNodes().filter((n) => n.shape === 'table-group');
      const tables = graphRef.current.getNodes().filter((n) => n.shape === 'er-rect');

      // First, apply colors to table nodes
      tables.forEach((node) => {
        const color = node.getData()?.color;
        if (color) {
          node.setAttrs({
            rect: {
              stroke: color,
              fill: color,
            },
          });
          // Also update port colors to match
          node.getPorts().forEach((port: any) => {
            if (port.group === 'list') {
              node.portProp(port.id!, 'attrs/portBody/stroke', color);
            }
          });
        }
      });

      // Position and style TableGroup containers
      // This MUST happen after tables are positioned by layout
      const updateTableGroupPositions = () => {
        tableGroups.forEach((groupNode) => {
          const groupData = groupNode.getData();
          const tableNames = groupData?.tableNames || [];
          const color = groupData?.color || '#8B8B8B';

          // Find all tables in this group
          const groupTables = tables.filter((table) => {
            const tableName = table.id.split('-').pop(); // Extract table name from id
            return tableNames.includes(tableName);
          });

          if (groupTables.length === 0) return;

          // Calculate bounding box for all tables in group
          // Use getBBox() to get actual rendered size including all ports
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

          // CRITICAL FIX: Don't use parent-child to avoid double-movement
          // Just position the container directly - it will follow tables manually
          groupNode.position(containerX, containerY, { silent: true });
          groupNode.resize(maxX - minX + padding * 2, maxY - minY + padding * 2 + labelHeight);

          // Apply color to group container with semi-transparent background
          // Extract RGB from hex color
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          const bgColor = `rgba(${r}, ${g}, ${b}, 0.15)`; // 15% opacity for visibility

          groupNode.setAttrs({
            body: {
              stroke: color,
              fill: bgColor,
            },
            header: {
              fill: `rgba(${r}, ${g}, ${b}, 0.3)`, // Darker header for drag handle
            },
            label: {
              fill: color,
            },
          });

          // NOTE: NOT using setParent() to avoid double-movement bug
          // Container follows tables manually via updateTableGroupPositions()
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
  }, [props.database, savedPositions]);

  const handleClearPositions = () => {
    // Clear saved positions and trigger re-layout
    setSavedPositions(null);

    // Re-render with fresh Dagre layout
    if (graphRef.current && props.database) {
      const erModel = parseDatabaseToER(props.database, props.tableGroupColors);
      const layoutedModel = dagreLayoutRef.current.layout(erModel);

      graphRef.current.clearCells();
      graphRef.current.fromJSON(layoutedModel);

      // Apply custom colors and position TableGroups (same as in useEffect)
      const tableGroups = graphRef.current.getNodes().filter((n) => n.shape === 'table-group');
      const tables = graphRef.current.getNodes().filter((n) => n.shape === 'er-rect');

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

      tableGroups.forEach((groupNode) => {
        const groupData = groupNode.getData();
        const tableNames = groupData?.tableNames || [];
        const color = groupData?.color || '#8B8B8B';

        const groupTables = tables.filter((table) => {
          const tableName = table.id.split('-').pop();
          return tableNames.includes(tableName);
        });

        if (groupTables.length > 0) {
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

          const padding = 40;
          const labelHeight = 30;
          groupNode.position(minX - padding, minY - padding - labelHeight);
          groupNode.resize(maxX - minX + padding * 2, maxY - minY + padding * 2 + labelHeight);

          // Apply color with semi-transparent background
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          const bgColor = `rgba(${r}, ${g}, ${b}, 0.15)`; // 15% opacity for visibility

          groupNode.setAttrs({
            body: { stroke: color, fill: bgColor },
            header: { fill: `rgba(${r}, ${g}, ${b}, 0.3)` },
            label: { fill: color },
          });
        }
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
