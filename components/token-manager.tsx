'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
type Token = {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
};
type Issued = { id: string; name: string; prefix: string; token: string };
function when(ts: number | null) {
  return ts ? new Date(ts).toLocaleDateString() : 'never';
}
export function TokenManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tokens, setTokens] = useState<Token[]>([]),
    [name, setName] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [issued, setIssued] = useState<Issued | null>(null),
    [confirm, setConfirm] = useState<Token | null>(null),
    [copied, setCopied] = useState(false);
  const origin =
    typeof window === 'undefined'
      ? 'https://tempo.cillierd.workers.dev'
      : window.location.origin;
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/tokens', { cache: 'no-store' });
      const data = (await r.json()) as { tokens: Token[]; error?: string };
      if (!r.ok) throw new Error(data.error);
      setTokens(data.tokens);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load agent tokens.');
    }
  }, []);
  useEffect(() => {
    if (open) void Promise.resolve().then(load);
  }, [open, load]);
  async function create() {
    setBusy(true);
    setError('');
    setCopied(false);
    setIssued(null);
    try {
      const r = await fetch('/api/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await r.json()) as Issued & { error?: string };
      if (!r.ok) throw new Error(data.error);
      setIssued(data);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the token.');
    } finally {
      setBusy(false);
    }
  }
  async function revoke(token: Token) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: token.id }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error);
      setConfirm(null);
      if (issued?.id === token.id) setIssued(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke the token.');
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      setError(
        'Clipboard is unavailable — select the token above and copy it.',
      );
    }
  }
  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setIssued(null);
            setError('');
            onClose();
          }
        }}
      >
        <DialogContent className="tempo-dialog admin-dialog">
          <DialogTitle>Agent access</DialogTitle>
          <DialogDescription>
            Create a token so a personal agent or script can sign in to your own
            workspace without a passkey. A token acts as you — only your data,
            never anyone else’s — and you can revoke it anytime.
          </DialogDescription>
          <form
            className="admin-invite"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label className="sr-only" htmlFor="token-name">
              Token name
            </label>
            <input
              id="token-name"
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Personal agent"
              disabled={busy}
            />
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Create
            </button>
          </form>
          {error && !confirm && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          {issued && (
            <section className="setup-result">
              <strong>Token ready — “{issued.name}”</strong>
              <p>
                Copy it now. It’s shown only once; if you lose it, revoke it and
                create another.
              </p>
              <div className="setup-code">
                <code>{issued.token}</code>
              </div>
              <div className="setup-actions">
                <button className="button primary" onClick={() => void copy()}>
                  <Copy size={15} />
                  {copied ? 'Copied token' : 'Copy token'}
                </button>
              </div>
              <small>
                Use it as a header:{' '}
                <code>Authorization: Bearer {issued.prefix}…</code> against{' '}
                <code>{origin}/api/workspace</code>.
              </small>
            </section>
          )}
          <div className="member-list">
            {tokens.length === 0 && !issued && (
              <p className="feedback">No agent tokens yet.</p>
            )}
            {tokens.map((t) => (
              <div className="member-row" key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <small>
                    <code>{t.prefix}…</code> · created {when(t.createdAt)} ·
                    last used {when(t.lastUsedAt)}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Revoke ${t.name}`}
                  disabled={busy}
                  onClick={() => setConfirm(t)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setConfirm(null);
            setError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Revoke this token?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm &&
              `Any agent using “${confirm.name}” will immediately lose access. This cannot be undone.`}
          </AlertDialogDescription>
          {error && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => confirm && void revoke(confirm)}
            >
              {busy ? 'Working…' : 'Revoke token'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
