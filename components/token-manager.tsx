'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
export function TokenManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false);
  const origin =
    typeof window === 'undefined'
      ? 'https://tempo.cillierd.workers.dev'
      : window.location.origin;
  const load = useCallback(async () => {
    setError('');
    setCopied(false);
    try {
      const r = await fetch('/api/tokens', { cache: 'no-store' });
      const data = (await r.json()) as { token: string; error?: string };
      if (!r.ok) throw new Error(data.error);
      setToken(data.token);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not load your agent key.',
      );
    }
  }, []);
  useEffect(() => {
    if (open) void Promise.resolve().then(load);
  }, [open, load]);
  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setError('Clipboard is unavailable — select the key above and copy it.');
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setCopied(false);
          setError('');
          onClose();
        }
      }}
    >
      <DialogContent className="tempo-dialog admin-dialog">
        <DialogTitle>Agent access</DialogTitle>
        <DialogDescription>
          Give this key to a personal agent or script so it can sign in to your
          workspace without a passkey. It acts as you — only your data — so keep
          it private, like a password.
        </DialogDescription>
        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}
        {token && (
          <section className="setup-result">
            <strong>Your agent key</strong>
            <div className="setup-code">
              <code>{token}</code>
            </div>
            <div className="setup-actions">
              <button className="button primary" onClick={() => void copy()}>
                <Copy size={15} />
                {copied ? 'Copied key' : 'Copy key'}
              </button>
            </div>
            <small>
              Send it as a header:{' '}
              <code>Authorization: Bearer &lt;key&gt;</code> against{' '}
              <code>{origin}/api/workspace</code>. To revoke it, ask the owner
              to reset your access.
            </small>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
