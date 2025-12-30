import {
  ClearOutlined,
  ExpandOutlined,
  MinusOutlined,
  PlusOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { FloatButton } from 'antd';
import { Graph } from '@antv/x6';
import React from 'react';
import { clearDiagramState } from '@/services/storage';

interface ZoomControlsProps {
  graph: Graph | null;
  currentZoom: number;
  onClearPositions?: () => void;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({
  graph,
  currentZoom,
  onClearPositions,
}) => {
  const handleZoomIn = () => {
    if (graph) {
      graph.zoom(0.1);
    }
  };

  const handleZoomOut = () => {
    if (graph) {
      graph.zoom(-0.1);
    }
  };

  const handleFitToScreen = () => {
    if (graph) {
      graph.zoomToFit({ padding: 20, maxScale: 1 });
    }
  };

  const handleReset = () => {
    if (graph) {
      graph.zoomTo(1);
      graph.centerContent();
    }
  };

  const handleClearPositions = () => {
    clearDiagramState();
    if (onClearPositions) {
      onClearPositions();
    }
  };

  const zoomPercentage = Math.round(currentZoom * 100);

  return (
    <FloatButton.Group
      shape="square"
      style={{ right: 24, bottom: 24 }}
      trigger="hover"
      icon={<ExpandOutlined />}
    >
      <FloatButton
        tooltip={<div>Zoom In (Ctrl/Cmd + Wheel)</div>}
        icon={<PlusOutlined />}
        onClick={handleZoomIn}
      />
      <FloatButton
        tooltip={<div>Zoom: {zoomPercentage}%</div>}
        description={`${zoomPercentage}%`}
      />
      <FloatButton
        tooltip={<div>Zoom Out (Ctrl/Cmd + Wheel)</div>}
        icon={<MinusOutlined />}
        onClick={handleZoomOut}
      />
      <FloatButton
        tooltip={<div>Fit to Screen</div>}
        icon={<ExpandOutlined />}
        onClick={handleFitToScreen}
      />
      <FloatButton
        tooltip={<div>Reset Zoom (1:1)</div>}
        icon={<UndoOutlined />}
        onClick={handleReset}
      />
      <FloatButton
        tooltip={<div>Reset Layout (Clear Saved Positions)</div>}
        icon={<ClearOutlined />}
        onClick={handleClearPositions}
      />
    </FloatButton.Group>
  );
};

export default ZoomControls;
