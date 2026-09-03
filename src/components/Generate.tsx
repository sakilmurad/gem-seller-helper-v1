import {
  ArrowLeftOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileAddOutlined,
  LoadingOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
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
  Row,
  Space,
  Spin,
  Steps,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useCallback, useRef, useState } from 'react';
import { useCache } from '../hooks/useCache';
import {
  getCompanyDataForVariableKey,
  getEffectiveDefaultSignatoryIndex,
  parseVariables,
  serverCall,
  type CompanySettings,
  type DocumentRecord,
  type Template,
} from '../lib/types';
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor';

dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);

const BLANK_SETTINGS: CompanySettings = {
  companyName: '',
  companyAddress: '',
  PAN: '',
  GST: '',
  MSME: '',
  letterheadUrl: '',
  marginLeft: 15,
  marginTop: 15,
  marginRight: 15,
  marginBottom: 15,
  signatories: [],
  geminiApiKey: '',
  geminiModelId: 'gemini-2.5-flash',
};

const fetchTemplates = async (): Promise<Template[]> => {
  try {
    return (await serverCall<Template[]>('getTemplates')) || [];
  } catch {
    return [];
  }
};
const fetchSettings = async (): Promise<CompanySettings> => {
  try {
    const d = await serverCall<Record<string, unknown>>('getCompanySettings');
    return {
      ...BLANK_SETTINGS,
      ...d,
      signatories: Array.isArray(d.signatories)
        ? (d.signatories as CompanySettings['signatories'])
        : [],
    };
  } catch {
    return BLANK_SETTINGS;
  }
};

const mmToPx = (mm: number) => mm * 3.78;

