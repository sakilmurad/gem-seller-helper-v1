import { useEffect, useState } from 'react';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import Generate from './components/Generate';
import Documents from './components/Documents';
import Settings from './components/Settings';
import Templates from './components/Templates';
import { useCache } from './hooks/useCache';
import { getEffectiveDefaultSignatoryIndex, serverCall, type CompanySettings } from './lib/types';

const { Content } = Layout;

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
};

const fetchSettings = async (): Promise<CompanySettings> => {
  try {
    const d = await serverCall<Record<string, unknown>>('getCompanySettings');
    return {
      ...BLANK_SETTINGS,
      ...d,
      signatories: Array.isArray(d.signatories) ? (d.signatories as CompanySettings['signatories']) : [],
    };
  } catch {
    return BLANK_SETTINGS;
  }
};

function App() {
  const [selectedKey, setSelectedKey] = useState('generate');
  const [selectedSignatoryIdx, setSelectedSignatoryIdx] = useState<number | null>(null);

  const { data: settings } = useCache<CompanySettings>(
    'companySettings',
    'main',
    BLANK_SETTINGS,
    fetchSettings,
  );

  // Sync active signatory index to default signatory setting on settings load
  useEffect(() => {
    if (settings && settings.signatories && settings.signatories.length > 0 && selectedSignatoryIdx === null) {
      const defIdx = getEffectiveDefaultSignatoryIndex(settings);
      setSelectedSignatoryIdx(defIdx);
    }
  }, [settings, selectedSignatoryIdx]);

  const activeSignatoryIdx = selectedSignatoryIdx !== null
    ? (selectedSignatoryIdx < settings.signatories.length ? selectedSignatoryIdx : 0)
    : getEffectiveDefaultSignatoryIndex(settings);

  const views = {
    generate: (
      <Generate
        onNavigateToDocuments={() => setSelectedKey('documents')}
        externalSignatoryIdx={activeSignatoryIdx}
        onSelectSignatoryIdx={setSelectedSignatoryIdx}
      />
    ),
    documents: (
      <Documents
        externalSignatoryIdx={activeSignatoryIdx}
        onSelectSignatoryIdx={setSelectedSignatoryIdx}
      />
    ),
    templates: <Templates />,
    settings: <Settings />,
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Sidebar
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        settings={settings}
        selectedSignatoryIdx={activeSignatoryIdx}
        onSelectSignatoryIdx={setSelectedSignatoryIdx}
      />
      <Content style={{ background: '#fff' }}>
        {views[selectedKey as keyof typeof views]}
      </Content>
    </Layout>
  );
}

export default App;
