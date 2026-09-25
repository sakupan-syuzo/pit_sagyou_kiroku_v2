import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { usePitStore } from '../store/usePitStore';
import type { PitRecord } from '../types';
import DriverSelector from './DriverSelector';


interface EditModalProps {
  record: PitRecord | null;
  onClose: () => void;
}

interface ToggleSwitchProps {
  value: boolean;
  onChange: (v: boolean) => void;
  labelOff?: string;
  labelOn?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  value,
  onChange,
  labelOff = 'なし',
  labelOn = 'あり',
}) => (
  <div className="flex items-center gap-2">
    <span className={`text-sm font-bold ${!value ? 'text-gray-800' : 'text-gray-400'}`}>
      {labelOff}
    </span>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        value ? 'bg-blue-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
    <span className={`text-sm font-bold ${value ? 'text-blue-600' : 'text-gray-400'}`}>
      {labelOn}
    </span>
  </div>
);

// ---- ユーティリティ ----

/**
 * epoch ms → datetime-local 入力値 ("YYYY-MM-DDTHH:mm:ss") に変換。
 * epoch が 0 または null の場合は空文字を返す。
 */
const epochToDatetimeLocal = (epoch: number | null | undefined): string => {
  if (!epoch) return '';
  const d = new Date(epoch);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};

/**
 * datetime-local 入力値 → epoch ms に変換。
 * 空文字の場合は null を返す。
 */
const datetimeLocalToEpoch = (value: string): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return isNaN(ms) ? null : ms;
};

/**
 * epoch ms → "HH:mm:ss" 表示用文字列に変換。
 * epoch が 0 または null の場合は空文字を返す。
 */
const epochToTimeString = (epoch: number | null | undefined): string => {
  if (!epoch) return '';
  const d = new Date(epoch);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
};

// ---- コンポーネント ----

const EditModal: React.FC<EditModalProps> = ({ record, onClose }) => {
  const updateRecord = usePitStore((s) => s.updateRecord);
  const deleteRecord = usePitStore((s) => s.deleteRecord);

  const entries = usePitStore((s) => s.entries);
  const [form, setForm] = React.useState<PitRecord | null>(null);

  /**
   * datetime-local 入力用の中間ステート。
   * form.pitInAt / pitOutAt が更新されるたびに連動して更新される。
   */
  const [pitInDatetime, setPitInDatetime] = React.useState('');
  const [pitOutDatetime, setPitOutDatetime] = React.useState('');

  const entry = form?.carNo ? entries[form.carNo] : undefined;
  const driverLabels = entry?.drivers;

  React.useEffect(() => {
    if (record) {
      setForm({ ...record });
      setPitInDatetime(epochToDatetimeLocal(record.pitInAt));
      setPitOutDatetime(epochToDatetimeLocal(record.pitOutAt));
    }
  }, [record]);

  if (!record || !form) return null;

  const patch = (fields: Partial<PitRecord>) => {
    setForm((prev) => prev ? { ...prev, ...fields } : prev);
  };

  /**
   * PIT IN 日時変更ハンドラ。
   * pitInAt (epoch) と pitInTime (表示用文字列) を同期更新する。
   */
  const handlePitInDatetimeChange = (value: string) => {
    setPitInDatetime(value);
    const epoch = datetimeLocalToEpoch(value);
    patch({
      pitInAt: epoch ?? 0,
      pitInTime: epoch ? epochToTimeString(epoch) : '',
    });
  };

  /**
   * PIT OUT 日時変更ハンドラ。
   * pitOutAt (epoch) と pitOutTime (表示用文字列) を同期更新する。
   */
  const handlePitOutDatetimeChange = (value: string) => {
    setPitOutDatetime(value);
    const epoch = datetimeLocalToEpoch(value);
    patch({
      pitOutAt: epoch,
      pitOutTime: epoch ? epochToTimeString(epoch) : '',
    });
  };

  /** PIT OUT 日時を空欄（引き継ぎ扱い）にする */
  const clearPitOut = () => {
    setPitOutDatetime('');
    patch({ pitOutAt: null, pitOutTime: '' });
  };

  const handleSave = () => {
    updateRecord(form.id, form);
    onClose();
  };

  const handleDelete = () => {
    if (!window.confirm('このレコードを削除しますか？')) return;
    deleteRecord(form.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92dvh] overflow-y-auto shadow-2xl">
        {/* ヘッダー */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-base font-bold text-gray-800">作業記録を修正</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* PIT No. / Car No. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">PIT No.</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.pitNo}
                onChange={(e) => patch({ pitNo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Car No.</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.carNo}
                onChange={(e) => patch({ carNo: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* PIT IN 日時（datetime-local で日跨ぎ対応） */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              PIT IN 日時
              <span className="text-gray-400 font-normal ml-1">（24hレース等の日跨ぎに対応）</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              value={pitInDatetime}
              onChange={(e) => handlePitInDatetimeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* PIT OUT 日時（datetime-local で日跨ぎ対応） */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              PIT OUT 日時
              <span className="text-gray-400 font-normal ml-1">（引き継ぎ時は空欄）</span>
            </label>
            <input
              type="datetime-local"
              step="1"
              value={pitOutDatetime}
              onChange={(e) => handlePitOutDatetimeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            {pitOutDatetime && (
              <button
                type="button"
                onClick={clearPitOut}
                className="text-xs text-gray-400 mt-1 underline"
              >
                OUT日時を空欄にする（引き継ぎ扱い）
              </button>
            )}
          </div>

          {/* PIT INドライバー */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">PIT INドライバー</label>
            <DriverSelector
              value={form.pitInDriver}
              onChange={(v) => patch({ pitInDriver: v })}
              placeholder="ドライバー名を入力"
              driverLabels={driverLabels}
            />
          </div>

          {/* ドライバー交代 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">ドライバー交代</label>
            <ToggleSwitch
              value={form.isDriverChanged}
              onChange={(v) => patch({ isDriverChanged: v })}
            />
            {form.isDriverChanged && (
              <div className="mt-2">
                <label className="block text-xs font-bold text-gray-600 mb-1.5">PIT OUTドライバー</label>
                <DriverSelector
                  value={form.pitOutDriver}
                  onChange={(v) => patch({ pitOutDriver: v })}
                  placeholder="交代後ドライバー名"
                  excludeLabels={[form.pitInDriver]}
                  driverLabels={driverLabels}
                />
              </div>
            )}
          </div>

          {/* 給油 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">給油</label>
            <ToggleSwitch
              value={form.refuel}
              onChange={(v) => patch({ refuel: v })}
            />
          </div>

          {/* タイヤ交換 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">タイヤ交換</label>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => patch({ tires: n })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${
                    form.tires === n
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {n}本
                </button>
              ))}
            </div>
          </div>

          {/* その他 */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">その他作業</label>
            <input
              type="text"
              value={form.other}
              onChange={(e) => patch({ other: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* フッターボタン — 2行レイアウトでスマホでも全ボタン表示 */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 pt-3 pb-4 space-y-2">
          {/* 1行目: キャンセル / 保存 */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              保存
            </button>
          </div>
          {/* 2行目: 削除（全幅・目立つが控えめな赤） */}
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            <Trash2 size={15} />
            このレコードを削除
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
