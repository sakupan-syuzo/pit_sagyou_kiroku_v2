import React from 'react';
import { usePitStore } from '../../store/usePitStore';
import { shareJsonFile } from '../../utils/shareUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const MasterExportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const races = usePitStore(s => s.races);
  const records = usePitStore(s => s.records);
  const sessionName = usePitStore(s => s.sessionName);
  const inspector = usePitStore(s => s.inspector);
  
  const validRacesInitial = races.filter(r => Object.keys(r.entries).length > 0).map(r => r.id);
  
  const [selectedRaceIds, setSelectedRaceIds] = React.useState<string[]>(validRacesInitial);
  const [exportType, setExportType] = React.useState<'master' | 'transfer'>('master');
  
  React.useEffect(() => {
    if (isOpen) {
      setSelectedRaceIds(races.filter(r => Object.keys(r.entries).length > 0).map(r => r.id));
      setExportType('master');
    }
  }, [isOpen, races]);

  if (!isOpen) return null;

  const handleToggleRace = (id: string) => {
    setSelectedRaceIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleExport = async () => {
    if (selectedRaceIds.length === 0) return;
    
    const exportRaces = races.filter(r => selectedRaceIds.includes(r.id));
    const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
    
    if (exportType === 'master') {
      const data = {
        type: 'pitrec-master',
        version: 1,
        exportedAt: new Date().toISOString(),
        races: exportRaces,
      };
      const fileName = `pitrec_master_${dateStr}.json`;
      await shareJsonFile(data, fileName, 'PitRec マスターデータ');
    } else {
      const exportRecords = records.filter(r => {
        const rId = r.raceId || 'race1';
        return selectedRaceIds.includes(rId);
      });
      const data = {
        type: 'pitrec-transfer',
        version: 1,
        exportedAt: new Date().toISOString(),
        races: exportRaces,
        pitRecords: exportRecords,
        sessionName,
        inspector,
      };
      const fileName = `pitrec_transfer_${sessionName || 'data'}_${dateStr}.json`;
      await shareJsonFile(data, fileName, 'PitRec 引き継ぎデータ');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">データを書き出す</h2>
          <button onClick={onClose} className="text-gray-500 font-bold p-1 text-xl leading-none">×</button>
        </div>
        
        <div className="p-4 overflow-y-auto space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">対象レース</label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {races.map(race => {
                const entryCount = Object.keys(race.entries).length;
                const recordCount = records.filter(r => (r.raceId || 'race1') === race.id).length;
                const text = entryCount > 0 ? `(${entryCount}台 / 記録 ${recordCount}件)` : '(未登録)';
                
                return (
                  <label key={race.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer min-h-[48px]">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={selectedRaceIds.includes(race.id)}
                      onChange={() => handleToggleRace(race.id)}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">{race.name}</span>
                      <span className="text-xs text-gray-500">{text}</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">含める内容</label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer min-h-[48px]">
                <input
                  type="radio"
                  name="exportType"
                  value="master"
                  checked={exportType === 'master'}
                  onChange={() => setExportType('master')}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="text-sm font-bold text-gray-800">エントリーのみ<br/><span className="text-xs font-normal text-gray-500">（マスター配布用）</span></span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer min-h-[48px]">
                <input
                  type="radio"
                  name="exportType"
                  value="transfer"
                  checked={exportType === 'transfer'}
                  onChange={() => setExportType('transfer')}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="text-sm font-bold text-gray-800">エントリー＋作業記録<br/><span className="text-xs font-normal text-gray-500">（引き継ぎ用）</span></span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 min-h-[48px] font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleExport}
            disabled={selectedRaceIds.length === 0}
            className="flex-1 min-h-[48px] font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm"
          >
            書き出す
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterExportModal;
