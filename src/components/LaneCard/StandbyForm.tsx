import React from 'react';
import type { LaneDraft } from '../../types';
import { usePitStore } from '../../store/usePitStore';
import DriverSelector from '../DriverSelector';
import { normalizeCarNo } from '../../utils/carNoUtils';

interface StandbyFormProps {
  draft: LaneDraft;
  onDraftChange: (patch: Partial<LaneDraft>) => void;
  onPitIn: () => void;
}

const StandbyForm: React.FC<StandbyFormProps> = ({ draft, onDraftChange, onPitIn }) => {
  const pitInButtonPosition = usePitStore((s) => s.pitInButtonPosition) || 'right';
  const entries = usePitStore((s) => s.entries);

  /**
   * draft.carNo を正規化してエントリーリストから検索する。
   * マスター側キーも正規化済みのため、全角/半角・ゼロ埋め・#記号の揺れを吸収する。
   */
  const normalizedCarNo = normalizeCarNo(draft.carNo || '');
  const entry = normalizedCarNo ? entries[normalizedCarNo] : undefined;
  const driverLabels = entry?.drivers;

  return (
    <div
      className={`flex items-center gap-2 ${
        pitInButtonPosition === 'left' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* PIT IN ボタン */}
      <button
        onClick={onPitIn}
        className="shrink-0 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black py-2 px-3 rounded-xl text-base transition-colors shadow-md"
      >
        🏎️ IN
      </button>

      {/* 入力フィールド群 */}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
        {/* PIT No. */}
        <input
          type="text"
          inputMode="numeric"
          value={draft.pitNo || ''}
          onChange={(e) => onDraftChange({ pitNo: e.target.value })}
          placeholder="PIT#"
          className="w-12 shrink-0 border border-gray-300 rounded-lg px-1 py-1.5 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs placeholder:font-normal"
        />
        {/* Car No. */}
        <input
          type="text"
          inputMode="numeric"
          value={draft.carNo || ''}
          onChange={(e) => onDraftChange({ carNo: e.target.value })}
          placeholder="Car#"
          className="w-12 shrink-0 border border-gray-300 rounded-lg px-1 py-1.5 text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-xs placeholder:font-normal"
        />
        {/* INドライバー: DriverSelector */}
        <div className="flex-1 min-w-0">
          <DriverSelector
            value={draft.pitInDriver || ''}
            onChange={(v) => onDraftChange({ pitInDriver: v })}
            placeholder="Drv"
            driverLabels={driverLabels}
          />
        </div>
      </div>
    </div>
  );
};

export default StandbyForm;
