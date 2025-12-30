import { Graph } from '@antv/x6';

const LINE_HEIGHT = 24;
const NODE_WIDTH = 150;

function registerER() {
  // Register custom crow's foot notation markers
  Graph.registerMarker(
    'crowfoot',
    () => ({
      tagName: 'path',
      d: 'M 0,-5 L 10,0 L 0,5 M 10,0 L 10,0',
      stroke: '#5F95FF',
      strokeWidth: 2,
      fill: 'none',
    }),
    true,
  );

  Graph.registerMarker(
    'one',
    () => ({
      tagName: 'path',
      d: 'M 0,-5 L 0,5',
      stroke: '#5F95FF',
      strokeWidth: 2,
      fill: 'none',
    }),
    true,
  );

  Graph.registerMarker(
    'zeroOrOne',
    () => ({
      tagName: 'path',
      d: 'M 0,-5 L 0,5 M 0,0 L -8,0 M -8,0 a 4,4 0 1,0 0,0.01',
      stroke: '#5F95FF',
      strokeWidth: 2,
      fill: 'none',
    }),
    true,
  );

  Graph.registerPortLayout(
    'erPortPosition',
    (portsPositionArgs) => {
      return portsPositionArgs.map((_, index) => {
        return {
          position: {
            x: 0,
            y: (index + 1) * LINE_HEIGHT,
          },
          angle: 0,
        };
      });
    },
    true,
  );
  Graph.registerPortLayout(
    'erNotePosition',
    (portsPositionArgs) => {
      return portsPositionArgs.map(() => {
        return {
          position: {
            x: 0,
            y: 0,
          },
        };
      });
    },
    true,
  );

  // Register TableGroup container node
  Graph.registerNode(
    'table-group',
    {
      inherit: 'rect',
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'rect',
          selector: 'header',
        },
        {
          tagName: 'text',
          selector: 'collapseBtn',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
        {
          tagName: 'text',
          selector: 'noteIcon',
        },
        {
          tagName: 'title',
          selector: 'noteTooltip',
        },
      ],
      attrs: {
        rect: {
          strokeWidth: 2,
          stroke: '#8B8B8B',
          fill: 'rgba(139, 139, 139, 0.15)', // Light gray background (15% opacity)
          rx: 8,
          ry: 8,
        },
        body: {
          pointerEvents: 'none', // Container cannot receive events - let tables be draggable
        },
        header: {
          // Drag handle area at the top
          refWidth: '100%',
          height: 30,
          fill: 'rgba(139, 139, 139, 0.3)', // Slightly darker for visibility
          stroke: 'none',
          cursor: 'move',
          pointerEvents: 'all', // This is the primary drag handle
          rx: 8,
          ry: 8,
        },
        collapseBtn: {
          text: '−', // Minus sign for expanded state
          refX: 12,
          refY: 20,
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#666',
          cursor: 'pointer',
          pointerEvents: 'all',
          textAnchor: 'middle',
        },
        label: {
          fontWeight: 'bold',
          fill: '#8B8B8B',
          fontSize: 14,
          refX: 28,
          refY: 10,
          textAnchor: 'start',
          pointerEvents: 'none', // Don't block header clicks
        },
        noteIcon: {
          text: '', // Will be set to 'i' when note exists
          refX: '100%',
          refX2: -20,
          refY: 20,
          fontSize: 12,
          fontStyle: 'italic',
          fontWeight: 'bold',
          fill: '#666',
          cursor: 'help',
          pointerEvents: 'all',
          textAnchor: 'middle',
        },
        noteTooltip: {
          text: '', // Will contain the note text for SVG title tooltip
        },
      },
    },
    true,
  );

  Graph.registerNode(
    'er-rect',
    {
      inherit: 'rect',
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'text',
          selector: 'label',
        },
      ],
      attrs: {
        rect: {
          strokeWidth: 1,
          stroke: '#5F95FF',
          fill: '#5F95FF',
        },
        label: {
          fontWeight: 'bold',
          fill: '#ffffff',
          fontSize: 12,
        },
      },
      ports: {
        groups: {
          note: {
            position: 'erNotePosition',
            markup: [
              {
                tagName: 'text',
                selector: 'note',
              },
            ],
            attrs: {
              note: {
                refX: 0,
                refY: -LINE_HEIGHT,
              },
            },
          },
          list: {
            position: 'erPortPosition',
            markup: [
              {
                tagName: 'rect',
                selector: 'portBody',
              },
              {
                tagName: 'text',
                selector: 'portNameLabel',
              },
              {
                tagName: 'text',
                selector: 'portTypeLabel',
              },
            ],
            attrs: {
              portBody: {
                width: NODE_WIDTH,
                height: LINE_HEIGHT,
                strokeWidth: 1,
                stroke: '#5F95FF',
                fill: '#EFF4FF',
                magnet: true,
              },
              portNameLabel: {
                ref: 'portBody',
                refX: 6,
                refY: 6,
                fontSize: 10,
              },
              portTypeLabel: {
                ref: 'portBody',
                refX: 95,
                refY: 6,
                fontSize: 10,
              },
            },
          },
        },
      },
    },
    true,
  );
}

export default registerER;
