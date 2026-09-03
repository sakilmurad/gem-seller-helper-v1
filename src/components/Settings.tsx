import {
  CheckCircleOutlined,
  DeleteOutlined,
  LoadingOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Popconfirm,
  Row,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { useCallback, useState } from 'react';
import { useCache } from '../hooks/useCache';
import { getEffectiveDefaultSignatoryIndex, type CompanySettings, type Signatory } from '../lib/types';

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

declare global {
  interface Window {
    google?: { script?: { run: unknown } };
  }
}

const serverCall = <T,>(name: string, payload?: unknown) =>
  new Promise<T>((resolve, reject) => {
    const runner = window.google?.script?.run as
      | {
          withSuccessHandler: (fn: (value: T) => void) => {
            withFailureHandler: (
              fn: (error: Error) => void,
            ) => Record<string, (...args: unknown[]) => void>;
          };
        }
      | undefined;

    if (!runner) {
      reject(new Error('Google Apps Script is not available in local environment.'));
      return;
    }

    const chain = runner.withSuccessHandler(resolve).withFailureHandler(reject);
    chain[name](...(payload === undefined ? [] : [payload]));
  });

const fileToPayload = (file: File) =>
  new Promise<{ name: string; mimeType: string; data: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({
        name: file.name,
        mimeType: file.type,
        data: String(reader.result).split(',')[1] || '',
      });
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });

const fetchSettings = async (): Promise<CompanySettings> => {
  const data = await serverCall<Record<string, unknown>>('getCompanySettings');
  let signatories: Signatory[] = [];
  if (Array.isArray(data.signatories)) {
    signatories = data.signatories as Signatory[];
  } else if (typeof data.signatories === 'string') {
    try {
      signatories = JSON.parse(data.signatories);
    } catch {
      signatories = [];
    }
  }

  return {
    ...BLANK_SETTINGS,
    ...data,
    signatories,
  };
};

const A4_W = 210;
const A4_H = 297;
const pctX = (mm: number) => Math.min((mm / A4_W) * 100, 45);
const pctY = (mm: number) => Math.min((mm / A4_H) * 100, 45);

