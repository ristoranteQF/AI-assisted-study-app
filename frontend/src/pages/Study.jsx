import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DecksAPI, FlashcardsAPI, SessionsAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

const QUALITY_BUTTONS = [
  { quality: 1, label: 'Again', sub: '< 1m', cls: 'again' },
  { quality: 3, label: 'Hard', sub: '~ 1d', cls: 'hard' },
  { quality: 4, label: 'Good', sub: 'sched', cls: 'good' },
  { quality: 5, label: 'Easy', sub: '+ EF', cls: 'easy' },
];

export default function Study() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [deck, setDeck] = useState(null);
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ reviewed: 0, correct: 0, incorrect: 0 });
  // Cram mode: study every card regardless of due date. Off by default so the
  // user actually sees SM-2 filtering working (cards drop out of the queue
  // after being graded).
  const [cramMode, setCramMode] = useState(false);
  const [hasNoDueCards, setHasNoDueCards] = useState(false);
  const sessionRef = useRef(null);
  const startedAt = useRef(Date.now());

  const statsRef = useRef(stats);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [d, list] = await Promise.all([
          DecksAPI.get(deckId),
          cramMode ? DecksAPI.cards(deckId) : DecksAPI.due(deckId, 100),
        ]);
        if (!alive) return;
        setDeck(d);
  
        setHasNoDueCards(!cramMode && list.length === 0 && (d.card_count ?? 0) > 0);
        setQueue(list);
        setIndex(0);
        if (list.length > 0) {
          const sess = await SessionsAPI.start({ activity: 'flashcards', deck_id: Number(deckId) });
          sessionRef.current = sess.id;
          startedAt.current = Date.now();
        }
      } catch (e) {
        toast.error(apiError(e));
        navigate('/decks');
      } finally {
        alive && setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [deckId, cramMode]);

  const endSession = () => {
    const id = sessionRef.current;
    if (!id) return;
    sessionRef.current = null;  
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    const s = statsRef.current;
    SessionsAPI.end(id, {
      duration_seconds: duration,
      cards_reviewed: s.reviewed,
      correct_count: s.correct,
      incorrect_count: s.incorrect,
    }).catch(() => {});
  };

  useEffect(() => {
    return () => endSession();
  }, []);

  useEffect(() => {
    if (queue.length > 0 && index >= queue.length) {
      endSession();
    }
  }, [index, queue.length]);

  const current = queue[index];

  const grade = async (quality) => {
    if (!current) return;
    try {
      const updated = await FlashcardsAPI.review(current.id, quality);
      setStats((s) => ({
        reviewed: s.reviewed + 1,
        correct: s.correct + (quality >= 3 ? 1 : 0),
        incorrect: s.incorrect + (quality < 3 ? 1 : 0),
      }));
      setShowAnswer(false);

      // Concrete proof SM-2 actually moved this card.
      const days = updated.interval_days;
      const when =
        quality < 3 ? 'in this session'
        : days <= 1 ? '~ 1 day'
        : days < 30 ? `${days} days`
        : days < 365 ? `${Math.round(days / 30)} months`
        : `${(days / 365).toFixed(1)} years`;
      toast.info(`Next review: ${when}  ·  EF ${updated.ease_factor.toFixed(2)}`, 1500);

      if (quality < 3) {
        const failed = current;
        const currentIdx = index;
        setQueue((prev) => {
          const remaining = prev.length - currentIdx - 1;
          const gap = Math.min(3, remaining);
          const insertAt = currentIdx + 1 + gap;
          const next = [...prev];
          next.splice(insertAt, 0, failed);
          return next;
        });
      }

      setIndex((i) => i + 1);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (!current) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setShowAnswer((s) => !s);
      } else if (showAnswer && ['1', '2', '3', '4'].includes(e.key)) {
        const map = { '1': 1, '2': 3, '3': 4, '4': 5 };
        grade(map[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, showAnswer]);

  if (loading) return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;

  if (queue.length === 0 && hasNoDueCards) {
    return (
      <div>
        <header className="page-header">
          <Link to={`/decks/${deckId}`} className="text-xs text-muted">← {deck?.name || 'Deck'}</Link>
        </header>
        <div className="empty">
          <h3>All caught up! 🎉</h3>
          <p>
            Every card in this deck has been scheduled for a future review by the
            spaced-repetition algorithm (SM-2). Come back tomorrow — or cram them
            all anyway if you want extra practice.
          </p>
          <div className="row gap-sm" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-secondary" to={`/decks/${deckId}`}>Back to deck</Link>
            <button className="btn btn-primary" onClick={() => setCramMode(true)}>
              Cram all cards anyway
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div>
        <header className="page-header">
          <Link to={`/decks/${deckId}`} className="text-xs text-muted">← {deck?.name || 'Deck'}</Link>
        </header>
        <div className="empty">
          <h3>Nothing to study right now 🎉</h3>
          <p>This deck has no cards. Add some to start.</p>
          <Link className="btn btn-primary" to={`/decks/${deckId}`}>Manage deck</Link>
        </div>
      </div>
    );
  }

  if (!current) {
    const accuracy = stats.reviewed ? Math.round((stats.correct / stats.reviewed) * 100) : 0;
    return (
      <div>
        <header className="page-header">
          <div>
            <Link to={`/decks/${deckId}`} className="text-xs text-muted">← {deck?.name}</Link>
            <h1>Session complete 🎯</h1>
          </div>
        </header>
        <div className="card padded-lg" style={{ maxWidth: 520, margin: '20px auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: 16 }}>Nice work.</h2>
          <div className="stat-grid" style={{ marginTop: 0 }}>
            <Stat label="Reviewed" value={stats.reviewed} />
            <Stat label="Correct" value={stats.correct} />
            <Stat label="Accuracy" value={`${accuracy}%`} />
          </div>
          <div className="row gap-sm mt-6" style={{ justifyContent: 'center' }}>
            <Link to={`/decks/${deckId}`} className="btn btn-secondary">Back to deck</Link>
            <Link to="/decks" className="btn btn-primary">All decks</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to={`/decks/${deckId}`} className="text-xs text-muted">← {deck?.name}</Link>
          <h1 style={{ marginTop: 4 }}>
            {cramMode ? 'Cram session' : 'Studying'}
            {cramMode && <span className="tag warning" style={{ marginLeft: 10, fontSize: 12 }}>Cram (ignores SM-2)</span>}
          </h1>
        </div>
      </header>

      <div className="study-stage">
        <div className="study-progress">
          <span>{index + 1} / {queue.length}</span>
          <span>✓ {stats.correct} · ✗ {stats.incorrect}</span>
        </div>
        <div className="study-bar"><div style={{ width: `${(index / queue.length) * 100}%` }} /></div>

        <div
          className="flashcard"
          style={{ position: 'relative' }}
          onClick={() => setShowAnswer((s) => !s)}
        >
          {!showAnswer ? (
            <>
              <div className="face-label">QUESTION</div>
              <div className="question">{current.question}</div>
              {current.hint && <div className="hint">💡 {current.hint}</div>}
              <div className="reveal">Click or press <span className="kbd">Space</span> to reveal</div>
            </>
          ) : (
            <>
              <div className="face-label">ANSWER</div>
              <div className="answer">{current.answer}</div>
              <div className="reveal">Rate your recall below</div>
            </>
          )}
        </div>

        {showAnswer && (
          <div className="review-controls">
            {QUALITY_BUTTONS.map((b, i) => (
              <button
                key={b.quality}
                className={`review-btn ${b.cls}`}
                onClick={() => grade(b.quality)}
              >
                <span>{b.label}</span>
                <span className="label">{b.sub} · <span className="kbd">{i + 1}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat" style={{ textAlign: 'center' }}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
