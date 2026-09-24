import React from 'react';
import { PenLine } from 'lucide-react';

const DEFAULT_DRIVER_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

interface DriverSelectorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** 選択不可にするラベル（例: PIT INで選んだ "A" を除外） */
  excludeLabels?: string[];
  driverLabels?: string[];
}

/**
 * ドライバー選択コンポーネント
 * - デフォルト: [A][B][C][D] のボタングループで素早く選択
 * - [入力] トグルON: テキスト入力フォームに切り替え
 */
const DriverSelector: React.FC<DriverSelectorProps> = ({
  value,
  onChange,
  placeholder = 'ドライバー名',
  excludeLabels = [],
  driverLabels,
}) => {
  const labels = driverLabels && driverLabels.length > 0 ? driverLabels : (DEFAULT_DRIVER_LABELS as readonly string[]);

  // プリセットに含まれているか
  const isPreset = labels.includes(value);

  // マウント時: 値が空またはプリセット値であれば入力モードOFF
  const [inputMode, setInputMode] = React.useState<boolean>(
    value !== '' && !isPreset
  );

  const handlePreset = (label: string) => {
    onChange(label);
    setInputMode(false);
  };

  const handleToggleInput = () => {
    const next = !inputMode;
    setInputMode(next);
    if (!next) {
      // 入力モードOFF時、テキストがプリセットでなければクリア
      if (!isPreset) onChange('');
    }
  };

  return (
    <div className="space-y-1.5">
      {/* プリセットボタン行（A〜F + 入力トグル） */}
      <div className="flex gap-0.5 items-center flex-wrap">
        {labels.map((label) => {
          const isExcluded = excludeLabels.includes(label);
          const isSelected = value === label && !inputMode;
          return (
            <button
              key={label}
              type="button"
              disabled={isExcluded}
              onClick={() => !isExcluded && handlePreset(label)}
              title={isExcluded ? `${label}: PIT INで使用中` : undefined}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold border transition-colors leading-tight break-words min-w-[2.5rem] ${
                isExcluded
                  ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed line-through'
                  : isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              {label}
            </button>
          );
        })}

        {/* 入力モード切替ボタン（アイコンのみでコンパクトに） */}
        <button
          type="button"
          onClick={handleToggleInput}
          className={`flex items-center justify-center px-2 py-1.5 rounded-md border transition-colors shrink-0 ${
            inputMode
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
          }`}
          title="テキスト入力に切り替え"
        >
          <PenLine size={13} />
        </button>
      </div>

      {/* テキスト入力欄（入力モード時のみ表示） */}
      {inputMode && (
        <input
          type="text"
          value={isPreset ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      )}

      {/* 現在の値表示（プリセット外かつ非入力モード時） */}
      {!inputMode && value && !isPreset && (
        <div className="text-xs text-gray-500 px-1">
          選択中: <span className="font-bold text-gray-800">{value}</span>
        </div>
      )}
    </div>
  );
};

export default DriverSelector;
