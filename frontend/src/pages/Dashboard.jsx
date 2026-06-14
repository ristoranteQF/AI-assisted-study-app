import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnalyticsAPI, DecksAPI, NotesAPI } from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [decks, setDecks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([AnalyticsAPI.overview(), DecksAPI.list(), NotesAPI.list()])
      .then(([o, d, n]) => {
        if (!alive) return;
        setOverview(o);
        setDecks(d.slice(0, 4));
        setNotes(n.slice(0, 4));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Up late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>{greeting}, {(user?.full_name || 'student').split(' ')[0]}</h1>
          <p className="subtle">Here's where things stand today.</p>
        </div>
        <Link to="/notes" className="btn btn-primary">+ New note</Link>
      </header>

      {!user?.is_email_verified && (
        <div className="card mb-6" style={{ background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.35)' }}>
          <div className="row between">
            <div>
              <strong>Verify your email.</strong>
              <p className="text-sm text-muted mt-2">
                Check your inbox for the link we sent to <code>{user?.email}</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <Stat label="Cards due today" value={overview?.cards_due_today ?? 0} />
        <Stat label="Study streak" value={`${overview?.streak_days ?? 0} day${(overview?.streak_days ?? 0) === 1 ? '' : 's'}`} />
        <Stat label="Minutes (7d)" value={overview?.minutes_last_7_days ?? 0} />
        <Stat
          label="Accuracy (30d)"
          value={overview?.accuracy_last_30_days ? `${Math.round(overview.accuracy_last_30_days * 100)}%` : '—'}
        />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="row between mb-4">
            <h3>Recent decks</h3>
            <Link to="/decks" className="text-sm">View all</Link>
          </div>
          {decks.length === 0 ? (
            <div className="text-muted text-sm">No decks yet. Generate one from a note.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {decks.map((d) => (
                <Link
                  key={d.id}
                  to={`/decks/${d.id}`}
                  className="row between"
                  style={{
                    padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div className="text-xs text-muted">{d.card_count} card{d.card_count === 1 ? '' : 's'}</div>
                  </div>
                  {d.due_count > 0 && <span className="tag warning">{d.due_count} due</span>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="row between mb-4">
            <h3>Recent notes</h3>
            <Link to="/notes" className="text-sm">View all</Link>
          </div>
          {notes.length === 0 ? (
            <div className="text-muted text-sm">Upload your first lecture notes to get started.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n) => (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className="row between"
                  style={{
                    padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{n.title}</div>
                    <div className="text-xs text-muted">{n.source_type.toUpperCase()} · {new Date(n.updated_at).toLocaleDateString()}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
