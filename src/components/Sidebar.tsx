import React from 'react';
import {
  BookOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Layout, Menu, Typography } from 'antd';

const { Sider } = Layout;

type SidebarProps = {
  selectedKey: string;
  onSelect: (key: string) => void;
};

const items: MenuProps['items'] = [
  { key: 'documents', icon: <FileTextOutlined />, label: 'Documents' },
  { key: 'templates', icon: <BookOutlined />, label: 'Templates' },
  { key: 'settings', icon: <SettingOutlined />, label: 'Settings' },
];

const Sidebar: React.FC<SidebarProps> = ({ selectedKey, onSelect }) => {
  return (
    <Sider width={220} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
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
    </Sider>
  );
};

export default Sidebar;