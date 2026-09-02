import {
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { useCache } from '../hooks/useCache';
import { serverCall, type Template, type TemplateVariable } from '../lib/types';
import RichTextEditor from './RichTextEditor';

export type { TemplateVariable, Template };

const DEFAULT_VARIABLES: TemplateVariable[] = [
  { key: 'company_name', label: 'Company Name', placeholder: 'Company Name', type: 'text', required: true, show_in_form: true },
  { key: 'company_address', label: 'Company Address', placeholder: 'Company Address', type: 'textarea', required: false, show_in_form: true },
  { key: 'signatory_name', label: 'Signatory Name', placeholder: 'Signatory Name', type: 'text', required: true, show_in_form: true },
  { key: 'signatory_designation', label: 'Signatory Designation', placeholder: 'Signatory Designation', type: 'text', required: false, show_in_form: true },
  { key: 'gem_bid_no', label: 'GeM Bid No', placeholder: 'Enter Bid Number', type: 'text', required: true, show_in_form: true },
  { key: 'date', label: 'Date', placeholder: 'Select Date', type: 'date', required: true, show_in_form: true },
  { key: 'signature', label: 'Signature', placeholder: 'Signature URL/Stamp', type: 'text', required: false, show_in_form: false },
];

const labelToKey = (label: string): string => {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const fetchTemplates = async (): Promise<Template[]> => {
  try {
    const data = await serverCall<Template[]>('getTemplates');
    return data || [];
  } catch {
    return [];
  }
};

const Templates = () => {
  const {
    data: templates,
    loading,
    setData: setTemplates,
  } = useCache<Template[]>('templates', 'all', [], fetchTemplates);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Form states for template
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [variables, setVariables] = useState<TemplateVariable[]>(DEFAULT_VARIABLES);

  // Variable modal states
  const [varModalVisible, setVarModalVisible] = useState(false);
  const [varLabel, setVarLabel] = useState('');
  const [varPlaceholder, setVarPlaceholder] = useState('');
  const [varType, setVarType] = useState<'text' | 'number' | 'date' | 'textarea' | 'dynamic_table'>('text');
  const [varColumns, setVarColumns] = useState('');
  const [varRequired, setVarRequired] = useState(false);
  const [varShowInForm, setVarShowInForm] = useState(true);

  const openCreateDrawer = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setContent('');
    setVariables(DEFAULT_VARIABLES);
    setDrawerVisible(true);
  };

  const openEditDrawer = (tmpl: Template) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setDescription(tmpl.description);
    setContent(tmpl.content);

    let parsedVars: TemplateVariable[] = [];
    if (typeof tmpl.variables === 'string') {
      try {
        parsedVars = JSON.parse(tmpl.variables);
      } catch {
        parsedVars = DEFAULT_VARIABLES;
      }
    } else if (Array.isArray(tmpl.variables)) {
      parsedVars = tmpl.variables;
    }

    setVariables(parsedVars.length ? parsedVars : DEFAULT_VARIABLES);
    setDrawerVisible(true);
  };

  const handleCreateVariable = () => {
    if (!varLabel.trim()) {
      messageApi.warning('Please enter a variable label');
      return;
    }

    const key = labelToKey(varLabel);
    if (variables.some((v) => v.key === key)) {
      messageApi.warning('A variable with this key already exists');
      return;
    }

    if (varType === 'dynamic_table' && !varColumns.trim()) {
      messageApi.warning('Please enter comma-separated column names for Dynamic Table');
      return;
    }

    const newVar: TemplateVariable = {
      key,
      label: varLabel.trim(),
      placeholder: varPlaceholder.trim() || `Enter ${varLabel.trim()}`,
      type: varType,
      columns: varType === 'dynamic_table' ? varColumns.trim() : undefined,
      required: varRequired,
      show_in_form: varShowInForm,
    };

    setVariables((prev) => [...prev, newVar]);
    setVarModalVisible(false);

    // Reset modal form
    setVarLabel('');
    setVarPlaceholder('');
    setVarType('text');
    setVarColumns('');
    setVarRequired(false);
    setVarShowInForm(true);
    messageApi.success(`Variable {{${key}}} created!`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      messageApi.warning('Please enter template name');
      return;
    }

    // Always generate a new ID on save so existing documents retain their template reference!
    const newId = String(Date.now());
    const oldId = editingTemplate ? editingTemplate.id : undefined;

    const templateToSave: Template & { oldId?: string } = {
      id: newId,
      oldId: oldId,
      createdOn: new Date().toISOString(),
      name: name.trim(),
      description: description.trim(),
      content: content,
      variables: JSON.stringify(variables),
    };

    try {
      setSaving(true);
      await serverCall('saveTemplate', templateToSave);
      
      setTemplates((prev) => {
        // If editing, remove old template and prepend new template
        const filtered = oldId ? prev.filter((t) => t.id !== oldId) : prev;
        return [templateToSave, ...filtered];
      });

      messageApi.success('Template saved successfully!');
      setDrawerVisible(false);
    } catch {
      setTemplates((prev) => {
        const filtered = oldId ? prev.filter((t) => t.id !== oldId) : prev;
        return [templateToSave, ...filtered];
      });
      messageApi.info('Template saved to local cache');
      setDrawerVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await serverCall('deleteTemplate', id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      messageApi.success('Template deleted');
    } catch {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      messageApi.info('Template removed from cache');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: 12 }}>Loading templates...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Document Templates
          </Typography.Title>
          <Typography.Text type="secondary">
            Manage reusable templates with dynamic form variables
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
          Create Template
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {templates.length === 0 ? (
          <Col span={24}>
            <Card style={{ textAlign: 'center', padding: '40px 0' }}>
              <Typography.Text type="secondary">No templates found. Click "Create Template" to add one.</Typography.Text>
            </Card>
          </Col>
        ) : (
          templates.map((tmpl) => {
            let varList: TemplateVariable[] = [];
            if (typeof tmpl.variables === 'string') {
              try {
                varList = JSON.parse(tmpl.variables);
              } catch {
                varList = [];
              }
            } else if (Array.isArray(tmpl.variables)) {
              varList = tmpl.variables;
            }

            return (
              <Col xs={24} sm={12} md={8} key={tmpl.id}>
                <Card
                  title={tmpl.name}
                  extra={
                    <Space>
                      <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => openEditDrawer(tmpl)}
                      />
                      <Popconfirm
                        title="Delete template?"
                        onConfirm={() => handleDelete(tmpl.id)}
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  }
                  variant="outlined"
                >
                  <Typography.Paragraph
                    ellipsis={{ rows: 2 }}
                    type="secondary"
                    style={{ minHeight: 40 }}
                  >
                    {tmpl.description || 'No description provided.'}
                  </Typography.Paragraph>

                  <div style={{ marginTop: 12 }}>
                    <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Variables ({varList.length}):
                    </Typography.Text>
                    <Space size={[0, 4]} wrap>
                      {varList.map((v) => (
                        <Tag key={v.key} color={v.type === 'dynamic_table' ? 'purple' : v.show_in_form !== false ? 'blue' : 'default'}>
                          {v.label} {v.type === 'dynamic_table' && '(Table)'} {v.show_in_form === false && '(Hidden)'}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </Card>
              </Col>
            );
          })
        )}
      </Row>

      {/* Editor Drawer */}
      <Drawer
        title={editingTemplate ? 'Edit Template (Creates New Version)' : 'Create New Template'}
        width={760}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}>
            Save Template
          </Button>
        }
      >
        <Form layout="vertical">
          <Form.Item label="Template Name" required>
            <Input
              placeholder="e.g. Bid Acceptance Letter"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Description">
            <Input.TextArea
              rows={2}
              placeholder="Brief description of this template"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Content Editor" required>
            <RichTextEditor
              value={content}
              onChange={setContent}
              variables={variables}
              onAddVariable={() => setVarModalVisible(true)}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Variable Creation Modal */}
      <Modal
        title="Create New Variable"
        open={varModalVisible}
        onOk={handleCreateVariable}
        onCancel={() => setVarModalVisible(false)}
        okText="Add Variable"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Label" required help="Label is used in the template chip (e.g. Items Table -> {{items_table}})">
            <Input
              placeholder="e.g. Items List"
              value={varLabel}
              onChange={(e) => setVarLabel(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Placeholder">
            <Input
              placeholder="e.g. Enter item details"
              value={varPlaceholder}
              onChange={(e) => setVarPlaceholder(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Field Type">
            <Select
              value={varType}
              onChange={(val) => setVarType(val)}
              options={[
                { value: 'text', label: 'Text' },
                { value: 'number', label: 'Number' },
                { value: 'date', label: 'Date' },
                { value: 'textarea', label: 'Text Area' },
                { value: 'dynamic_table', label: 'Dynamic Table' },
              ]}
            />
          </Form.Item>

          {varType === 'dynamic_table' && (
            <Form.Item
              label="Table Columns (Comma Separated)"
              required
              help="Enter column headers separated by commas (e.g. Item Name, Qty, Unit Price, Total)"
            >
              <Input
                placeholder="Item Name, Quantity, Price, Total"
                value={varColumns}
                onChange={(e) => setVarColumns(e.target.value)}
              />
            </Form.Item>
          )}

          <Space direction="vertical">
            <Checkbox checked={varRequired} onChange={(e) => setVarRequired(e.target.checked)}>
              Required field in form
            </Checkbox>
            <Checkbox checked={varShowInForm} onChange={(e) => setVarShowInForm(e.target.checked)}>
              Show input in form render (show_in_form)
            </Checkbox>
          </Space>
        </Form>
      </Modal>
    </div>
  );
};

export default Templates;