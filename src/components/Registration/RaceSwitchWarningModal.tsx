import React from 'react';

interface Props {
  isOpen: boolean;
  recordCount: number;
  onCancel: () => void;
  onClearAndSwitch: () => void;
  onKeepAndSwitch: () => void;
  onNavigateToOutput?: () => void;
}

const RaceSwitchWarningModal: React.FC<Props> = ({
  isOpen,
  recordCount,
  onCancel,
  onClearAndSwitch,
  onKeepAndSwitch,
  onNavigateToOutput
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">前のセッションの記録が残っています</h2>
        </div>
        <div className="p-4 space-y-3 text-sm text-gray-600">
          <p className="font-bold text-red-600">作業記録が {recordCount} 件残っています。</p>
          <p>PDFやCSVでの出力は済んでいますか？</p>
          <p>記録を残したままレースを切り替えると、別セッションの記録が混ざります。</p>
        </div>
        <div className="p-4 bg-gray-50 flex flex-col gap-3">
          <button
            onClick={onNavigateToOutput}
            className="w-full h-[48px] px-4 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-colors shadow-sm"
          >
            出力タブへ移動
          </button>
          <button
            onClick={onClearAndSwitch}
            className="w-full h-[48px] px-4 font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center justify-center transition-colors"
          >
            記録を消して切り替える
          </button>
          <button
            onClick={onKeepAndSwitch}
            className="w-full h-[48px] px-4 font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center transition-colors"
          >
            このまま切り替える
          </button>
        </div>
      </div>
    </div>
  );
};

export default RaceSwitchWarningModal;
