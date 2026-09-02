import { useState } from 'react';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import Documents from './components/Documents';
import Settings from './components/Settings';
import Templates from './components/Templates';

const { Content } = Layout;

function App() {
  const [selectedKey, setSelectedKey] = useState('documents');
  const views = {
    documents: <Documents />,
    templates: <Templates />,
    settings: <Settings />,
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Sidebar selectedKey={selectedKey} onSelect={setSelectedKey} />
      <Content style={{ background: '#fff' }}>
        {views[selectedKey as keyof typeof views]}
      </Content>
    </Layout>
  );
}

export default App;
