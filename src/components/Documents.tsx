import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileTextOutlined,
  FileZipOutlined,
  LoadingOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useState } from 'react';
import { useCache } from '../hooks/useCache';
import {
  serverCall,
  parseVariables,
  type CompanySettings,
  type DocumentRecord,
  type Template,
  type TemplateVariable,
} from '../lib/types';

const BLANK_SETTINGS: CompanySettings = {
  companyName: '', companyAddress: '', PAN: '', GST: '', MSME: '',
  letterheadUrl: '', marginLeft: 15, marginTop: 15, marginRight: 15, marginBottom: 15,
  signatories: [],
};

const fetchTemplates = async (): Promise<Template[]> => {
  try { return (await serverCall<Template[]>('getTemplates')) || []; } catch { return []; }
};
const fetchSettings = async (): Promise<CompanySettings> => {
  try {
    const d = await serverCall<Record<string, unknown>>('getCompanySettings');
    return { ...BLANK_SETTINGS, ...d, signatories: Array.isArray(d.signatories) ? d.signatories as CompanySettings['signatories'] : [] };
  } catch { return BLANK_SETTINGS; }
};
const fetchDocuments = async (): Promise<DocumentRecord[]> => {
  try { return (await serverCall<DocumentRecord[]>('getDocuments')) || []; } catch { return []; }
};

const mmToPx = (mm: number) => mm * 3.78;

