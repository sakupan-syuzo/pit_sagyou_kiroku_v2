import React from 'react';

interface Props {
  isOpen: boolean;
  total: number;
  fallbackCars: string[];
  multipleAppears: string[];
  missingDrivers: string[];
  onClose: () => void;
  onNavigateToManage: () => void;
}

const ImportResultModal: React.FC<Props> = ({
  isOpen,
  total,
  fallbackCars,
  multipleAppears,
  missingDrivers,
  onClose,
  onNavigateToManage,
}) => {
  if (!isOpen) return null;

  const hasWarnings = fallbackCars.length > 0 || multipleAppears.length > 0 || missingDrivers.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-gray-800">取り込み結果</h2>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
            ✅ {total}台を登録・更新しました
          </div>

          {hasWarnings && (
            <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1">
                ⚠️ 確認してください
              </h3>
              
              {fallbackCars.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">
                    ・左隣のセルから車番を補完：{fallbackCars.length}台
                  </p>
                  <p className="text-xs text-amber-800 pl-3 leading-relaxed">
                    {fallbackCars.join(' / ')}
                  </p>
                </div>
              )}

              {multipleAppears.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">
                    ・同じ車番が複数行にある：{multipleAppears.length}台
                  </p>
                  <p className="text-xs text-amber-800 pl-3 leading-relaxed">
                    {multipleAppears.join(', ')}
                  </p>
                </div>
              )}

              {missingDrivers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900">
                    ・ドライバー未登録：{missingDrivers.length}台
                  </p>
                  <p className="text-xs text-amber-800 pl-3 leading-relaxed">
                    {missingDrivers.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigateToManage();
            }}
            className="flex-1 min-h-[48px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            登録データを確認
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResultModal;
