import { useState } from 'react';
import styles from './Tabs.module.css';

export const Tabs = ({ tabs, defaultTab = null, onChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={styles.tabs}>
      <div className={styles.tabList} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={[
              styles.tab,
              activeTab === tab.id && styles.active,
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.icon && <tab.icon className={styles.tabIcon} />}
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.badge && (
              <span className={styles.tabBadge}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>{activeTabContent}</div>
    </div>
  );
};

export default Tabs;
