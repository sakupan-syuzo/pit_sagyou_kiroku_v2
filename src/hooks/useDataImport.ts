import { useState } from 'react';
import { usePitStore } from '../store/usePitStore';
import { normalizeCarNo } from '../utils/carNoUtils';
import type { Entry } from '../types';

export function useDataImport() {
  const races = usePitStore(s => s.races);
  const updateRaceName = usePitStore(s => s.updateRaceName);
  const setRaceEntries = usePitStore(s => s.setRaceEntries);
  const records = usePitStore(s => s.records);
  const setRecords = usePitStore(s => s.setRecords);

  const [pendingImportData, setPendingImportData] = useState<any | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.type === 'pitrec-master') {
          handleMasterImport(data);
        } else if (data.type === 'pitrec-transfer' || (data.pitRecords && Array.isArray(data.pitRecords))) {
          // モーダルを表示してマッピングを選択させる
          setPendingImportData(data);
        } else {
          alert('無効なJSONデータです');
        }
      } catch (err) {
        alert('JSONの読み込みに失敗しました');
      }
      e.target.value = ''; // 連続で同じファイルを読めるようにリセット
    };
    reader.readAsText(file);
  };

  const handleMasterImport = (data: any) => {
    if (!data.races || !Array.isArray(data.races)) {
      alert('マスターデータにレース情報が含まれていません');
      return;
    }

    const raceNames = data.races
      .map((r: any) => `・${r.name}（${Object.keys(r.entries || {}).length}台）`)
      .join('\n');
    
    const msg = `以下のエントリーリストを読み込みます。\n\n${raceNames}\n\n同じ番号のレースは、エントリーとレース名の両方が上書きされます。\n作業記録は削除されません。\n\nよろしいですか？`;
    if (!window.confirm(msg)) return;

    let importedCount = 0;
    data.races.forEach((incRace: any) => {
      // JSONに含まれないレースは一切変更しないため、既存の races に存在するかチェック
      const targetRace = races.find(r => r.id === incRace.id);
      if (targetRace) {
        const normalizedIncEntries: Record<string, Entry> = {};
        if (incRace.entries) {
          Object.values(incRace.entries).forEach((entry: any) => {
            const cleanNo = normalizeCarNo(entry.carNo || entry.id);
            if (cleanNo) {
              normalizedIncEntries[cleanNo] = { ...entry, id: cleanNo, carNo: cleanNo };
            }
          });
        }
        // エントリーとレース名の両方を上書き（既存エントリーとのマージではなく、丸ごと上書きとするかは「マスターの配布」なので丸ごと上書きが良いが、既存動作は上書きかマージか。
        // タスク指示: setRaceEntries（エントリー）とupdateRaceName（レース名）の両方を実行。
        // ※「上書きされます」とあるので、既存マージではなくマスター通りに上書きする。
        setRaceEntries(incRace.id, normalizedIncEntries);
        if (incRace.name) {
          updateRaceName(incRace.id, incRace.name);
        }
        importedCount++;
      }
    });
    alert(`${importedCount} クラスのエントリーを読み込みました`);
  };

  const handleConfirmMapping = (mapping: Record<string, string>) => {
    if (!pendingImportData) return;
    const data = pendingImportData;
    
    const newRecords = [...records];
    let addedRecords = 0;

    // 1. レコードのマージ
    const importedRecords = data.pitRecords || [];
    for (const r of importedRecords) {
      const incRaceId = r.raceId || (data.races ? 'race1' : 'legacy');
      const targetRaceId = mapping[incRaceId];

      if (!targetRaceId || targetRaceId === 'skip') continue;

      if (!newRecords.some(existing => existing.id === r.id)) {
        newRecords.push({ ...r, raceId: targetRaceId });
        addedRecords++;
      }
    }

    // 2. エントリーとレース名のマージ
    if (data.races && Array.isArray(data.races)) {
      data.races.forEach((incRace: any) => {
        const targetRaceId = mapping[incRace.id];
        if (targetRaceId && targetRaceId !== 'skip') {
          if (incRace.entries) {
            const currentRace = races.find(r => r.id === targetRaceId);
            const currentEntries = currentRace ? currentRace.entries : {};
            
            const normalizedIncEntries: Record<string, Entry> = {};
            Object.values(incRace.entries).forEach((entry: any) => {
              const cleanNo = normalizeCarNo(entry.carNo || entry.id);
              if (cleanNo) {
                normalizedIncEntries[cleanNo] = { ...entry, id: cleanNo, carNo: cleanNo };
              }
            });
            // 引き継ぎの場合は既存データとマージする
            setRaceEntries(targetRaceId, { ...currentEntries, ...normalizedIncEntries });
          }
          if (incRace.name) {
            updateRaceName(targetRaceId, incRace.name);
          }
        }
      });
    } else if (data.entries) {
      const targetRaceId = mapping['legacy'];
      if (targetRaceId && targetRaceId !== 'skip') {
        const currentRace = races.find(r => r.id === targetRaceId);
        const currentEntries = currentRace ? currentRace.entries : {};
        
        const normalizedIncEntries: Record<string, Entry> = {};
        Object.values(data.entries).forEach((entry: any) => {
          const cleanNo = normalizeCarNo(entry.carNo || entry.id);
          if (cleanNo) {
            normalizedIncEntries[cleanNo] = { ...entry, id: cleanNo, carNo: cleanNo };
          }
        });
        setRaceEntries(targetRaceId, { ...currentEntries, ...normalizedIncEntries });
      }
    }

    if (addedRecords > 0) {
      setRecords(newRecords);
    }
    
    alert(`データの引き継ぎが完了しました。\n（レコード追加: ${addedRecords}件）`);
    setPendingImportData(null);
  };

  return {
    pendingImportData,
    setPendingImportData,
    handleFileChange,
    handleConfirmMapping,
  };
}
