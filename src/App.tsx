import React from 'react';
import TabNav from './components/TabNav';
import InputPage from './pages/InputPage';
import PdfPage from './pages/PdfPage';

type Tab = 'input' | 'pdf';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('input');

  return (
    <div className="min-h-dvh bg-gray-100">
      {/* メインコンテンツ */}
      <main>
        {activeTab === 'input' && <InputPage />}
        {activeTab === 'pdf' && <PdfPage />}
      </main>

      {/* タブナビゲーション */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
