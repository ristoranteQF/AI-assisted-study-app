import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthAPI } from '../api/auth.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await AuthAPI.forgotPassword(email.trim().toLowerCase());
      setDone(true);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="brand-mark">SB</div>
        <h1>Reset password</h1>
        <p className="subtitle">We'll send a reset link to your email.</p>

        {done ? (
          <div className="card" style={{ background: 'var(--brand-soft)', border: 'none' }}>
            <p>Check your inbox for a reset link. The link expires in 30 minutes.</p>
          </div>
        ) : (
          <form className="form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-block btn-lg" disabled={submitting}>
              {submitting ? <Spinner inline /> : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="auth-footer">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
