import { AlertCircle, LoaderCircle, LockKeyhole, Mail, PackageCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFriendlyAuthError } from '../services/authService';

export const LoginPage = () => {
  const { profile, login, loading, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (profile) return <Navigate to={profile.role === 'admin' ? '/dashboard' : '/required'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
    } catch (loginError) {
      setError(getFriendlyAuthError(loginError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand"><span><PackageCheck size={29} /></span><h1>REQUIRE</h1></div>
        <div className="login-heading"><h2>Sign in</h2><p>Use your staff or administrator account.</p></div>
        <form className="login-form" onSubmit={submit}>
          <label className="input-with-icon"><span>Email</span><div><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus /></div></label>
          <label className="input-with-icon"><span>Password</span><div><LockKeyhole size={18} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label>
          {(error || authError) ? <p className="form-error"><AlertCircle size={16} />{error || authError}</p> : null}
          <button className="button button--primary button--full" type="submit" disabled={busy || loading}>{busy || loading ? <LoaderCircle className="spin" size={18} /> : null}Sign in</button>
        </form>
      </section>
    </main>
  );
};
