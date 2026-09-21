import { useState } from 'react';
import { supabase } from './supabaseClient';
import { Dumbbell } from 'lucide-react';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const { data, error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
    } else if (isSignUp && !data.session) {
      setNotice('Check your inbox to confirm your email address.');
    }
    setLoading(false);
  };

  return (
    <div className="grid min-h-screen place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-grid h-14 w-14 place-items-center rounded-2xl bg-volt-300 text-ink-950">
            <Dumbbell size={26} />
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Ironlog</h1>
          <p className="mt-1 text-sm text-fog-400">
            {isSignUp ? 'Create an account to start training' : 'Sign in to your training log'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-3 px-5 py-5">
          {error && (
            <p className="rounded-lg bg-flame-400/10 px-3 py-2 text-sm text-flame-400">{error}</p>
          )}
          {notice && (
            <p className="rounded-lg bg-mint-400/10 px-3 py-2 text-sm text-mint-400">{notice}</p>
          )}

          <div>
            <label htmlFor="email" className="label-mono mb-1.5 block">
              Email
            </label>
            <input
              id="email"
              className="field w-full"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="label-mono mb-1.5 block">
              Password
            </label>
            <input
              id="password"
              className="field w-full"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-volt mt-1 w-full">
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setNotice(null);
            }}
            className="text-center text-xs text-fog-400 transition hover:text-fog-100"
          >
            {isSignUp ? 'Already have an account? Sign in' : "No account yet? Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
