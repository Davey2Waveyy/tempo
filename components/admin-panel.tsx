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
    [copied, setCopied] = useState(false);
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
    setCopied(false);
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
                Share this code privately. It is shown only now and expires in
                24 hours.
              </p>
              <div>
                <code>{issued.code}</code>
                <button
                  className="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(issued.code);
                      setCopied(true);
                    } catch {
                      setError(
                        'Select and copy the code above. Clipboard access is unavailable.',
                      );
                    }
                  }}
                >
                  <Copy size={15} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <small>No email has been sent.</small>
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
