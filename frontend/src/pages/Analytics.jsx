import { useEffect, useMemo, useState } from 'react';
import { AnalyticsAPI, SessionsAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

const METRICS = [
  { key: 'minutes', label: 'Minutes', unit: 'min', kind: 'time' },
  { key: 'cards', label: 'Cards reviewed', unit: 'cards', kind: 'count' },
  { key: 'accuracy', label: 'Accuracy', unit: '%', kind: 'percent' },
];

function valueFor(metric, day) {
  if (metric === 'minutes') return day.minutes;
  if (metric === 'cards') return day.cards_reviewed;
  return Math.round((day.accuracy || 0) * 100);
}

function formatDayFull(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
function formatDayShort(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric' });
}
function formatWeekday(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'narrow' });
}
function isToday(iso) {
  const today = new Date();
  const t = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return iso === t;
}

export default function Analytics() {
  const toast = useToast();
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('minutes');
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    Promise.all([AnalyticsAPI.overview(), SessionsAPI.list(15)])
      .then(([o, s]) => {
        setOverview(o);
        setSessions(s);
        if (o.daily.length > 0) setSelectedDate(o.daily[o.daily.length - 1].date);
      })
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    if (!overview) return null;
    const values = overview.daily.map((d) => valueFor(metric, d));
    const total = values.reduce((a, b) => a + b, 0);
    const max = Math.max(...values, 0);
    const bestIdx = values.indexOf(max);
    const best = max > 0 ? overview.daily[bestIdx] : null;
    const nonZero = values.filter((v) => v > 0).length;
    const avg = nonZero ? Math.round(total / overview.daily.length) : 0;
    return { total, max, best, avg };
  }, [overview, metric]);

  if (loading || !overview) {
    return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;
  }

  const selected = overview.daily.find((d) => d.date === selectedDate) || overview.daily[overview.daily.length - 1];
  const chartMax = Math.max(1, summary.max);
  const metricMeta = METRICS.find((m) => m.key === metric);

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Analytics</h1>
          <p className="subtle">How you've been studying over the last 14 days.</p>
        </div>
      </header>

      {/* Top stats */}
      <div className="stat-grid">
        <Stat label="Notes" value={overview.total_notes} />
        <Stat label="Decks" value={overview.total_decks} />
        <Stat label="Total cards" value={overview.total_cards} />
        <Stat label="Quizzes" value={overview.total_quizzes} />
        <Stat label="Cards due today" value={overview.cards_due_today} />
        <Stat label="Streak" value={`${overview.streak_days} day${overview.streak_days === 1 ? '' : 's'}`} />
        <Stat label="Sessions (7d)" value={overview.sessions_last_7_days} />
        <Stat label="Minutes (7d)" value={overview.minutes_last_7_days} />
      </div>

      {/* Daily activity chart */}
      <section className="card mb-6">
        <div className="row between mb-4 wrap gap-sm">
          <div>
            <h3>Daily activity</h3>
            <p className="text-xs text-muted">Tap a bar to see that day's detail.</p>
          </div>
          <div className="metric-tabs" role="tablist" aria-label="Pick metric">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={metric === m.key}
                className={`metric-tab ${metric === m.key ? 'active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected day detail — replaces the hover tooltip */}
        <div className="chart-detail">
          <div>
            <div className="chart-detail-date">
              {isToday(selected.date) ? 'Today' : formatDayFull(selected.date)}
              {!isToday(selected.date) && <span className="text-xs text-faint" style={{ marginLeft: 8 }}>{selected.date}</span>}
            </div>
            <div className="chart-detail-metrics">
              <DetailMetric label="Minutes" value={selected.minutes} highlight={metric === 'minutes'} />
              <DetailMetric label="Cards" value={selected.cards_reviewed} highlight={metric === 'cards'} />
              <DetailMetric label="Accuracy" value={selected.cards_reviewed ? `${Math.round((selected.accuracy || 0) * 100)}%` : '—'} highlight={metric === 'accuracy'} />
            </div>
          </div>
        </div>

        {/* The chart — bars are clickable buttons */}
        <div className="chart-v2" role="group" aria-label={`${metricMeta.label} per day, last 14 days`}>
          {overview.daily.map((d) => {
            const v = valueFor(metric, d);
            const today = isToday(d.date);
            const sel = d.date === selected.date;
            const heightPct = chartMax > 0 ? (v / chartMax) * 100 : 0;
            return (
              <button
                key={d.date}
                type="button"
                className={`chart-day ${today ? 'is-today' : ''} ${sel ? 'is-selected' : ''}`}
                onClick={() => setSelectedDate(d.date)}
                aria-label={`${formatDayFull(d.date)}: ${v} ${metricMeta.unit}`}
                aria-pressed={sel}
              >
                <span
                  className="chart-bar-track"
                  style={{ '--bar-h': `${Math.max(heightPct, 2)}%` }}
                >
                  {v > 0 && <span className="chart-bar-value">{v}</span>}
                </span>
                <span className="chart-day-num">{formatDayShort(d.date)}</span>
                <span className="chart-day-wd">{formatWeekday(d.date)}</span>
              </button>
            );
          })}
        </div>

        {/* Summary line */}
        <div className="chart-summary">
          <span><strong>Total:</strong> {summary.total} {metricMeta.unit}</span>
          <span className="dot">·</span>
          <span><strong>Best day:</strong> {summary.best ? `${valueFor(metric, summary.best)} ${metricMeta.unit} on ${formatDayFull(summary.best.date)}` : '—'}</span>
          <span className="dot">·</span>
          <span><strong>14-day avg:</strong> {summary.avg} {metricMeta.unit}/day</span>
        </div>
      </section>

      {/* Recent sessions */}
      <section className="card">
        <h3 className="mb-4">Recent sessions</h3>
        {sessions.length === 0 ? (
          <p className="text-muted text-sm">No sessions yet — go study a deck or take a quiz!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map((s) => {
              const total = s.correct_count + s.incorrect_count;
              const acc = total ? Math.round((s.correct_count / total) * 100) : null;
              return (
                <div key={s.id} className="row between wrap" style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                  <div>
                    <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{s.activity}</div>
                    <div className="text-xs text-muted">{new Date(s.started_at).toLocaleString()}</div>
                  </div>
                  <div className="row gap-sm wrap">
                    <span className="tag">{Math.max(1, Math.round(s.duration_seconds / 60))} min</span>
                    {s.cards_reviewed > 0 && <span className="tag">{s.cards_reviewed} items</span>}
                    {acc !== null && <span className={`tag ${acc >= 80 ? 'success' : acc >= 50 ? 'warning' : 'danger'}`}>{acc}%</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
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

function DetailMetric({ label, value, highlight }) {
  return (
    <div className={`detail-metric ${highlight ? 'is-active' : ''}`}>
      <div className="detail-metric-label">{label}</div>
      <div className="detail-metric-value">{value}</div>
    </div>
  );
}