// Helper to format date like "15 August 2026"
const formatDateFormatted = (dateObj: Date | string = new Date()): string => {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (isNaN(d.getTime())) return String(dateObj);
  const day = d.getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const Documents = () => {
  const { data: templates, loading: loadingT } = useCache<Template[]>('templates', 'all', [], fetchTemplates);
  const { data: settings, loading: loadingS } = useCache<CompanySettings>('companySettings', 'main', BLANK_SETTINGS, fetchSettings);
  const { data: documents, setData: setDocuments } = useCache<DocumentRecord[]>('documents', 'all', [], fetchDocuments);

  // Mode: 'list' (homepage) | 'generate' (wizard)
  const [mode, setMode] = useState<'list' | 'generate'>('list');

  // Generation Wizard state
  const [step, setStep] = useState(0);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [unifiedFormValues, setUnifiedFormValues] = useState<Record<string, string>>({});
  const [dynamicTableValues, setDynamicTableValues] = useState<Record<string, Record<string, string>[]>>({});
  const [selectedSignatoryIdx, setSelectedSignatoryIdx] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();

  // List View state (Homepage)
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [filterTemplateId, setFilterTemplateId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDocRowKeys, setSelectedDocRowKeys] = useState<React.Key[]>([]);

  // Preview Modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ tmpl: Template; values: Record<string, string>; tables: Record<string, Record<string, string>[]> } | null>(null);

  const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));
  const signatory = settings.signatories[selectedSignatoryIdx] || settings.signatories[0];
  const loading = loadingT || loadingS;

  // Extract unique variables across selected templates
  const getUniqueFormVariables = (): TemplateVariable[] => {
    const varMap = new Map<string, TemplateVariable>();
    for (const tmpl of selectedTemplates) {
      const vars = parseVariables(tmpl.variables);
      for (const v of vars) {
        if (v.show_in_form && !varMap.has(v.key)) {
          varMap.set(v.key, v);
        }
      }
    }
    return Array.from(varMap.values());
  };

  const uniqueFormVariables = getUniqueFormVariables();

  // Check if form is valid
  const canGoNextFromForm = (): boolean => {
    for (const v of uniqueFormVariables) {
      if (v.required && v.type !== 'dynamic_table' && !unifiedFormValues[v.key]?.trim()) return false;
    }
    return true;
  };

  // Pre-fill default values when entering Step 1
  const initFormValues = () => {
    const formattedToday = formatDateFormatted(new Date());
    const defaults: Record<string, string> = {
      company_name: settings.companyName,
      company_address: settings.companyAddress,
      signatory_name: signatory?.names || '',
      signatory_designation: signatory?.designations || '',
      date: formattedToday,
      ...unifiedFormValues,
    };
    if (!defaults.date) {
      defaults.date = formattedToday;
    }
    setUnifiedFormValues(defaults);

    // Initialize dynamic tables if not already initialized
    const tableDefaults: Record<string, Record<string, string>[]> = { ...dynamicTableValues };
    for (const v of uniqueFormVariables) {
      if (v.type === 'dynamic_table' && !tableDefaults[v.key]) {
        tableDefaults[v.key] = [{}]; // Start with 1 empty row
      }
    }
    setDynamicTableValues(tableDefaults);
  };

  // Render HTML for Dynamic Table variable
  const renderDynamicTableHtml = (v: TemplateVariable, rows: Record<string, string>[]): string => {
    const cols = (v.columns || '').split(',').map((c) => c.trim()).filter(Boolean);
    if (cols.length === 0) return '';

    let headerHtml = cols.map((col) => `<th style="border:1px solid #333;padding:6px 10px;background:#f2f2f2;text-align:left;font-weight:600;">${col}</th>`).join('');
    let bodyHtml = (rows || []).map((row) => {
      const cellsHtml = cols.map((col) => `<td style="border:1px solid #333;padding:6px 10px;">${row[col] || ''}</td>`).join('');
      return `<tr>${cellsHtml}</tr>`;
    }).join('');

    return `
      <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;">
        <thead><tr>${headerHtml}</tr></thead>
        <tbody>${bodyHtml}</tbody>
      </table>
    `;
  };

  // Resolve template content into HTML string
  const resolveContent = useCallback(
    (tmpl: Template, values: Record<string, string>, tables: Record<string, Record<string, string>[]> = {}): string => {
      const vars = parseVariables(tmpl.variables);
      let html = tmpl.content;

      for (const v of vars) {
        const pattern = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
        if (v.type === 'dynamic_table') {
          const tableHtml = renderDynamicTableHtml(v, tables[v.key] || []);
          html = html.replace(pattern, tableHtml);
        } else if (v.key === 'signature' && signatory?.sign_stamp_urls) {
          html = html.replace(pattern, `<img src="${signatory.sign_stamp_urls}" alt="Signature" style="max-height:80px;"/>`);
        } else if (v.key === 'company_name') {
          html = html.replace(pattern, values[v.key] || settings.companyName || '');
        } else if (v.key === 'company_address') {
          html = html.replace(pattern, values[v.key] || settings.companyAddress || '');
        } else if (v.key === 'signatory_name') {
          html = html.replace(pattern, values[v.key] || signatory?.names || '');
        } else if (v.key === 'signatory_designation') {
          html = html.replace(pattern, values[v.key] || signatory?.designations || '');
        } else {
          html = html.replace(pattern, values[v.key] || '');
        }
      }
      return html;
    },
    [signatory, settings],
  );

  // Build full printable A4 HTML
  const buildLetterHtml = useCallback(
    (tmpl: Template, values: Record<string, string>, tables: Record<string, Record<string, string>[]> = {}): string => {
      const content = resolveContent(tmpl, values, tables);
      const ml = mmToPx(settings.marginLeft);
      const mt = mmToPx(settings.marginTop);
      const mr = mmToPx(settings.marginRight);
      const mb = mmToPx(settings.marginBottom);

      return `
        <div style="
          position:relative;
          width:210mm; min-height:297mm;
          background:#fff;
          ${settings.letterheadUrl ? `background-image:url('${settings.letterheadUrl}'); background-size:contain; background-repeat:no-repeat; background-position:center top;` : ''}
          page-break-after:always;
          box-sizing:border-box;
        ">
          <div style="
            padding: ${mt}px ${mr}px ${mb}px ${ml}px;
            min-height:297mm;
            box-sizing:border-box;
            font-family: 'Inter', Arial, sans-serif;
            font-size:13px;
            line-height:1.6;
            color:#222;
          ">
            ${content}
          </div>
        </div>`;
    },
    [resolveContent, settings],
  );

  // Save generated documents to Google Sheet & local cache
  // Document Title rule: Always save with Bid Number (gem_bid_no / bid_no). If not present, save with date
  const autoSaveDocuments = async () => {
    try {
      const createdOn = new Date().toISOString();
      const newDocs: DocumentRecord[] = [];

      const bidNo = unifiedFormValues['gem_bid_no'] || unifiedFormValues['bid_no'] || '';
      const dateVal = unifiedFormValues['date'] || formatDateFormatted(new Date());

      for (const tmpl of selectedTemplates) {
        const titleName = bidNo ? `Bid No: ${bidNo}` : `Date: ${dateVal}`;
        const title = `${tmpl.name} — ${titleName}`;

        const combinedPayload = {
          formValues: unifiedFormValues,
          tables: dynamicTableValues,
        };

        const docRecord: DocumentRecord = {
          sNo: String(Date.now() + Math.floor(Math.random() * 1000)),
          createdOn,
          templateId: tmpl.id,
          title,
          variableValues: JSON.stringify(combinedPayload),
          pdfUrl: '',
        };
        newDocs.push(docRecord);

        // Async call to Google Sheets
        serverCall('saveDocument', docRecord).catch(() => {});
      }

      setDocuments((prev) => [...newDocs, ...prev]);
      messageApi.success('Documents saved to sheet automatically!');
    } catch {
      messageApi.error('Failed to save documents');
    }
  };

  // Print/Save single PDF via browser print window
  const downloadSinglePdf = (tmpl: Template, values?: Record<string, string>, tables?: Record<string, Record<string, string>[]>) => {
    const vals = values || unifiedFormValues;
    const tbls = tables || dynamicTableValues;
    const html = buildLetterHtml(tmpl, vals, tbls);
    const win = window.open('', '_blank');
    if (!win) { messageApi.error('Pop-up blocked.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tmpl.name}</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Print all selected letters together
  const downloadAllPdf = (tmpls: Template[], values?: Record<string, string>, tables?: Record<string, Record<string, string>[]>) => {
    const vals = values || unifiedFormValues;
    const tbls = tables || dynamicTableValues;
    const allHtml = tmpls.map((t) => buildLetterHtml(t, vals, tbls)).join('');
    const win = window.open('', '_blank');
    if (!win) { messageApi.error('Pop-up blocked.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Generated Documents</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;}@media print{div{page-break-after:always;}div:last-child{page-break-after:auto;}}</style></head><body>${allHtml}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Preview Modal for Homepage Document List item
  const openDocPreviewModal = (doc: DocumentRecord) => {
    const tmpl = templates.find((t) => t.id === doc.templateId);
    if (!tmpl) {
      messageApi.error('Template for this document no longer exists');
      return;
    }
    let vals: Record<string, string> = {};
    let tbls: Record<string, Record<string, string>[]> = {};
    try {
      const parsed = JSON.parse(doc.variableValues);
      if (parsed.formValues || parsed.tables) {
        vals = parsed.formValues || {};
        tbls = parsed.tables || {};
      } else {
        vals = parsed;
      }
    } catch {
      vals = {};
    }
    setPreviewDoc({ tmpl, values: vals, tables: tbls });
    setPreviewModalVisible(true);
  };

  // Download multiple selected docs from homepage table
  const downloadSelectedDocsPdf = () => {
    const selectedDocs = documents.filter((d) => selectedDocRowKeys.includes(d.sNo));
    if (selectedDocs.length === 0) return;

    const win = window.open('', '_blank');
    if (!win) { messageApi.error('Pop-up blocked.'); return; }

    const combinedHtml = selectedDocs.map((doc) => {
      const tmpl = templates.find((t) => t.id === doc.templateId);
      if (!tmpl) return '';
      let vals: Record<string, string> = {};
      let tbls: Record<string, Record<string, string>[]> = {};
      try {
        const parsed = JSON.parse(doc.variableValues);
        if (parsed.formValues || parsed.tables) {
          vals = parsed.formValues || {};
          tbls = parsed.tables || {};
        } else {
          vals = parsed;
        }
      } catch {
        vals = {};
      }
      return buildLetterHtml(tmpl, vals, tbls);
    }).join('');

    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Selected Documents</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;}@media print{div{page-break-after:always;}div:last-child{page-break-after:auto;}}</style></head><body>${combinedHtml}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  // Handlers for Dynamic Table rows
  const addTableRow = (varKey: string) => {
    setDynamicTableValues((prev) => ({
      ...prev,
      [varKey]: [...(prev[varKey] || []), {}],
    }));
  };

  const removeTableRow = (varKey: string, rowIndex: number) => {
    setDynamicTableValues((prev) => ({
      ...prev,
      [varKey]: (prev[varKey] || []).filter((_, idx) => idx !== rowIndex),
    }));
  };

  const updateTableCell = (varKey: string, rowIndex: number, colName: string, val: string) => {
    setDynamicTableValues((prev) => {
      const currentRows = [...(prev[varKey] || [])];
      currentRows[rowIndex] = { ...currentRows[rowIndex], [colName]: val };
      return { ...prev, [varKey]: currentRows };
    });
  };

  // Filter templates for step 0
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
    t.description.toLowerCase().includes(templateSearchTerm.toLowerCase())
  );

  // Filter documents for homepage list
  const filteredDocuments = documents.filter((d) => {
    const matchesSearch = d.title.toLowerCase().includes(docSearchTerm.toLowerCase());
    const matchesFilter = filterTemplateId === 'all' || d.templateId === filterTemplateId;
    return matchesSearch && matchesFilter;
  });

  const paginatedDocuments = filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: 12 }}>Loading...</div>
      </div>
    );
  }

  /* ================================================================== */
  /*  HOMEPAGE LIST VIEW                                                */
  /* ================================================================== */
  if (mode === 'list') {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
        {contextHolder}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>Documents</Typography.Title>
            <Typography.Text type="secondary">Generated letters and official documents</Typography.Text>
          </div>
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => { setMode('generate'); setStep(0); setSelectedTemplateIds([]); setUnifiedFormValues({}); setDynamicTableValues({}); }}>
            Generate Documents
          </Button>
        </div>

        {/* Toolbar: Search, Filter, Bulk Download */}
        <Card variant="outlined" style={{ marginBottom: 20 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={10}>
              <Input
                prefix={<SearchOutlined />}
                placeholder="Search generated documents..."
                value={docSearchTerm}
                onChange={(e) => { setDocSearchTerm(e.target.value); setCurrentPage(1); }}
              />
            </Col>
            <Col xs={24} sm={8}>
              <Select
                style={{ width: '100%' }}
                value={filterTemplateId}
                onChange={(val) => { setFilterTemplateId(val); setCurrentPage(1); }}
                options={[
                  { value: 'all', label: 'All Templates' },
                  ...templates.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </Col>
            <Col xs={24} sm={6} style={{ textAlign: 'right' }}>
              {selectedDocRowKeys.length > 0 && (
                <Button icon={<FileZipOutlined />} type="primary" onClick={downloadSelectedDocsPdf}>
                  Download ({selectedDocRowKeys.length}) PDF / ZIP
                </Button>
              )}
            </Col>
          </Row>
        </Card>

        {/* Document Table */}
        <Table
          rowKey="sNo"
          dataSource={paginatedDocuments}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selectedDocRowKeys,
            onChange: (keys) => setSelectedDocRowKeys(keys),
          }}
          columns={[
            {
              title: 'Title',
              dataIndex: 'title',
              key: 'title',
              render: (text) => <Typography.Text strong>{text}</Typography.Text>,
            },
            {
              title: 'Template',
              dataIndex: 'templateId',
              key: 'templateId',
              render: (id) => {
                const tmpl = templates.find((t) => t.id === id);
                return tmpl ? <Tag color="blue">{tmpl.name}</Tag> : <Tag>Unknown</Tag>;
              },
            },
            {
              title: 'Created On',
              dataIndex: 'createdOn',
              key: 'createdOn',
              render: (d) => (d ? new Date(d).toLocaleDateString() + ' ' + new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'),
            },
            {
              title: 'Action',
              key: 'action',
              render: (_, record) => (
                <Space>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => openDocPreviewModal(record)}>
                    Preview / Download
                  </Button>
                </Space>
              ),
            },
          ]}
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredDocuments.length}
            onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
            showSizeChanger
          />
        </div>

        {/* Preview Modal for Homepage Document List */}
        <Modal
          title={previewDoc ? previewDoc.tmpl.name : 'Document Preview'}
          open={previewModalVisible}
          onCancel={() => setPreviewModalVisible(false)}
          width={860}
          footer={[
            <Button key="close" onClick={() => setPreviewModalVisible(false)}>
              Close
            </Button>,
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                if (previewDoc) downloadSinglePdf(previewDoc.tmpl, previewDoc.values, previewDoc.tables);
              }}
            >
              Download PDF
            </Button>,
          ]}
        >
          {previewDoc && (
            <div
              style={{
                overflow: 'auto',
                maxHeight: 650,
                border: '1px solid #e8e8e8',
                borderRadius: 6,
                background: '#f0f0f0',
                padding: 16,
              }}
            >
              <div
                style={{
                  width: '210mm',
                  minHeight: '297mm',
                  margin: '0 auto',
                  position: 'relative',
                  background: '#fff',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                  backgroundImage: settings.letterheadUrl ? `url('${settings.letterheadUrl}')` : undefined,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center top',
                }}
              >
                <div
                  style={{
                    padding: `${mmToPx(settings.marginTop)}px ${mmToPx(settings.marginRight)}px ${mmToPx(settings.marginBottom)}px ${mmToPx(settings.marginLeft)}px`,
                    minHeight: '297mm',
                    boxSizing: 'border-box',
                    fontFamily: "'Inter', Arial, sans-serif",
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#222',
                  }}
                  dangerouslySetInnerHTML={{ __html: resolveContent(previewDoc.tmpl, previewDoc.values, previewDoc.tables) }}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  /* ================================================================== */
  /*  GENERATION WIZARD                                                 */
  /* ================================================================== */
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>Generate Documents</Typography.Title>
          <Typography.Text type="secondary">Step-by-step document generation</Typography.Text>
        </div>
        <Button onClick={() => setMode('list')}>Cancel &amp; Back to List</Button>
      </div>

      <Steps
        current={step}
        style={{ marginBottom: 32 }}
        items={[
          { title: 'Select Templates' },
          { title: 'Fill Form' },
          { title: 'Preview & Download' },
        ]}
      />

      {/* STEP 0: Select Templates */}
      {step === 0 && (
        <div>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search templates..."
            value={templateSearchTerm}
            onChange={(e) => setTemplateSearchTerm(e.target.value)}
            style={{ marginBottom: 20, maxWidth: 360 }}
          />

          {filteredTemplates.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px' }}>
              <Typography.Text type="secondary">No templates found.</Typography.Text>
            </Card>
          ) : (
            <Checkbox.Group
              value={selectedTemplateIds}
              onChange={(vals) => setSelectedTemplateIds(vals as string[])}
              style={{ width: '100%' }}
            >
              <Row gutter={[16, 16]}>
                {filteredTemplates.map((tmpl) => {
                  const isSelected = selectedTemplateIds.includes(tmpl.id);
                  return (
                    <Col xs={24} sm={12} md={8} key={tmpl.id}>
                      <Card
                        size="small"
                        hoverable
                        style={{
                          borderColor: isSelected ? '#1677ff' : undefined,
                          boxShadow: isSelected ? '0 0 0 2px rgba(22,119,255,0.15)' : undefined,
                        }}
                        onClick={() => {
                          setSelectedTemplateIds((prev) =>
                            prev.includes(tmpl.id)
                              ? prev.filter((id) => id !== tmpl.id)
                              : [...prev, tmpl.id],
                          );
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Typography.Text strong ellipsis style={{ maxWidth: '85%' }}>
                            {tmpl.name}
                          </Typography.Text>
                          <Checkbox value={tmpl.id} onClick={(e) => e.stopPropagation()} />
                        </div>
                        <Typography.Paragraph
                          ellipsis={{ rows: 2 }}
                          type="secondary"
                          style={{ fontSize: 12, margin: '6px 0 0 0', minHeight: 36 }}
                        >
                          {tmpl.description || 'No description provided.'}
                        </Typography.Paragraph>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </Checkbox.Group>
          )}
        </div>
      )}

      {/* STEP 1: Fill Form (Unified Unique Variables + Dynamic Table Support) */}
      {step === 1 && (
        <div>
          {settings.signatories.length > 1 && (
            <Card size="small" style={{ marginBottom: 20 }}>
              <Form.Item label="Select Signatory" style={{ marginBottom: 0 }}>
                <Select
                  value={selectedSignatoryIdx}
                  onChange={(val) => setSelectedSignatoryIdx(val)}
                  options={settings.signatories.map((s, i) => ({
                    value: i,
                    label: `${s.names} — ${s.designations}`,
                  }))}
                />
              </Form.Item>
            </Card>
          )}

          <Card variant="outlined" title="Document Details Form">
            <Form layout="vertical">
              <Row gutter={16}>
                {uniqueFormVariables.map((v) => {
                  if (v.type === 'dynamic_table') {
                    const cols = (v.columns || '').split(',').map((c) => c.trim()).filter(Boolean);
                    const rows = dynamicTableValues[v.key] || [{}];

                    return (
                      <Col span={24} key={v.key} style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Typography.Text strong>{v.label} (Dynamic Table)</Typography.Text>
                          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addTableRow(v.key)}>
                            Add Row
                          </Button>
                        </div>
                        <Card size="small" style={{ background: '#fafafa' }}>
                          {rows.map((row, rIdx) => (
                            <Row gutter={12} key={rIdx} align="middle" style={{ marginBottom: 8 }}>
                              {cols.map((col) => (
                                <Col flex="1" key={col}>
                                  <Input
                                    placeholder={col}
                                    value={row[col] || ''}
                                    onChange={(e) => updateTableCell(v.key, rIdx, col, e.target.value)}
                                  />
                                </Col>
                              ))}
                              {rows.length > 1 && (
                                <Col flex="none">
                                  <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeTableRow(v.key, rIdx)} />
                                </Col>
                              )}
                            </Row>
                          ))}
                        </Card>
                      </Col>
                    );
                  }

                  return (
                    <Col xs={24} sm={v.type === 'textarea' ? 24 : 12} key={v.key}>
                      <Form.Item
                        label={v.label}
                        required={v.required}
                        validateStatus={v.required && !unifiedFormValues[v.key]?.trim() ? 'error' : undefined}
                      >
                        {v.type === 'textarea' ? (
                          <Input.TextArea
                            rows={3}
                            placeholder={v.placeholder}
                            value={unifiedFormValues[v.key] || ''}
                            onChange={(e) => setUnifiedFormValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                          />
                        ) : v.type === 'number' ? (
                          <InputNumber
                            style={{ width: '100%' }}
                            placeholder={v.placeholder}
                            value={unifiedFormValues[v.key] ? Number(unifiedFormValues[v.key]) : undefined}
                            onChange={(val) => setUnifiedFormValues((prev) => ({ ...prev, [v.key]: String(val ?? '') }))}
                          />
                        ) : v.type === 'date' ? (
                          <DatePicker
                            style={{ width: '100%' }}
                            format="DD MMMM YYYY"
                            value={
                              unifiedFormValues[v.key]
                                ? dayjs(unifiedFormValues[v.key], ['DD MMMM YYYY', 'YYYY-MM-DD'])
                                : dayjs()
                            }
                            onChange={(_d, dateStr) =>
                              setUnifiedFormValues((prev) => ({
                                ...prev,
                                [v.key]: typeof dateStr === 'string' ? dateStr : formatDateFormatted(new Date()),
                              }))
                            }
                          />
                        ) : (
                          <Input
                            placeholder={v.placeholder}
                            value={unifiedFormValues[v.key] || ''}
                            onChange={(e) => setUnifiedFormValues((prev) => ({ ...prev, [v.key]: e.target.value }))}
                          />
                        )}
                      </Form.Item>
                    </Col>
                  );
                })}
              </Row>
            </Form>
          </Card>
        </div>
      )}

      {/* STEP 2: Preview & Download */}
      {step === 2 && (
        <div>
          <Card size="small" style={{ marginBottom: 20 }}>
            <Space wrap>
              <Button type="primary" icon={<DownloadOutlined />} onClick={() => downloadAllPdf(selectedTemplates)}>
                Download All PDF / ZIP
              </Button>
            </Space>
          </Card>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {selectedTemplates.map((tmpl) => (
              <Card
                key={tmpl.id}
                title={tmpl.name}
                extra={
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadSinglePdf(tmpl)}>
                    Download Single PDF
                  </Button>
                }
                variant="outlined"
              >
                <div
                  style={{
                    overflow: 'auto',
                    maxHeight: 650,
                    border: '1px solid #e8e8e8',
                    borderRadius: 6,
                    background: '#f0f0f0',
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      width: '210mm',
                      minHeight: '297mm',
                      margin: '0 auto',
                      position: 'relative',
                      background: '#fff',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                      backgroundImage: settings.letterheadUrl ? `url('${settings.letterheadUrl}')` : undefined,
                      backgroundSize: 'contain',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'center top',
                    }}
                  >
                    <div
                      style={{
                        padding: `${mmToPx(settings.marginTop)}px ${mmToPx(settings.marginRight)}px ${mmToPx(settings.marginBottom)}px ${mmToPx(settings.marginLeft)}px`,
                        minHeight: '297mm',
                        boxSizing: 'border-box',
                        fontFamily: "'Inter', Arial, sans-serif",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: '#222',
                      }}
                      dangerouslySetInnerHTML={{ __html: resolveContent(tmpl, unifiedFormValues, dynamicTableValues) }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}

      {/* Navigation Footer */}
      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button
          disabled={step === 0}
          icon={<ArrowLeftOutlined />}
          onClick={() => setStep((s) => s - 1)}
        >
          Back
        </Button>

        {step === 0 && (
          <Button
            type="primary"
            disabled={selectedTemplateIds.length === 0}
            icon={<ArrowRightOutlined />}
            onClick={() => { initFormValues(); setStep(1); }}
          >
            Next
          </Button>
        )}

        {step === 1 && (
          <Button
            type="primary"
            disabled={!canGoNextFromForm()}
            icon={<ArrowRightOutlined />}
            onClick={() => { autoSaveDocuments(); setStep(2); }}
          >
            Generate &amp; Save Documents
          </Button>
        )}

        {step === 2 && (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => { setMode('list'); setStep(0); setSelectedTemplateIds([]); setUnifiedFormValues({}); setDynamicTableValues({}); }}
          >
            Done — Back to Homepage
          </Button>
        )}
      </div>
    </div>
  );
};

export default Documents;