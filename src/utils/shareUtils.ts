export async function shareJsonFile(
  data: unknown,
  fileName: string,
  title: string
): Promise<void> {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const file = new File([blob], fileName, { type: 'application/json' });

  // 1. Web Share API（ファイル共有対応）
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // キャンセル
      console.warn('File share failed, trying text share:', err);
    }
  }

  // 2. テキスト共有（ファイル共有不可の場合）
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: jsonStr,
      });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      console.warn('Text share failed:', err);
    }
  }

  // 3. ダウンロード（PC等）
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  } catch (err) {
    console.warn('Download failed:', err);
  }

  // 4. 最終フォールバック：クリップボードにコピー
  try {
    await navigator.clipboard.writeText(jsonStr);
    alert('データをクリップボードにコピーしました。\nLINEやメモアプリに貼り付けて送ってください。');
  } catch {
    alert('共有に失敗しました。端末または設定を確認してください。');
  }
}
