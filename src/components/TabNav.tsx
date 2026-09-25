import React from 'react';
import { ClipboardList, FileText, Database } from 'lucide-react';

interface TabNavProps {
  activeTab: 'input' | 'pdf' | 'registration';
  onTabChange: (tab: 'input' | 'pdf' | 'registration') => void;
}

const TabNav: React.FC<TabNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50 safe-area-inset-bottom">
      <button
        onClick={() => onTabChange('input')}
        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-bold transition-colors ${
          activeTab === 'input'
            ? 'text-blue-600 border-t-2 border-blue-600'
            : 'text-gray-500 border-t-2 border-transparent'
        }`}
      >
        <ClipboardList size={20} />
        <span>入力</span>
      </button>
      <button
        onClick={() => onTabChange('pdf')}
        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-bold transition-colors ${
          activeTab === 'pdf'
            ? 'text-blue-600 border-t-2 border-blue-600'
            : 'text-gray-500 border-t-2 border-transparent'
        }`}
      >
        <FileText size={20} />
        <span>履歴・出力</span>
      </button>
      <button
        onClick={() => onTabChange('registration')}
        className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-bold transition-colors ${
          activeTab === 'registration'
            ? 'text-blue-600 border-t-2 border-blue-600'
            : 'text-gray-500 border-t-2 border-transparent'
        }`}
      >
        <Database size={20} />
        <span>登録</span>
      </button>
    </nav>
  );
};

export default TabNav;
