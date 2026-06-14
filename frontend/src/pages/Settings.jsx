import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsersAPI } from '../api/index.js';
import { AuthAPI } from '../api/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [resending, setResending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email);
    }
  }, [user]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const newEmail = email.trim().toLowerCase();
      const emailChanged = newEmail && newEmail !== user.email;
      await UsersAPI.update({ full_name: fullName.trim(), email: newEmail });
      await refresh();
      if (emailChanged) {
        toast.success(`Verification link sent to ${newEmail}. Click it to confirm the change — your current email stays active until you do.`, 8000);
      } else {
        toast.success('Profile updated.');
      }
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const cancelPending = async () => {
    try {
      await UsersAPI.cancelPendingEmail();
      await refresh();
      toast.success('Pending email change cancelled.');
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwNew !== pwConfirm) {
      toast.error('New passwords do not match.');
      return;
    }
    if (pwNew.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    setSavingPw(true);
    try {
      await UsersAPI.changePassword(pwCurrent, pwNew);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
      toast.success('Password changed.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSavingPw(false);
    }
  };

  const resendVerification = async () => {
    setResending(true);
    try {
      await AuthAPI.resendVerification(user.email);
      toast.success('Verification email sent (check your inbox).');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setResending(false);
    }
  };

  const deleteAccount = async () => {
    const confirmation = prompt('Type DELETE to permanently delete your account and all data:');
    if (confirmation !== 'DELETE') return;
    setDeleting(true);
    try {
      await UsersAPI.deleteAccount();
      logout();
      navigate('/signup', { replace: true });
    } catch (err) {
      toast.error(apiError(err));
      setDeleting(false);
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="subtle">Manage your account and credentials.</p>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
        <section className="card">
          <h3 className="mb-4">Profile</h3>
          <form className="form" onSubmit={saveProfile}>
            <div className="field">
              <label>Full name</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {!user?.is_email_verified && !user?.pending_email && (
                <span className="hint">
                  Not verified.{' '}
                  <button type="button" className="btn btn-ghost btn-sm" disabled={resending} onClick={resendVerification}>
                    {resending ? <Spinner inline /> : 'Resend verification email'}
                  </button>
                </span>
              )}
              {user?.pending_email && (
                <div
                  className="card mt-2"
                  style={{
                    background: 'rgba(245,158,11,0.10)',
                    borderColor: 'rgba(245,158,11,0.35)',
                    padding: 12,
                  }}
                >
                  <div className="text-sm" style={{ marginBottom: 6 }}>
                    Pending change to <strong>{user.pending_email}</strong>. Click the
                    confirmation link sent to that address — your current email stays
                    active until then.
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={cancelPending}
                  >
                    Cancel pending change
                  </button>
                </div>
              )}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? <Spinner inline /> : 'Save changes'}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h3 className="mb-4">Change password</h3>
          <form className="form" onSubmit={changePassword}>
            <div className="field">
              <label>Current password</label>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>New password</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" disabled={savingPw}>
                {savingPw ? <Spinner inline /> : 'Change password'}
              </button>
            </div>
          </form>
        </section>

        <section className="card" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
          <h3 className="mb-4" style={{ color: 'var(--danger)' }}>Danger zone</h3>
          <p className="text-sm text-muted mb-4">
            Permanently delete your account, notes, decks, quizzes, and study history. This cannot be undone.
          </p>
          <button className="btn btn-danger" onClick={deleteAccount} disabled={deleting}>
            {deleting ? <Spinner inline /> : 'Delete my account'}
          </button>
        </section>
      </div>
    </div>
  );
}
