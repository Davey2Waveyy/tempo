'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';
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
type Member = {
  id: string;
  email: string;
  role: string;
  passkeys: number;
  codeExpiresAt: number | null;
};
export function AdminPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [now] = useState(() => Date.now());
  const [users, setUsers] = useState<Member[]>([]),
    [email, setEmail] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [issued, setIssued] = useState<{
      email: string;
      code: string;
      expiresAt: number;
    } | null>(null),
    [confirm, setConfirm] = useState<{
      member: Member;
      action: 'remove' | 'reissue';
    } | null>(null),
    [copied, setCopied] = useState<'invite' | 'code' | ''>('');
  function inviteMessage(invite: { email: string; code: string }) {
    const origin =
      typeof window === 'undefined'
        ? 'https://tempo.cillierd.workers.dev'
        : window.location.origin;
    return [
      "You're invited to Tempo — your own private time-tracking workspace.",
      '',
      `1. Open ${origin}`,
      '2. Click "First visit or lost your passkey? Use a setup code"',
      `3. Enter your email: ${invite.email}`,
      `4. Enter this setup code: ${invite.code}`,
      '5. Approve the passkey prompt (Face ID / Touch ID / fingerprint).',
      '',
      'The code is one-time and expires within 24 hours.',
    ].join('\n');
  }
  async function copy(kind: 'invite' | 'code') {
    if (!issued) return;
    const text = kind === 'code' ? issued.code : inviteMessage(issued);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
    } catch {
      setError('Clipboard is unavailable — select the code above and copy it.');
    }
  }
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = (await r.json()) as { users: Member[]; error?: string };
      if (!r.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members.');
    }
  }, []);
  useEffect(() => {
    if (open) void Promise.resolve().then(load);
  }, [open, load]);
  async function act(action: 'add' | 'remove' | 'reissue', member?: Member) {
    setBusy(true);
    setError('');
    setCopied('');
    setIssued(null);
    try {
      const r = await fetch(
        action === 'reissue' ? '/api/admin/users/reissue' : '/api/admin/users',
        {
          method: action === 'remove' ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            action === 'add' ? { email } : { id: member?.id },
          ),
        },
      );
      const data = (await r.json()) as {
        email: string;
        code: string;
        expiresAt: number;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error);
      if (data.code) setIssued(data);
      setEmail('');
      setConfirm(null);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not update this member.',
      );
    } finally {
      setBusy(false);
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
          <DialogTitle>Good work has good company.</DialogTitle>
          <DialogDescription>
            Invite people to their own private Tempo workspace. Member data
            stays private, including from the owner.
          </DialogDescription>
          <form
            className="admin-invite"
            onSubmit={(e) => {
              e.preventDefault();
              void act('add');
            }}
          >
            <label className="sr-only" htmlFor="invite-email">
              Member email
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              disabled={busy}
            />
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Invite
            </button>
          </form>
          {error && !confirm && (
            <p className="feedback error" role="alert">
              {error}
            </p>
          )}
          {issued && (
            <section className="setup-result">
              <strong>Invitation ready for {issued.email}</strong>
              <p>
                Copy the message below and send it to them however you like —
                text, chat, or your own email. It’s shown only now and expires
                in 24 hours.
              </p>
              <div className="setup-code">
                <code>{issued.code}</code>
              </div>
              <div className="setup-actions">
                <button
                  className="button primary"
                  onClick={() => copy('invite')}
                >
                  <Copy size={15} />
                  {copied === 'invite' ? 'Copied invite' : 'Copy invite message'}
                </button>
                <button className="button" onClick={() => copy('code')}>
                  {copied === 'code' ? 'Copied code' : 'Copy code only'}
                </button>
              </div>
              <small>Tempo doesn’t send emails — you share this yourself.</small>
            </section>
          )}
          <div className="member-list">
            {users.map((u) => (
              <div className="member-row" key={u.id}>
                <div>
                  <strong>{u.email}</strong>
                  <small>
                    {u.role === 'owner'
                      ? 'Owner'
                      : u.passkeys
                        ? 'Active · Passkey ready'
                        : u.codeExpiresAt && u.codeExpiresAt > now
                          ? 'Pending · Setup code issued'
                          : 'Pending · Needs a new code'}
                  </small>
                </div>
                {u.role === 'member' && (
                  <>
                    <button
                      className="icon-button"
                      aria-label={`Reissue setup code for ${u.email}`}
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ member: u, action: 'reissue' })
                      }
                    >
                      <RotateCcw size={17} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${u.email}`}
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ member: u, action: 'remove' })
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </>
                )}
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
          <AlertDialogTitle>
            {confirm?.action === 'remove'
              ? 'Remove this member?'
              : 'Reset this member’s access?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm?.action === 'remove'
              ? `This permanently removes ${confirm.member.email}, their passkeys, and their entire workspace.`
              : `This signs ${confirm?.member.email} out on every device and revokes all previous passkeys and setup codes. Their workspace is kept.`}
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
              onClick={() =>
                confirm && void act(confirm.action, confirm.member)
              }
            >
              {busy
                ? 'Working…'
                : confirm?.action === 'remove'
                  ? 'Remove member'
                  : 'Issue new code'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
