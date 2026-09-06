'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem('tempo-install-dismissed') === '1';
    } catch {}
    if (standalone || dismissed) return;
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) {
      // iOS has no install prompt API; only Safari can Add to Home Screen.
      if (/safari/i.test(ua) && !/crios|fxios/i.test(ua)) {
        const id = requestAnimationFrame(() => {
          setIos(true);
          setShow(true);
        });
        return () => cancelAnimationFrame(id);
      }
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);
  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem('tempo-install-dismissed', '1');
    } catch {}
  }
  if (!show) return null;
  return (
    <div className="pwa-install" aria-label="Install Tempo">
      <div className="pwa-install-body">
        {/* oxlint-disable-next-line no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} />
        <div>
          <strong>Add Tempo to your home screen</strong>
          <span>
            {ios
              ? 'Tap the Share icon, then “Add to Home Screen” to use Tempo like an app.'
              : 'Install Tempo for quick, full-screen access.'}
          </span>
        </div>
      </div>
      <div className="pwa-install-actions">
        {!ios && prompt && (
          <button
            className="button primary"
            onClick={async () => {
              try {
                await prompt.prompt();
                await prompt.userChoice;
              } catch {}
              dismiss();
            }}
          >
            Install
          </button>
        )}
        <button
          className="pwa-install-close"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
