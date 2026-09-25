import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Wake Lock管理カスタムフック
 *
 * - toggle() でON/OFFを切り替える
 * - visibilitychange で画面復帰時、ユーザーがONのままなら自動再取得する
 */
export function useWakeLock() {
  /** ユーザーが「ON」にしているかどうか */
  const [enabled, setEnabled] = useState(false);
  /** 実際にWake Lockが取得されているかどうか */
  const [active, setActive] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  /** Wake Lock を取得する内部関数 */
  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      setActive(true);

      sentinel.addEventListener('release', () => {
        // OSによる強制解放時にactiveをfalseに更新
        // （ref は visibilitychange ハンドラ側でnullにする）
        wakeLockRef.current = null;
        setActive(false);
      });
    } catch {
      // 取得失敗（タブ非表示中など）は無視
    }
  }, []);

  /** Wake Lock を解放する内部関数 */
  const release = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {
        // 解放失敗は無視
      }
      wakeLockRef.current = null;
      setActive(false);
    }
  }, []);

  /** ユーザー操作によるトグル */
  const toggle = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      alert('このブラウザは画面維持機能に対応していません。');
      return;
    }

    if (enabled) {
      // ONからOFF
      setEnabled(false);
      await release();
    } else {
      // OFFからON
      setEnabled(true);
      await acquire();
    }
  }, [enabled, acquire, release]);

  /** visibilitychange: 画面復帰時にONであれば再取得 */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && enabled) {
        // OSによる解放後、参照がnullになっているので再取得する
        await acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, acquire]);

  /** アンマウント時は解放 */
  useEffect(() => {
    return () => {
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { enabled, active, toggle };
}
