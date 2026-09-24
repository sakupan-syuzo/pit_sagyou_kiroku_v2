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
  const hasCustomLabels = driverLabels && driverLabels.length > 0;
  const count = hasCustomLabels ? driverLabels.length : DEFAULT_DRIVER_LABELS.length;

  const buttons = Array.from({ length: count }).map((_, i) => {
    const defaultLabel = DEFAULT_DRIVER_LABELS[i] || String.fromCharCode(65 + i);
    const customLabel = hasCustomLabels ? driverLabels[i] : null;
    const valueToUse = customLabel || defaultLabel;
    const displaySub = customLabel ? customLabel.slice(0, 5) : null;
    return { defaultLabel, displaySub, valueToUse };
  });

  // プリセットに含まれているか
  const isPreset = buttons.some((b) => b.valueToUse === value);

  // マウント時: 値が空またはプリセット値であれば入力モードOFF
  const [inputMode, setInputMode] = React.useState<boolean>(
    value !== '' && !isPreset
  );

  const handlePreset = (val: string) => {
    onChange(val);
    setInputMode(false);
  };

  const handleToggleInput = () => {
    const next = !inputMode;
    setInputMode(next);
    if (!next) {
      if (!isPreset) onChange('');
    }
  };

  return (
    <div className="space-y-1.5">
      {/* プリセットボタン行（A〜F + 入力トグル） */}
      <div className="flex gap-0.5 items-stretch flex-wrap">
        {buttons.map(({ defaultLabel, displaySub, valueToUse }) => {
          const isExcluded = excludeLabels.includes(valueToUse);
          const isSelected = value === valueToUse && !inputMode;
          return (
            <button
              key={valueToUse}
              type="button"
              disabled={isExcluded}
              onClick={() => !isExcluded && handlePreset(valueToUse)}
              title={isExcluded ? `${valueToUse}: PIT INで使用中` : valueToUse}
              className={`flex-1 flex flex-col items-center justify-center rounded-md border transition-colors leading-none min-w-[1.8rem] min-h-[38px] px-0.5 ${
                isExcluded
                  ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed line-through'
                  : isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 active:bg-gray-100'
              }`}
            >
              <span className={`font-black ${displaySub ? 'text-[11px]' : 'text-sm'}`}>
                {defaultLabel}
              </span>
              {displaySub && (
                <span className="text-[9px] font-bold mt-0.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5">
                  {displaySub}
                </span>
              )}
            </button>
          );
        })}

        {/* 入力モード切替ボタン */}
        <button
          type="button"
          onClick={handleToggleInput}
          className={`flex items-center justify-center px-2 min-h-[38px] rounded-md border transition-colors shrink-0 ${
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
