import React from 'react';
import { ChevronRight } from 'lucide-react';
import { usePitStore } from '../store/usePitStore';
import type { PitRecord } from '../types';
import { calcDuration } from '../pdf/pdfUtils';

interface HistoryListProps {
  onEditRecord: (record: PitRecord) => void;
}

const formatBool = (v: boolean) => (v ? 'あり' : 'なし');

const HistoryList: React.FC<HistoryListProps> = ({ onEditRecord }) => {
  const records = usePitStore((s) => s.records);

  // createdAt の降順（新しい順）
  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);

  if (sorted.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-8">
        作業記録はまだありません
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((record) => (
        <button
          key={record.id}
          onClick={() => onEditRecord(record)}
          className={`w-full bg-white rounded-xl border p-3 text-left shadow-sm hover:shadow-md active:bg-gray-50 transition-all ${
            !record.carNo ? 'border-2 border-red-400' : 'border border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* 上段: PIT No. / Car No. */}
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-600 text-white text-xs font-bold rounded px-2 py-0.5">
                  PIT {record.pitNo}
                </span>
                <span className="bg-gray-800 text-white text-xs font-bold rounded px-2 py-0.5">
                  Car {record.carNo}
                </span>
                {!record.pitOutTime && (
                  <span className="bg-amber-100 text-amber-700 text-xs rounded px-2 py-0.5 font-bold">
                    引き継ぎ
                  </span>
                )}
              </div>

              {/* 時刻 */}
              <div className="text-xs text-gray-500 font-mono mb-1.5 flex items-center">
                <span>IN: <span className="text-gray-800 font-bold">{record.pitInTime}</span></span>
                {record.pitOutTime ? (
                  <>
                    <span className="ml-3">OUT: <span className="text-gray-800 font-bold">{record.pitOutTime}</span></span>
                    <span className="ml-3 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      滞在: {calcDuration(record.pitInTime, record.pitOutTime)}
                    </span>
                  </>
                ) : (
                  <span className="ml-3 text-amber-600">OUT: —</span>
                )}
              </div>

              {/* ドライバー */}
              <div className="text-xs text-gray-600 mb-1">
                <span className="font-bold">IN:</span> {record.pitInDriver}
                <span className="ml-2">
                  → <span className="font-bold">OUT:</span>{' '}
                  {record.isDriverChanged ? record.pitOutDriver : record.pitInDriver}
                </span>
              </div>

              {/* サマリー行 */}
              <div className="flex flex-wrap gap-1 text-xs">
                <span className={`rounded px-1.5 py-0.5 ${record.refuel ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-gray-100 text-gray-500'}`}>
                  給油: {formatBool(record.refuel)}
                </span>
                <span className={`rounded px-1.5 py-0.5 ${record.tires > 0 ? 'bg-blue-100 text-blue-700 font-bold' : 'bg-gray-100 text-gray-500'}`}>
                  タイヤ: {record.tires}本
                </span>
                {record.isDriverChanged && (
                  <span className="bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 font-bold">
                    交代あり
                  </span>
                )}
                {record.other && (
                  <span className="bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                    {record.other}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 mt-1 shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
};

export default HistoryList;
