import { Graph } from '@antv/x6';

const STORAGE_KEYS = {
  ZOOM: 'dbml-editor-zoom',
  DIAGRAM_STATE: 'dbml-editor-diagram',
  EDITOR_WIDTH: 'dbml-editor-editor-width',
  EDITOR_COLLAPSED: 'dbml-editor-editor-collapsed',
  DBML_CODE: 'dbml-editor-code',
  COLLAPSED_GROUPS: 'dbml-editor-collapsed-groups',
  GROUP_MANUAL_SIZES: 'dbml-editor-group-manual-sizes',
};

// Zoom persistence
export const saveZoom = (zoom: number): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ZOOM, JSON.stringify(zoom));
  } catch (error) {
    console.error('Failed to save zoom to localStorage:', error);
  }
};

export const loadZoom = (): number | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ZOOM);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load zoom from localStorage:', error);
  }
  return null;
};

// Node positions persistence
export interface NodePosition {
  x: number;
  y: number;
}

export interface DiagramState {
  positions: Record<string, NodePosition>; // key: node.id (e.g., "public-users")
  zoom: number;
  timestamp: number; // for cache invalidation
}

export const saveNodePositions = (graph: Graph): void => {
  try {
    const nodes = graph.getNodes();
    const positions: Record<string, NodePosition> = {};

    nodes.forEach((node) => {
      const pos = node.position();
      positions[node.id] = { x: pos.x, y: pos.y };
    });

    const state: DiagramState = {
      positions,
      zoom: graph.zoom(),
      timestamp: Date.now(),
    };

    localStorage.setItem(STORAGE_KEYS.DIAGRAM_STATE, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save diagram state to localStorage:', error);
  }
};

export const clearDiagramState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DIAGRAM_STATE);
  } catch (error) {
    console.error('Failed to clear diagram state from localStorage:', error);
  }
};

export const loadDiagramState = (): DiagramState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DIAGRAM_STATE);
    if (!saved) return null;

    const state: DiagramState = JSON.parse(saved);

    // Invalidate cache older than 30 days
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - state.timestamp > thirtyDaysInMs) {
      clearDiagramState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load diagram state from localStorage:', error);
    return null;
  }
};

// Editor layout persistence
export const saveEditorWidth = (width: number): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.EDITOR_WIDTH, JSON.stringify(width));
  } catch (error) {
    console.error('Failed to save editor width to localStorage:', error);
  }
};

export const loadEditorWidth = (): number | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.EDITOR_WIDTH);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Failed to load editor width from localStorage:', error);
  }
  return null;
};

export const saveEditorCollapsed = (collapsed: boolean): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.EDITOR_COLLAPSED,
      JSON.stringify(collapsed),
    );
  } catch (error) {
    console.error(
      'Failed to save editor collapsed state to localStorage:',
      error,
    );
  }
};

export const loadEditorCollapsed = (): boolean | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.EDITOR_COLLAPSED);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(
      'Failed to load editor collapsed state from localStorage:',
      error,
    );
  }
  return null;
};

// DBML code persistence
export const saveDbmlCode = (code: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.DBML_CODE, code);
  } catch (error) {
    console.error('Failed to save DBML code to localStorage:', error);
  }
};

export const loadDbmlCode = (): string | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.DBML_CODE);
    return saved;
  } catch (error) {
    console.error('Failed to load DBML code from localStorage:', error);
  }
  return null;
};

// Collapsed TableGroups persistence
export const saveCollapsedGroups = (collapsedGroups: string[]): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.COLLAPSED_GROUPS,
      JSON.stringify(collapsedGroups),
    );
  } catch (error) {
    console.error('Failed to save collapsed groups:', error);
  }
};

export const loadCollapsedGroups = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.COLLAPSED_GROUPS);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Failed to load collapsed groups:', error);
    return [];
  }
};

// Manual TableGroup sizes persistence
export interface GroupSize {
  width: number;
  height: number;
  isManual: boolean;
}

export const saveGroupSizes = (sizes: Record<string, GroupSize>): void => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.GROUP_MANUAL_SIZES,
      JSON.stringify(sizes),
    );
  } catch (error) {
    console.error('Failed to save group sizes:', error);
  }
};

export const loadGroupSizes = (): Record<string, GroupSize> => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GROUP_MANUAL_SIZES);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('Failed to load group sizes:', error);
    return {};
  }
};
