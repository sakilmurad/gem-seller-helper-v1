import {
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  PlusOutlined,
  TableOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { Button, Form, InputNumber, Modal, Select, Space, Tooltip } from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import type { TemplateVariable } from './Templates';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  variables: TemplateVariable[];
  onAddVariable: () => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  variables,
  onAddVariable,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, val: string | undefined = undefined) => {
    document.execCommand(command, false, val);
    handleInput();
  };

  const insertVariable = (varKey: string) => {
    const textToInsert = `{{${varKey}}}`;
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, textToInsert);
      handleInput();
    }
  };

  const handleInsertCustomTable = () => {
    const rows = Math.max(1, Math.min(tableRows || 3, 20));
    const cols = Math.max(1, Math.min(tableCols || 3, 10));

    let headerCells = '';
    for (let c = 1; c <= cols; c++) {
      headerCells += `<th style="border:1px solid #333;padding:6px 10px;background:#f2f2f2;text-align:left;font-weight:600;">Header ${c}</th>`;
    }
    let bodyRows = '';
    for (let r = 1; r <= rows; r++) {
      let cells = '';
      for (let c = 1; c <= cols; c++) {
        cells += `<td style="border:1px solid #333;padding:6px 10px;">Cell ${r}-${c}</td>`;
      }
      bodyRows += `<tr>${cells}</tr>`;
    }
    const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p></p>`;
    if (editorRef.current) {
      editorRef.current.focus();
      execCommand('insertHTML', tableHtml);
    }
    setTableModalVisible(false);
  };

  // Helper to find parent table element relative to active selection
  const getActiveTableContext = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        const cell = node as HTMLTableCellElement;
        const row = cell.parentElement as HTMLTableRowElement;
        const table = row.parentElement?.parentElement as HTMLTableElement || row.parentElement as HTMLTableElement;
        return { cell, row, table };
      }
      node = node.parentNode;
    }
    return null;
  };

  const addTableRow = () => {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const colCount = ctx.row.children.length;
    const newRow = document.createElement('tr');
    for (let i = 0; i < colCount; i++) {
      const td = document.createElement('td');
      td.style.border = '1px solid #333';
      td.style.padding = '6px 10px';
      td.innerHTML = 'New Cell';
      newRow.appendChild(td);
    }
    ctx.row.parentNode?.insertBefore(newRow, ctx.row.nextSibling);
    handleInput();
  };

  const addTableCol = () => {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const cellIdx = Array.from(ctx.row.children).indexOf(ctx.cell);
    const rows = ctx.table.querySelectorAll('tr');
    rows.forEach((r) => {
      const children = Array.from(r.children);
      const targetCell = children[cellIdx] || children[children.length - 1];
      const newCell = document.createElement(r.parentElement?.nodeName === 'THEAD' ? 'th' : 'td');
      newCell.style.border = '1px solid #333';
      newCell.style.padding = '6px 10px';
      if (r.parentElement?.nodeName === 'THEAD') {
        newCell.style.background = '#f2f2f2';
        newCell.style.fontWeight = '600';
        newCell.innerHTML = 'New Header';
      } else {
        newCell.innerHTML = 'New Cell';
      }
      targetCell.parentNode?.insertBefore(newCell, targetCell.nextSibling);
    });
    handleInput();
  };

  const deleteTableRow = () => {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    ctx.row.remove();
    handleInput();
  };

  const deleteTableCol = () => {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    const cellIdx = Array.from(ctx.row.children).indexOf(ctx.cell);
    const rows = ctx.table.querySelectorAll('tr');
    rows.forEach((r) => {
      const children = Array.from(r.children);
      if (children[cellIdx]) children[cellIdx].remove();
    });
    handleInput();
  };

  const deleteEntireTable = () => {
    const ctx = getActiveTableContext();
    if (!ctx) return;
    ctx.table.remove();
    handleInput();
  };

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}
    >
      {/* Top Toolbar */}
      <div
        style={{
          background: '#fafafa',
          borderBottom: '1px solid #e8e8e8',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Row 1: Formatting controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Select
            defaultValue="p"
            style={{ width: 110 }}
            onChange={(val) => execCommand('formatBlock', val === 'p' ? '<p>' : `<${val}>`)}
            options={[
              { value: 'p', label: 'Normal' },
              { value: 'h1', label: 'Heading 1' },
              { value: 'h2', label: 'Heading 2' },
              { value: 'h3', label: 'Heading 3' },
            ]}
          />

          <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 2px' }} />

          <Tooltip title="Bold">
            <Button
              size="small"
              icon={<BoldOutlined />}
              onClick={() => execCommand('bold')}
            />
          </Tooltip>
          <Tooltip title="Italic">
            <Button
              size="small"
              icon={<ItalicOutlined />}
              onClick={() => execCommand('italic')}
            />
          </Tooltip>
          <Tooltip title="Underline">
            <Button
              size="small"
              icon={<UnderlineOutlined />}
              onClick={() => execCommand('underline')}
            />
          </Tooltip>

          <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 2px' }} />

          <Tooltip title="Align Left">
            <Button
              size="small"
              icon={<AlignLeftOutlined />}
              onClick={() => execCommand('justifyLeft')}
            />
          </Tooltip>
          <Tooltip title="Align Center">
            <Button
              size="small"
              icon={<AlignCenterOutlined />}
              onClick={() => execCommand('justifyCenter')}
            />
          </Tooltip>
          <Tooltip title="Align Right">
            <Button
              size="small"
              icon={<AlignRightOutlined />}
              onClick={() => execCommand('justifyRight')}
            />
          </Tooltip>

          <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 2px' }} />

          <Tooltip title="Bullet List">
            <Button
              size="small"
              icon={<UnorderedListOutlined />}
              onClick={() => execCommand('insertUnorderedList')}
            />
          </Tooltip>
          <Tooltip title="Numbered List">
            <Button
              size="small"
              icon={<OrderedListOutlined />}
              onClick={() => execCommand('insertOrderedList')}
            />
          </Tooltip>

          <div style={{ width: 1, height: 20, background: '#e8e8e8', margin: '0 2px' }} />

          <Tooltip title="Insert Custom Table">
            <Button
              size="small"
              icon={<TableOutlined />}
              onClick={() => setTableModalVisible(true)}
            >
              Table
            </Button>
          </Tooltip>

          {/* Table editing shortcuts */}
          <Tooltip title="Add Row Below">
            <Button size="small" onClick={addTableRow}>
              + Row
            </Button>
          </Tooltip>
          <Tooltip title="Add Column Right">
            <Button size="small" onClick={addTableCol}>
              + Col
            </Button>
          </Tooltip>
          <Tooltip title="Delete Active Row">
            <Button size="small" danger onClick={deleteTableRow}>
              - Row
            </Button>
          </Tooltip>
          <Tooltip title="Delete Active Column">
            <Button size="small" danger onClick={deleteTableCol}>
              - Col
            </Button>
          </Tooltip>
          <Tooltip title="Delete Entire Table">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteEntireTable} />
          </Tooltip>
        </div>

        {/* Row 2: Insert Variable Bar */}
        {variables.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 2 }}>
            <span style={{ fontSize: 13, color: '#8c8c8c', fontWeight: 400 }}>Insert Variable:</span>
            <Space size={[6, 6]} wrap>
              {variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  style={{
                    background: '#fff',
                    border: '1px dashed #d9d9d9',
                    borderRadius: 6,
                    padding: '2px 10px',
                    fontSize: 12,
                    color: '#262626',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1677ff';
                    e.currentTarget.style.color = '#1677ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d9d9d9';
                    e.currentTarget.style.color = '#262626';
                  }}
                >
                  {v.label}
                </button>
              ))}
              <button
                type="button"
                onClick={onAddVariable}
                style={{
                  background: '#fafafa',
                  border: '1px dashed #1677ff',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  color: '#1677ff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <PlusOutlined style={{ fontSize: 10 }} /> Add Variable
              </button>
            </Space>
          </div>
        )}
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={(e) => {
          // Handle Shift + Enter for soft line break (<br>)
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            document.execCommand('insertLineBreak');
            handleInput();
            return;
          }
          // Handle Ctrl + B / Cmd + B for bold
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            document.execCommand('bold');
            handleInput();
            return;
          }
          // Handle Ctrl + I / Cmd + I for italic
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
            e.preventDefault();
            document.execCommand('italic');
            handleInput();
            return;
          }
          // Handle Ctrl + U / Cmd + U for underline
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
            e.preventDefault();
            document.execCommand('underline');
            handleInput();
            return;
          }
        }}
        style={{
          minHeight: 280,
          padding: 16,
          outline: 'none',
          background: '#fff',
          fontSize: 14,
          lineHeight: 1.6,
        }}
      />

      {/* Insert Table Configuration Modal */}
      <Modal
        title="Insert Table"
        open={tableModalVisible}
        onOk={handleInsertCustomTable}
        onCancel={() => setTableModalVisible(false)}
        okText="Insert Table"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Number of Rows" required>
            <InputNumber
              min={1}
              max={20}
              style={{ width: '100%' }}
              value={tableRows}
              onChange={(val) => setTableRows(val || 3)}
            />
          </Form.Item>
          <Form.Item label="Number of Columns" required>
            <InputNumber
              min={1}
              max={10}
              style={{ width: '100%' }}
              value={tableCols}
              onChange={(val) => setTableCols(val || 3)}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RichTextEditor;
