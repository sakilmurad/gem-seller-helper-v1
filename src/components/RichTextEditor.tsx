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
} from '@ant-design/icons';
import { Button, Select, Space, Tooltip } from 'antd';
import React, { useEffect, useRef } from 'react';
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

          <Tooltip title="Insert Table">
            <Button
              size="small"
              icon={<TableOutlined />}
              onClick={() => {
                const tableHtml =
                  '<table border="1" style="border-collapse:collapse;width:100%;margin:10px 0;"><tbody><tr><td style="padding:6px;">Header 1</td><td style="padding:6px;">Header 2</td></tr><tr><td style="padding:6px;">Cell 1</td><td style="padding:6px;">Cell 2</td></tr></tbody></table><p></p>';
                execCommand('insertHTML', tableHtml);
              }}
            />
          </Tooltip>
        </div>

        {/* Row 2: Insert Variable Bar */}
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
    </div>
  );
};

export default RichTextEditor;
