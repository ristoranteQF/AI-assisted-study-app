import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthAPI } from '../api/auth.js';
import { apiError } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

export default function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { user, refresh } = useAuth();
  const [state, setState] = useState({ loading: true, ok: false, message: '' });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, ok: false, message: 'Missing confirmation token.' });
      return;
    }
    AuthAPI.confirmEmailChange(token)
      .then(async (r) => {
        if (user) {
          try { await refresh(); } catch {  }
        }
        setState({ loading: false, ok: true, message: r.message || 'Email updated.' });
      })
      .catch((err) =>
        setState({ loading: false, ok: false, message: apiError(err) }),
      );
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="brand-mark" style={{ margin: '0 auto 16px' }}>SB</div>
        {state.loading ? (
          <>
            <h1>Confirming…</h1>
            <p className="subtitle">Hang tight.</p>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 16 }}>
              <Spinner />
            </div>
          </>
        ) : (
          <>
            <h1>{state.ok ? 'Email updated' : 'Could not confirm'}</h1>
            <p className="subtitle">{state.message}</p>
            <Link to={user ? '/settings' : '/login'} className="btn btn-primary btn-block btn-lg mt-4">
              {user ? 'Back to settings' : 'Sign in'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
