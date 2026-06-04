import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthAPI } from '../api/auth.js';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState({ loading: true, ok: false, message: '' });

  useEffect(() => {
    if (!token) {
      setState({ loading: false, ok: false, message: 'Missing verification token.' });
      return;
    }
    AuthAPI.verifyEmail(token)
      .then((r) => setState({ loading: false, ok: true, message: r.message || 'Verified.' }))
      .catch((err) => setState({ loading: false, ok: false, message: apiError(err) }));
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="brand-mark" style={{ margin: '0 auto 16px' }}>SB</div>
        {state.loading ? (
          <>
            <h1>Verifying…</h1>
            <p className="subtitle">Hang tight.</p>
            <div style={{ display: 'grid', placeItems: 'center', marginTop: 16 }}>
              <Spinner />
            </div>
          </>
        ) : (
          <>
            <h1>{state.ok ? 'Email verified' : 'Verification failed'}</h1>
            <p className="subtitle">{state.message}</p>
            <Link to="/" className="btn btn-primary btn-block btn-lg mt-4">
              Go to dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