const formatDateFormatted = (dateObj: Date | string = new Date()): string => {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (isNaN(d.getTime())) return String(dateObj);
  const day = d.getDate();
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

const safeDayjs = (val?: string) => {
  if (!val) return dayjs();
  const formats = ['DD MMMM YYYY', 'DD MMM YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'];
  const parsed = dayjs(val, formats, true);
  if (parsed.isValid()) return parsed;
  const fallback = dayjs(val);
  return fallback.isValid() ? fallback : dayjs();
};

interface GenerateProps {
  onNavigateToDocuments?: () => void;
  externalSignatoryIdx?: number;
  onSelectSignatoryIdx?: (idx: number) => void;
}

const Generate: React.FC<GenerateProps> = ({
  onNavigateToDocuments,
  externalSignatoryIdx,
}) => {
  const { data: templates, loading: loadingT } = useCache<Template[]>(
    'templates',
    'all',
    [],
    fetchTemplates,
  );
  const { data: settings, loading: loadingS } = useCache<CompanySettings>(
    'companySettings',
    'main',
    BLANK_SETTINGS,
    fetchSettings,
  );

  // Active view mode: 'cards' | 'custom_editor' | 'wizard' | 'ai_prompt'
  const [mode, setMode] = useState<'cards' | 'custom_editor' | 'wizard' | 'ai_prompt'>('cards');

  // Custom Document Editor state
  const [editingSNo, setEditingSNo] = useState<string | null>(null);
  const [editingCreatedOn, setEditingCreatedOn] = useState<string | null>(null);
  const [customDocTitle, setCustomDocTitle] = useState('');
  const [customDocDate, setCustomDocDate] = useState(formatDateFormatted(new Date()));
  const [customContent, setCustomContent] = useState('');
  const [customPreviewModal, setCustomPreviewModal] = useState(false);
  const customEditorRef = useRef<RichTextEditorRef>(null);

  // AI Prompt Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiInjectCompany, setAiInjectCompany] = useState(true);
  const [aiInjectConsignee, setAiInjectConsignee] = useState(true);
  const [aiWordLimit, setAiWordLimit] = useState(150);
  const [aiLoading, setAiLoading] = useState(false);

  // Template Generation Wizard state
  const [step, setStep] = useState(0);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [unifiedFormValues, setUnifiedFormValues] = useState<Record<string, string>>({});
  const [dynamicTableValues, setDynamicTableValues] = useState<
    Record<string, Record<string, string>[]>
  >({});
  const [messageApi, contextHolder] = message.useMessage();

  const selectedSignatoryIdx =
    externalSignatoryIdx !== undefined
      ? externalSignatoryIdx
      : getEffectiveDefaultSignatoryIndex(settings);

  const signatory = settings.signatories[selectedSignatoryIdx] || settings.signatories[0];
  const selectedTemplates = templates.filter((t) => selectedTemplateIds.includes(t.id));
  const loading = loadingT || loadingS;

  // Insert value into custom editor at current cursor
  const insertValueIntoCustomContent = (val: string) => {
    if (customEditorRef.current) {
      customEditorRef.current.insertAtCursor(val);
    } else {
      setCustomContent((prev) => `${prev} ${val}`);
    }
    messageApi.success('Value inserted!');
  };

  // Handle Save Custom Document
  const handleSaveCustomDocument = async (downloadPdfAfterSave = false) => {
    if (!customDocTitle.trim()) {
      messageApi.warning('Please enter document title');
      return;
    }
    if (!customContent.trim()) {
      messageApi.warning('Please enter document content');
      return;
    }

    const createdOn = editingCreatedOn || new Date().toISOString();
    const docRecord: DocumentRecord = {
      sNo: editingSNo || String(Date.now() + Math.floor(Math.random() * 1000)),
      createdOn,
      templateId: '',
      title: customDocTitle.trim(),
      variableValues: JSON.stringify({ custom: true }),
      pdfUrl: '',
      content: customContent,
    };

    try {
      await serverCall('saveDocument', docRecord);
      messageApi.success('Document saved successfully!');
    } catch {
      messageApi.info('Document saved to cache');
    }

    if (downloadPdfAfterSave) {
      downloadSinglePdf(
        {
          id: '',
          createdOn,
          name: customDocTitle,
          description: '',
          content: customContent,
          variables: [],
        },
        {},
      );
    }

    if (onNavigateToDocuments) {
      onNavigateToDocuments();
    } else {
      setMode('cards');
    }
  };

  // AI Generation Call
  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) {
      messageApi.warning('Please enter a prompt describing the letter.');
      return;
    }

    setAiLoading(true);
    try {
      const companyInfoStr = aiInjectCompany
        ? `${settings.companyName || ''} - ${settings.companyAddress || ''}`.trim()
        : '';
      const consigneeInfoStr = aiInjectConsignee
        ? `${signatory?.names || ''} (${signatory?.designations || ''})`.trim()
        : '';

      const payload = {
        prompt: aiPrompt,
        wordLimit: aiWordLimit || 150,
        companyInfo: companyInfoStr,
        consigneeInfo: consigneeInfoStr,
        apiKey: settings.geminiApiKey || '',
        modelId: settings.geminiModelId || 'gemini-2.5-flash',
      };

      const result = await serverCall<{ title: string; content: string }>(
        'generateLetterWithAI',
        payload,
      );

      if (result && result.content) {
        setEditingSNo(null);
        setEditingCreatedOn(null);
        setCustomDocTitle(result.title || 'AI Generated Document');
        setCustomDocDate(formatDateFormatted(new Date()));
        setCustomContent(result.content);
        setMode('custom_editor');
        messageApi.success('Letter generated by Gemini AI!');
      } else {
        messageApi.error('Received empty response from AI.');
      }
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : 'AI Generation failed.');
    } finally {
      setAiLoading(false);
    }
  };

  // Helper for printable A4 HTML
  const buildLetterHtml = useCallback(
    (
      tmpl: Template,
      values: Record<string, string>,
      tables: Record<string, Record<string, string>[]> = {},
    ): string => {
      const vars = parseVariables(tmpl.variables);
      let html = tmpl.content;

      for (const v of vars) {
        const pattern = new RegExp(`\\{\\{${v.key}\\}\\}`, 'g');
        const companyMatched = getCompanyDataForVariableKey(v.key, settings);

        if (v.type === 'dynamic_table') {
          const cols = (v.columns || '').split(',').map((c) => c.trim()).filter(Boolean);
          const rows = tables[v.key] || [];
          let headerHtml = cols
            .map(
              (col) =>
                `<th style="border:1px solid #333;padding:6px 10px;background:#f2f2f2;text-align:left;font-weight:600;">${col}</th>`,
            )
            .join('');
          let bodyHtml = rows
            .map((row) => {
              const cellsHtml = cols
                .map((col) => `<td style="border:1px solid #333;padding:6px 10px;">${row[col] || ''}</td>`)
                .join('');
              return `<tr>${cellsHtml}</tr>`;
            })
            .join('');
          const tableHtml = `<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:12px;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
          html = html.replace(pattern, tableHtml);
        } else if (v.key === 'signature' && signatory?.sign_stamp_urls) {
          html = html.replace(
            pattern,
            `<img src="${signatory.sign_stamp_urls}" alt="Signature" style="max-height:100px;"/>`,
          );
        } else if (companyMatched !== null) {
          html = html.replace(pattern, values[v.key] || companyMatched);
        } else {
          html = html.replace(pattern, values[v.key] || '');
        }
      }

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
            ${html}
          </div>
        </div>`;
    },
    [signatory, settings],
  );

  const downloadSinglePdf = (
    tmpl: Template,
    values?: Record<string, string>,
    tables?: Record<string, Record<string, string>[]>,
  ) => {
    const html = buildLetterHtml(tmpl, values || {}, tables || {});
    const win = window.open('', '_blank');
    if (!win) {
      messageApi.error('Pop-up blocked.');
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${tmpl.name}</title><style>@page{size:A4;margin:0;}body{margin:0;padding:0;}</style></head><body>${html}</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  };

  const autoSaveDocuments = async () => {
    try {
      const createdOn = new Date().toISOString();
      const newDocs: DocumentRecord[] = [];
      const bidNo = unifiedFormValues['gem_bid_no'] || unifiedFormValues['bid_no'] || '';
      const dateVal = unifiedFormValues['date'] || formatDateFormatted(new Date());

      for (let i = 0; i < selectedTemplates.length; i++) {
        const tmpl = selectedTemplates[i];
        const titleName = bidNo ? `Bid No: ${bidNo}` : `Date: ${dateVal}`;
        const title = `${tmpl.name} - ${titleName}`;

        const combinedPayload = {
          formValues: unifiedFormValues,
          tables: dynamicTableValues,
        };

        const docRecord: DocumentRecord = {
          sNo: String(Date.now() + i + Math.floor(Math.random() * 100)),
          createdOn,
          templateId: tmpl.id,
          title,
          variableValues: JSON.stringify(combinedPayload),
          pdfUrl: '',
        };
        newDocs.push(docRecord);
      }

      await serverCall('saveDocuments', newDocs);
      messageApi.success('Documents saved successfully!');
    } catch {
      messageApi.error('Failed to save documents');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: 12 }}>Loading generation tools...</div>
      </div>
    );
  }

  /* ================================================================== */
  /*  MAIN DASHBOARD - 3 GENERATION CARDS                               */
  /* ================================================================== */
  if (mode === 'cards') {
    return (
      <div style={{ maxWidth: 1050, margin: '0 auto', padding: '24px' }}>
        {contextHolder}

        <div style={{ marginBottom: 32 }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Generate Document
          </Typography.Title>
          <Typography.Text type="secondary">
            Choose how you want to create your new letter or document
          </Typography.Text>
        </div>

        <Row gutter={[24, 24]}>
          {/* Card 1: Start with Blank */}
          <Col xs={24} md={8}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              }}
              onClick={() => {
                setEditingSNo(null);
                setEditingCreatedOn(null);
                setCustomDocTitle('');
                setCustomDocDate(formatDateFormatted(new Date()));
                setCustomContent('');
                setMode('custom_editor');
              }}
            >
              <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#e6f4ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <FileAddOutlined style={{ fontSize: 28, color: '#1677ff' }} />
                </div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  Start with Blank
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ fontSize: 13, minHeight: 40 }}>
                  Author a custom letter from scratch using the full rich text editor with live letterhead preview.
                </Typography.Paragraph>
                <Button type="primary" ghost style={{ marginTop: 8 }}>
                  Start Blank Letter
                </Button>
              </div>
            </Card>
          </Col>

          {/* Card 2: Select Templates */}
          <Col xs={24} md={8}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                border: '1px solid #e8e8e8',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              }}
              onClick={() => {
                setStep(0);
                setSelectedTemplateIds([]);
                setUnifiedFormValues({});
                setDynamicTableValues({});
                setMode('wizard');
              }}
            >
              <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#f6ffed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <BookOutlined style={{ fontSize: 28, color: '#52c41a' }} />
                </div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  Select Templates
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ fontSize: 13, minHeight: 40 }}>
                  Generate official documents using structured pre-built templates with variable autofill.
                </Typography.Paragraph>
                <Button type="primary" ghost style={{ marginTop: 8, borderColor: '#52c41a', color: '#52c41a' }}>
                  Browse Templates
                </Button>
              </div>
            </Card>
          </Col>

          {/* Card 3: Generate with AI */}
          <Col xs={24} md={8}>
            <Card
              hoverable
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 12,
                border: '1px solid #722ed1',
                background: 'linear-gradient(180deg, #f9f0ff 0%, #ffffff 100%)',
                boxShadow: '0 4px 16px rgba(114,46,209,0.08)',
              }}
              onClick={() => {
                setAiPrompt('');
                setMode('ai_prompt');
              }}
            >
              <div style={{ textAlign: 'center', padding: '16px 0 8px 0' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#f9f0ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <RobotOutlined style={{ fontSize: 28, color: '#722ed1' }} />
                </div>
                <Typography.Title level={4} style={{ marginBottom: 8, color: '#722ed1' }}>
                  Generate with AI
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ fontSize: 13, minHeight: 40 }}>
                  Describe your requirements in plain English. Gemini AI will compose the complete formatted draft.
                </Typography.Paragraph>
                <Button
                  type="primary"
                  style={{ marginTop: 8, background: '#722ed1', borderColor: '#722ed1' }}
                  icon={<ThunderboltOutlined />}
                >
                  Write with AI
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  /* ================================================================== */
  /*  AI PROMPT WORKSPACE                                               */
  /* ================================================================== */
  if (mode === 'ai_prompt') {
    return (
      <div style={{ maxWidth: 850, margin: '0 auto', padding: '24px' }}>
        {contextHolder}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              Generate Letter with AI
            </Typography.Title>
            <Typography.Text type="secondary">
              Use Gemini AI to compose a formatted professional letter draft
            </Typography.Text>
          </div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setMode('cards')}>
            Back to Options
          </Button>
        </div>

        <Card variant="outlined" style={{ borderRadius: 12 }}>
          <Form layout="vertical">
            <Form.Item
              label="Describe the letter you want to generate"
              required
              tooltip="Specify topic, reason, PO details, tone, or key points."
            >
              <Input.TextArea
                rows={5}
                placeholder="e.g. Write an official response letter explaining a 3-day delivery delay for PO #PO-98745 due to supply chain logistics, requesting a revised delivery extension."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
              />
            </Form.Item>

            <Divider style={{ margin: '16px 0' }} />

            <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 12 }}>
              Context &amp; Injected Details:
            </Typography.Text>

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Checkbox
                    checked={aiInjectCompany}
                    onChange={(e) => setAiInjectCompany(e.target.checked)}
                  >
                    <strong>Inject Company Info</strong>
                  </Checkbox>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, paddingLeft: 24 }}>
                    {settings.companyName || 'No Company Name'} — {settings.companyAddress || 'No Address'}
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <Checkbox
                    checked={aiInjectConsignee}
                    onChange={(e) => setAiInjectConsignee(e.target.checked)}
                  >
                    <strong>Inject Consignee / Signatory</strong>
                  </Checkbox>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4, paddingLeft: 24 }}>
                    {signatory?.names || 'No Signatory'} ({signatory?.designations || 'No Designation'})
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Maximum Word Limit" style={{ marginBottom: 0 }}>
                  <InputNumber
                    style={{ width: '100%' }}
                    min={50}
                    max={1000}
                    value={aiWordLimit}
                    onChange={(val) => setAiWordLimit(val || 150)}
                    addonAfter="words"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '20px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <Button onClick={() => setMode('cards')}>Cancel</Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={aiLoading}
                onClick={handleGenerateAI}
                style={{ background: '#722ed1', borderColor: '#722ed1' }}
              >
                Generate Draft with AI
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    );
  }

  /* ================================================================== */
  /*  CUSTOM DOCUMENT EDITOR VIEW                                      */
  /* ================================================================== */
  if (mode === 'custom_editor') {
    return (
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
        {contextHolder}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {editingSNo ? 'Edit Letter' : 'Create Custom Letter'}
            </Typography.Title>
            <Typography.Text type="secondary">
              Author and refine your letter body content in the editor
            </Typography.Text>
          </div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setMode('cards')}>
            Back to Options
          </Button>
        </div>

        <Card variant="outlined" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item label="Document Title" required>
                <Input
                  placeholder="e.g. Undertaking Letter - Bid #12345"
                  value={customDocTitle}
                  onChange={(e) => setCustomDocTitle(e.target.value)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item label="Document Date">
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD MMMM YYYY"
                  value={safeDayjs(customDocDate)}
                  onChange={(dateObj, dateStr) => {
                    const val = dateObj
                      ? dateObj.format('DD MMMM YYYY')
                      : typeof dateStr === 'string'
                        ? dateStr
                        : '';
                    setCustomDocDate(val);
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Quick Insert Variables Bar */}
          <div
            style={{
              background: '#fafafa',
              padding: '12px 16px',
              borderRadius: 6,
              marginBottom: 20,
              border: '1px dashed #d9d9d9',
            }}
          >
            <Typography.Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
              Quick Insert Values (Inserts inline at active cursor):
            </Typography.Text>
            <Space wrap size={[8, 8]}>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => insertValueIntoCustomContent(settings.companyName || 'Company Name')}
              >
                Company Name
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  insertValueIntoCustomContent(
                    (settings.companyAddress || 'Company Address').replace(/\n/g, '<br/>'),
                  )
                }
              >
                Company Address
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  insertValueIntoCustomContent(signatory?.names || 'Signatory Name')
                }
              >
                Signatory Name ({signatory?.names || 'Default'})
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  insertValueIntoCustomContent(
                    signatory?.designations || 'Signatory Designation',
                  )
                }
              >
                Signatory Designation
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  insertValueIntoCustomContent(
                    customDocDate || formatDateFormatted(new Date()),
                  )
                }
              >
                Date ({customDocDate})
              </Button>
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (signatory?.sign_stamp_urls) {
                    insertValueIntoCustomContent(
                      `<img src="${signatory.sign_stamp_urls}" alt="Signature" style="max-height:90px; vertical-align:middle;"/>`,
                    );
                  } else {
                    messageApi.warning('No signature URL set for active signatory');
                  }
                }}
              >
                Signature Stamp
              </Button>
            </Space>
          </div>

          <Form.Item label="Letter Body Editor" required>
            <RichTextEditor
              ref={customEditorRef}
              value={customContent}
              onChange={setCustomContent}
              variables={[]}
              onAddVariable={() => {}}
            />
          </Form.Item>

          <Divider />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={() => setMode('cards')}>Cancel</Button>
            <Button icon={<EyeOutlined />} onClick={() => setCustomPreviewModal(true)}>
              Preview on Letterhead
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleSaveCustomDocument(true)}
            >
              Save &amp; Download PDF
            </Button>
          </div>
        </Card>

        {/* Modal for Custom Document Preview */}
        <Modal
          title={customDocTitle || 'Custom Document Preview'}
          open={customPreviewModal}
          onCancel={() => setCustomPreviewModal(false)}
          width={860}
          footer={[
            <Button key="close" onClick={() => setCustomPreviewModal(false)}>
              Close Preview
            </Button>,
            <Button
              key="download"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                setCustomPreviewModal(false);
                handleSaveCustomDocument(true);
              }}
            >
              Save &amp; Download PDF
            </Button>,
          ]}
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
                backgroundImage: settings.letterheadUrl
                  ? `url('${settings.letterheadUrl}')`
                  : undefined,
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
                dangerouslySetInnerHTML={{
                  __html: customContent || '<p>Empty letter content</p>',
                }}
              />
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  /* ================================================================== */
  /*  TEMPLATE GENERATION WIZARD                                        */
  /* ================================================================== */
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
      {contextHolder}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Generate from Template
          </Typography.Title>
          <Typography.Text type="secondary">Step-by-step document generation</Typography.Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => setMode('cards')}>
          Back to Options
        </Button>
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

      {step === 0 && (
        <div>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search templates..."
            value={templateSearchTerm}
            onChange={(e) => setTemplateSearchTerm(e.target.value)}
            style={{ marginBottom: 20, maxWidth: 360 }}
          />

          <Checkbox.Group
            value={selectedTemplateIds}
            onChange={(vals) => setSelectedTemplateIds(vals as string[])}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 16]}>
              {templates
                .filter(
                  (t) =>
                    t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                    t.description.toLowerCase().includes(templateSearchTerm.toLowerCase()),
                )
                .map((tmpl) => {
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
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
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
        </div>
      )}

      {step === 1 && (
        <div>
          <Card variant="outlined" title="Document Details Form">
            <Form layout="vertical">
              <Row gutter={16}>
                {selectedTemplates
                  .flatMap((t) => parseVariables(t.variables))
                  .filter(
                    (v, idx, self) =>
                      v.show_in_form && self.findIndex((sv) => sv.key === v.key) === idx,
                  )
                  .map((v) => (
                    <Col xs={24} sm={v.type === 'textarea' ? 24 : 12} key={v.key}>
                      <Form.Item label={v.label} required={v.required}>
                        {v.type === 'textarea' ? (
                          <Input.TextArea
                            rows={3}
                            placeholder={v.placeholder}
                            value={unifiedFormValues[v.key] || ''}
                            onChange={(e) =>
                              setUnifiedFormValues((prev) => ({
                                ...prev,
                                [v.key]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <Input
                            placeholder={v.placeholder}
                            value={unifiedFormValues[v.key] || ''}
                            onChange={(e) =>
                              setUnifiedFormValues((prev) => ({
                                ...prev,
                                [v.key]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </Form.Item>
                    </Col>
                  ))}
              </Row>
            </Form>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {selectedTemplates.map((tmpl) => (
              <Card
                key={tmpl.id}
                title={tmpl.name}
                extra={
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => downloadSinglePdf(tmpl, unifiedFormValues, dynamicTableValues)}
                  >
                    Download Single PDF
                  </Button>
                }
              >
                <div
                  style={{
                    overflow: 'auto',
                    maxHeight: 500,
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
                      background: '#fff',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: buildLetterHtml(tmpl, unifiedFormValues, dynamicTableValues),
                    }}
                  />
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}

      <Divider />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < 2 ? (
          <Button
            type="primary"
            disabled={step === 0 && selectedTemplateIds.length === 0}
            onClick={() => setStep((s) => s + 1)}
          >
            Next
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={async () => {
              await autoSaveDocuments();
              if (onNavigateToDocuments) {
                onNavigateToDocuments();
              } else {
                setMode('cards');
              }
            }}
          >
            Finish &amp; Save
          </Button>
        )}
      </div>
    </div>
  );
};

export default Generate;
