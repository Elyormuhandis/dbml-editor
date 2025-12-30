import {
  ExportOutlined,
  ImportOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { exporter, importer, Parser } from '@dbml/core';
import { FloatButton, message, Modal, Select, Space } from 'antd';
import { debounce } from 'lodash-es';
import { useEffect, useRef, useState } from 'react';
import MonacoEditor from 'react-monaco-editor';

import { InitCode } from '@/components/editor';
import Viewer from '@/components/viewer/viewer';
import ErrorFmt, {
  ExportFormat,
  ImportFormat,
  preprocessTableGroupColors,
} from '@/services/dbml';
import {
  loadDbmlCode,
  loadEditorCollapsed,
  loadEditorWidth,
  saveDbmlCode,
  saveEditorCollapsed,
  saveEditorWidth,
} from '@/services/storage';
import { PageContainer } from '@ant-design/pro-components';
import { CompilerError } from '@dbml/core/types/parse/error';
import TextArea from 'antd/es/input/TextArea';
import './index.less';

const defaultBuildDelay = 2000;
const DEFAULT_EDITOR_WIDTH = 40; // 40% of viewport

export default () => {
  const [messageApi, contextHolder] = message.useMessage();
  const parserRef = useRef(new Parser());

  // Initialize database once with preprocessing
  const [initialState] = useState(() => {
    const initialCode = loadDbmlCode() || InitCode;
    const { processed } = preprocessTableGroupColors(initialCode);
    const initialDatabase = parserRef.current.parse(processed, 'dbmlv2');
    return { initialCode, initialDatabase };
  });

  const [code, setCode] = useState(initialState.initialCode);
  const [database, setDatabase] = useState(initialState.initialDatabase);
  const [tableGroupColors, setTableGroupColors] = useState<
    Record<string, string>
  >({});
  const [tableGroupNotes, setTableGroupNotes] = useState<
    Record<string, string>
  >({});
  const tableGroupColorsRef = useRef<string>('{}');
  const tableGroupNotesRef = useRef<string>('{}');

  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<ImportFormat>('mysql');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mysql');
  const [exportText, setExportText] = useState('');
  const [regen, setRegen] = useState(0);

  // Resizable panel state
  const [editorWidth, setEditorWidth] = useState(() => {
    return loadEditorWidth() || DEFAULT_EDITOR_WIDTH;
  });
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(() => {
    return loadEditorCollapsed() || false;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // editor change - immediate update for code state
  const editorOnChange = (newValue: string) => {
    setCode(newValue);
  };

  // Monaco editor init
  const editorDidMount = (editor: any, monaco: any) => {
    // Override Enter key to work normally (not Cmd+Enter)
    // Remove any keybinding that might interfere with Enter
    editor.addCommand(monaco.KeyCode.Enter, () => {
      // Let default Enter behavior happen
      editor.trigger('keyboard', 'type', { text: '\n' });
    });
  };

  // handle import
  const handleImport = () => {
    try {
      const s = importer.import(importText, importFormat);
      setCode(s);
      // Code will be auto-saved by the useEffect debounce
      setIsImportModalOpen(false);
    } catch (e) {
      if (e as CompilerError) {
        messageApi.error(ErrorFmt(e as CompilerError));
      } else if (e instanceof Error) {
        messageApi.error(`${e.message}`);
        return;
      } else {
        throw e;
      }
    }
  };

  // Resizer drag handlers
  const handleMouseDown = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 15% and 80%
      if (newWidth >= 15 && newWidth <= 80) {
        setEditorWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Save width to localStorage when drag ends
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const currentWidth =
          ((containerRef.current
            .querySelector('.editor-panel')
            ?.getBoundingClientRect().width || 0) /
            containerRect.width) *
          100;
        saveEditorWidth(currentWidth);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Toggle editor visibility
  const toggleEditor = () => {
    const newCollapsed = !isEditorCollapsed;
    setIsEditorCollapsed(newCollapsed);
    saveEditorCollapsed(newCollapsed);
  };

  // Debounced database parsing and code saving
  useEffect(() => {
    const debouncedParse = debounce(() => {
      try {
        // Preprocess TableGroup colors and notes
        const { processed, groupColors, groupNotes } =
          preprocessTableGroupColors(code);

        // Parse with preprocessed DBML
        const newDB = parserRef.current.parse(processed, 'dbmlv2');
        setDatabase(newDB);

        // Only update tableGroupColors if they've actually changed (avoid infinite loop)
        const groupColorsStr = JSON.stringify(groupColors);
        if (groupColorsStr !== tableGroupColorsRef.current) {
          tableGroupColorsRef.current = groupColorsStr;
          setTableGroupColors(groupColors);
        }

        // Only update tableGroupNotes if they've actually changed (avoid infinite loop)
        const groupNotesStr = JSON.stringify(groupNotes);
        if (groupNotesStr !== tableGroupNotesRef.current) {
          tableGroupNotesRef.current = groupNotesStr;
          setTableGroupNotes(groupNotes);
        }

        // Save original code to localStorage after successful parse
        saveDbmlCode(code);
      } catch (e) {
        if (e as CompilerError) {
          messageApi.error(ErrorFmt(e as CompilerError));
          // TODO hl to editor
        } else if (e instanceof Error) {
          messageApi.error(`${e.message}`);
        } else {
          throw e;
        }
      }
    }, defaultBuildDelay);

    debouncedParse();

    return () => {
      debouncedParse.cancel();
    };
  }, [code]);

  // export regen
  useEffect(() => {
    if (!isExportModalOpen) return;

    try {
      const s = exporter.export(code, exportFormat);
      setExportText(s);
    } catch (e) {
      if (e as CompilerError) {
        messageApi.error(ErrorFmt(e as CompilerError));
      } else if (e instanceof Error) {
        messageApi.error(`${e.message}`);
      } else {
        throw e;
      }
    }
  }, [exportFormat, regen]);

  return (
    <>
      {contextHolder}
      <FloatButton
        tooltip={<div>Import SQL</div>}
        icon={<ImportOutlined />}
        style={{ left: 24 }}
        onClick={function () {
          setIsImportModalOpen(true);
        }}
      />
      <FloatButton
        tooltip={<div>Export SQL</div>}
        icon={<ExportOutlined />}
        style={{ left: 72 }}
        onClick={function () {
          setRegen(regen + 1);
          setIsExportModalOpen(true);
        }}
      />

      <Modal
        title="Import SQL"
        open={isImportModalOpen}
        onOk={handleImport}
        onCancel={() => {
          setIsImportModalOpen(false);
        }}
      >
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
          <Select
            defaultValue={importFormat}
            style={{ width: 120 }}
            onChange={(v) => setImportFormat(v)}
            options={[
              { value: 'mysql', label: 'MySQL' },
              { value: 'postgres', label: 'Postgres' },
              { value: 'postgresLegacy', label: 'Postgres Legacy' },
              { value: 'dbml', label: 'DBML' },
              { value: 'mssql', label: 'MSSQL' },
              { value: 'json', label: 'JSON' },
            ]}
          />
          <TextArea
            rows={24}
            placeholder="Import your schema"
            onChange={(e) => setImportText(e.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        title="Export SQL"
        open={isExportModalOpen}
        onOk={() => {
          setIsExportModalOpen(false);
        }}
        onCancel={() => {
          setIsExportModalOpen(false);
        }}
      >
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
          <Select
            defaultValue={exportFormat}
            style={{ width: 120 }}
            onChange={(v) => setExportFormat(v)}
            options={[
              { value: 'mysql', label: 'MySQL' },
              { value: 'postgres', label: 'Postgres' },
              { value: 'dbml', label: 'DBML' },
              { value: 'mssql', label: 'MSSQL' },
              { value: 'oracle', label: 'Oracle' },
              { value: 'json', label: 'JSON' },
            ]}
          />
          <TextArea rows={24} value={exportText} readOnly />
        </Space>
      </Modal>

      <PageContainer ghost header={{ title: '' }}>
        <div className="home-container" ref={containerRef}>
          {/* Editor Panel */}
          <div
            className={`editor-panel ${isEditorCollapsed ? 'collapsed' : ''}`}
            style={{ width: isEditorCollapsed ? 0 : `${editorWidth}%` }}
          >
            <div className="editor">
              <MonacoEditor
                width={'100%'}
                language="dbml"
                theme="vs-dark"
                value={code}
                options={{
                  selectOnLineNumbers: true,
                  minimap: {
                    enabled: false,
                  },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                }}
                onChange={editorOnChange}
                editorDidMount={editorDidMount}
              />
            </div>
          </div>

          {/* Resizer */}
          {!isEditorCollapsed && (
            <div
              className={`resizer ${isDragging ? 'dragging' : ''}`}
              onMouseDown={handleMouseDown}
            />
          )}

          {/* Viewer Panel */}
          <div className="viewer-panel">
            {/* Toggle Button */}
            <FloatButton
              className="editor-toggle"
              icon={
                isEditorCollapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              tooltip={isEditorCollapsed ? 'Show Editor' : 'Hide Editor'}
              onClick={toggleEditor}
            />
            <Viewer
              database={database}
              tableGroupColors={tableGroupColors}
              tableGroupNotes={tableGroupNotes}
            />
          </div>
        </div>
      </PageContainer>
    </>
  );
};
