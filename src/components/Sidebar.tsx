import React from 'react';
import {
  BookOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Layout, Menu, Select, Typography } from 'antd';
import type { CompanySettings } from '../lib/types';

const { Sider } = Layout;

type SidebarProps = {
  selectedKey: string;
  onSelect: (key: string) => void;
  settings?: CompanySettings;
  selectedSignatoryIdx?: number;
  onSelectSignatoryIdx?: (idx: number) => void;
};

const items: MenuProps['items'] = [
  { key: 'documents', icon: <FileTextOutlined />, label: 'Documents' },
  { key: 'templates', icon: <BookOutlined />, label: 'Templates' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
];

const Sidebar: React.FC<SidebarProps> = ({
  selectedKey,
  onSelect,
  settings,
  selectedSignatoryIdx = 0,
  onSelectSignatoryIdx,
}) => {
  const signatories = settings?.signatories || [];

  return (
    <Sider
      width={220}
      theme="light"
      style={{
        borderRight: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px' }}>
          <Typography.Title level={4} style={{ margin: 0, color: '#1677ff' }}>
            Edafter
          </Typography.Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => onSelect(key)}
          items={items}
          style={{ borderRight: 0 }}
        />
      </div>

      {/* Footer: Company & Active Signatory Selector */}
      <div style={{ padding: '16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
        {settings?.companyName && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Company Profile
            </Typography.Text>
            <Typography.Text strong ellipsis style={{ fontSize: 13, display: 'block', color: '#111827' }}>
              {settings.companyName}
            </Typography.Text>
          </div>
        )}

        <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Active Signatory
        </Typography.Text>
        <Select
          style={{ width: '100%' }}
          size="small"
          prefix={<UserOutlined style={{ color: '#8c8c8c' }} />}
          value={selectedSignatoryIdx}
          onChange={(val) => onSelectSignatoryIdx?.(val)}
          options={
            signatories.length > 0
              ? signatories.map((s, i) => ({
                  value: i,
                  label: s.names ? `${s.names}` : `Signatory #${i + 1}`,
                }))
              : [{ value: 0, label: 'Default Signatory' }]
          }
        />
      </div>
    </Sider>
  );
};

export default Sidebar;