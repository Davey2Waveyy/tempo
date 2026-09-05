'use client';
import { useState } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { KeyRound, ArrowRight } from 'lucide-react';
export type CurrentUser = {
  id: string;
  email: string;
  role: 'owner' | 'member';
};
async function post(path: string, value: unknown) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  });
  const data = (await r.json()) as Record<string, unknown>;
  if (!r.ok)
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Could not complete sign-in.',
    );
  return data;
}
export function AuthScreen({
  onUnlock,
}: {
  onUnlock: (user: CurrentUser) => void;
}) {
  const [mode, setMode] = useState<'login' | 'setup'>('login'),
    [email, setEmail] = useState(''),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <main className="pin-gate">
      <form
        className="pin-card auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            if (!browserSupportsWebAuthn())
              throw new Error(
                'Passkeys are not supported here. Open Tempo in a recent Chrome, Safari, Edge, or Firefox browser.',
              );
            const path = mode === 'setup' ? 'register' : 'login';
            const options = await post(`/api/auth/${path}/options`, {
              email,
              code,
            });
            const response =
              mode === 'setup'
                ? await startRegistration({
                    optionsJSON: options as unknown as Parameters<
                      typeof startRegistration
                    >[0]['optionsJSON'],
                  })
                : await startAuthentication({
                    optionsJSON: options as unknown as Parameters<
                      typeof startAuthentication
                    >[0]['optionsJSON'],
                  });
            const result = await post(`/api/auth/${path}/verify`, response);
            setCode('');
            onUnlock(result.user as CurrentUser);
          } catch (e) {
            setError(
              e instanceof Error && e.name === 'NotAllowedError'
                ? 'Passkey request cancelled or timed out. Try again when you’re ready.'
                : e instanceof Error
                  ? e.message
                  : 'Could not sign in. Please try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <span className="brand">tempo</span>
        <span className="auth-key">
          <KeyRound size={25} />
        </span>
        <h1>
          {mode === 'login'
            ? 'Your time. Your space.'
            : 'A fresh way to sign in.'}
        </h1>
        <p className="form-note">
          {mode === 'login'
            ? 'Sign in with your passkey to open your private workspace.'
            : 'Enter your email and the setup code from your invitation. Then create a passkey on your device.'}
        </p>
        <label className="auth-label" htmlFor="auth-email">
          Email address
        </label>
        <input
          id="auth-email"
          className="pin-input"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          disabled={busy}
        />
        {mode === 'setup' && (
          <>
            <label className="auth-label" htmlFor="setup-code">
              Setup code
            </label>
            <input
              id="setup-code"
              className="pin-input code-input"
              type="text"
              required
              autoComplete="one-time-code"
              spellCheck={false}
              maxLength={128}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Your invitation code"
              disabled={busy}
            />
          </>
        )}
        {error && (
          <p className="pin-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy
            ? 'Waiting for your passkey…'
            : mode === 'login'
              ? 'Sign in with a passkey'
              : 'Create my passkey'}
          <ArrowRight size={16} />
        </button>
        <button
          type="button"
          className="auth-switch"
          disabled={busy}
          onClick={() => {
            setMode(mode === 'login' ? 'setup' : 'login');
            setError('');
            setCode('');
          }}
        >
          {mode === 'login'
            ? 'First visit or lost your passkey? Use a setup code.'
            : 'Already have a passkey? Sign in.'}
        </button>
        <small className="auth-footnote">
          Invite-only. Your workspace is visible only to you.
        </small>
      </form>
    </main>
  );
}
