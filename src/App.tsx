import React from 'react';
import TabNav from './components/TabNav';
import InputPage from './pages/InputPage';
import PdfPage from './pages/PdfPage';
import RegistrationPage from './pages/RegistrationPage';

type Tab = 'input' | 'pdf' | 'registration';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<Tab>('input');

  return (
    <div className="min-h-dvh bg-gray-100">
      {/* メインコンテンツ — TabNav(約56px)の分だけ下に余白 */}
      <main className="h-dvh pb-14">
        {activeTab === 'input' && <InputPage />}
        {activeTab === 'pdf' && <PdfPage />}
        {activeTab === 'registration' && <RegistrationPage />}
      </main>

      {/* タブナビゲーション */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