const Settings = () => {
  const {
    data: settings,
    loading,
    setData: setSettings,
  } = useCache<CompanySettings>('companySettings', 'main', BLANK_SETTINGS, fetchSettings);

  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const update = useCallback(
    (key: keyof CompanySettings, value: unknown) =>
      setSettings((cur) => ({ ...cur, [key]: value })),
    [setSettings],
  );

  const updateSignatory = useCallback(
    (index: number, key: keyof Signatory, value: string) =>
      setSettings((cur) => ({
        ...cur,
        signatories: cur.signatories.map((s, i) => (i === index ? { ...s, [key]: value } : s)),
      })),
    [setSettings],
  );

  const addSignatory = useCallback(
    () =>
      setSettings((cur) => ({
        ...cur,
        signatories: [...cur.signatories, { names: '', designations: '', sign_stamp_urls: '' }],
      })),
    [setSettings],
  );

  const removeSignatory = useCallback(
    (index: number) =>
      setSettings((cur) => ({
        ...cur,
        signatories: cur.signatories.filter((_, i) => i !== index),
      })),
    [setSettings],
  );

  const setDefaultSignatory = (index: number) => {
    setSettings((cur) => ({
      ...cur,
      defaultSignatoryIndex: index,
      signatories: cur.signatories.map((s, i) => ({
        ...s,
        isDefault: i === index,
      })),
    }));
    messageApi.success('Default signatory updated');
  };

  const handleDriveUpload = async (file: File, slot: string, onDone: (url: string) => void) => {
    try {
      setUploadingSlot(slot);
      const payload = await fileToPayload(file);
      const url = await serverCall<string>('uploadCompanyFile', payload);
      onDone(url);
      messageApi.success('File uploaded to Drive successfully!');
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : 'Drive upload failed');
    } finally {
      setUploadingSlot(null);
    }
    return false;
  };

  const save = useCallback(async () => {
    try {
      setSaving(true);
      await serverCall('saveCompanySettings', settings);
      messageApi.success('Settings saved successfully. Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }, [settings, messageApi]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
        <div style={{ marginTop: 12 }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>Company Settings</Typography.Title>
          <Typography.Text type="secondary">Manage your company information, letterhead, and signatories</Typography.Text>
        </div>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
          Save Settings
        </Button>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Company Info */}
        <Card title="Company Information" variant="outlined">
          <Form layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Company Name">
                  <Input
                    value={settings.companyName}
                    onChange={(e) => update('companyName', e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="PAN">
                  <Input value={settings.PAN} onChange={(e) => update('PAN', e.target.value)} />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="Company Address">
                  <Input.TextArea
                    rows={2}
                    value={settings.companyAddress}
                    onChange={(e) => update('companyAddress', e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="GST">
                  <Input value={settings.GST} onChange={(e) => update('GST', e.target.value)} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="MSME">
                  <Input value={settings.MSME} onChange={(e) => update('MSME', e.target.value)} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* AI & Gemini Configuration */}
        <Card title="Gemini AI Configuration" variant="outlined">
          <Form layout="vertical">
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item label="Gemini API Key (GEMINI_API_KEY)">
                  <Input.Password
                    placeholder="e.g. AIzaSy..."
                    value={settings.geminiApiKey || ''}
                    onChange={(e) => update('geminiApiKey', e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item label="Model ID (MODEL_ID)">
                  <Input
                    placeholder="e.g. gemini-2.5-flash"
                    value={settings.geminiModelId || 'gemini-2.5-flash'}
                    onChange={(e) => update('geminiModelId', e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Card>

        {/* Letterhead & Margins */}
        <Card title="Letterhead & Printable Margins" variant="outlined">
          <Row gutter={24} align="middle">
            <Col xs={24} md={12}>
              <Form layout="vertical">
                <Form.Item label="Upload Letterhead to Google Drive (JPG / PNG)">
                  <Upload
                    accept="image/png,image/jpeg"
                    showUploadList={false}
                    beforeUpload={(file) =>
                      handleDriveUpload(file, 'letterhead', (url) => update('letterheadUrl', url))
                    }
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingSlot === 'letterhead'}>
                      Upload to Drive
                    </Button>
                  </Upload>
                </Form.Item>
                <Divider style={{ margin: '12px 0' }} />
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  Adjust Margins (mm)
                </Typography.Text>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="Top (mm)">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={100}
                        value={settings.marginTop}
                        onChange={(val) => update('marginTop', val || 0)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Bottom (mm)">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={100}
                        value={settings.marginBottom}
                        onChange={(val) => update('marginBottom', val || 0)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Left (mm)">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={100}
                        value={settings.marginLeft}
                        onChange={(val) => update('marginLeft', val || 0)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Right (mm)">
                      <InputNumber
                        style={{ width: '100%' }}
                        min={0}
                        max={100}
                        value={settings.marginRight}
                        onChange={(val) => update('marginRight', val || 0)}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Col>
            <Col xs={24} md={12} style={{ textAlign: 'center' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 240,
                  aspectRatio: '210/297',
                  border: '1px solid #d9d9d9',
                  borderRadius: 6,
                  margin: '0 auto',
                  overflow: 'hidden',
                  background: '#f5f5f5',
                }}
              >
                {settings.letterheadUrl ? (
                  <img
                    src={settings.letterheadUrl}
                    alt="Letterhead Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ paddingTop: '40%', color: '#bfbfbf' }}>No Letterhead</div>
                )}
                {/* Visual Margin Overlay Lines */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${pctX(settings.marginLeft)}%`,
                    borderLeft: '1px dashed #ff4d4f',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    right: `${pctX(settings.marginRight)}%`,
                    borderRight: '1px dashed #ff4d4f',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: `${pctY(settings.marginTop)}%`,
                    borderTop: '1px dashed #1677ff',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: `${pctY(settings.marginBottom)}%`,
                    borderBottom: '1px dashed #1677ff',
                  }}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Signatories */}
        <Card
          title="Signatories"
          variant="outlined"
          extra={
            <Button type="dashed" icon={<PlusOutlined />} onClick={addSignatory}>
              Add Signatory
            </Button>
          }
        >
          <List
            dataSource={settings.signatories}
            locale={{ emptyText: 'No signatories added yet' }}
            renderItem={(sig, idx) => {
              const defaultIdx = getEffectiveDefaultSignatoryIndex(settings);
              const isDefault = idx === defaultIdx;
              return (
                <List.Item
                  actions={[
                    isDefault ? (
                      <Tag key="default" color="green" icon={<CheckCircleOutlined />}>
                        Default
                      </Tag>
                    ) : (
                      <Button
                        key="setDefault"
                        size="small"
                        type="link"
                        onClick={() => setDefaultSignatory(idx)}
                      >
                        Set as Default
                      </Button>
                    ),
                    <Popconfirm
                      key="delete"
                      title="Remove signatory?"
                      onConfirm={() => removeSignatory(idx)}
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]}
                >
                <Row gutter={16} align="middle" style={{ width: '100%' }}>
                  <Col xs={24} sm={4} style={{ textAlign: 'center' }}>
                    <Avatar
                      shape="square"
                      size={64}
                      src={sig.sign_stamp_urls || undefined}
                      icon={!sig.sign_stamp_urls && <UploadOutlined />}
                    />
                    <Upload
                      accept="image/png,image/jpeg"
                      showUploadList={false}
                      beforeUpload={(file) =>
                        handleDriveUpload(file, `stamp-${idx}`, (url) =>
                          updateSignatory(idx, 'sign_stamp_urls', url),
                        )
                      }
                    >
                      <Button
                        type="link"
                        size="small"
                        style={{ marginTop: 4 }}
                        loading={uploadingSlot === `stamp-${idx}`}
                      >
                        {sig.sign_stamp_urls ? 'Change' : 'Upload'}
                      </Button>
                    </Upload>
                  </Col>
                  <Col xs={24} sm={10}>
                    <Input
                      placeholder="Full Name"
                      value={sig.names}
                      onChange={(e) => updateSignatory(idx, 'names', e.target.value)}
                    />
                  </Col>
                  <Col xs={24} sm={10}>
                    <Input
                      placeholder="Designation"
                      value={sig.designations}
                      onChange={(e) => updateSignatory(idx, 'designations', e.target.value)}
                    />
                  </Col>
                </Row>
              </List.Item>
            );
          }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default Settings;