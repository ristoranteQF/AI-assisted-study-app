import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DecksAPI, FlashcardsAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCard, setEditingCard] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '', hint: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [d, c] = await Promise.all([DecksAPI.get(id), DecksAPI.cards(id)]);
      setDeck(d);
      setCards(c);
    } catch (e) {
      toast.error(apiError(e));
      navigate('/decks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const submitCard = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    try {
      if (editingCard) {
        await FlashcardsAPI.update(editingCard.id, {
          question: form.question, answer: form.answer, hint: form.hint || null,
        });
        toast.success('Card updated.');
      } else {
        await FlashcardsAPI.create(Number(id), {
          question: form.question, answer: form.answer, hint: form.hint || null,
        });
        toast.success('Card added.');
      }
      setShowCreate(false);
      setEditingCard(null);
      setForm({ question: '', answer: '', hint: '' });
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const removeCard = async (card) => {
    if (!confirm('Delete this card?')) return;
    try {
      await FlashcardsAPI.remove(card.id);
      toast.success('Card deleted.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const startEdit = (card) => {
    setEditingCard(card);
    setForm({ question: card.question, answer: card.answer, hint: card.hint || '' });
    setShowCreate(true);
  };

  if (loading || !deck) return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/decks" className="text-xs text-muted">← Decks</Link>
          <h1 style={{ marginTop: 4 }}>{deck.name}</h1>
          <p className="subtle">
            {deck.card_count} card{deck.card_count === 1 ? '' : 's'}
            {deck.due_count > 0 && <> · <strong style={{ color: 'var(--warning)' }}>{deck.due_count} due</strong></>}
          </p>
        </div>
        <div className="row gap-sm wrap">
          {cards.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                if (!confirm('Reset SM-2 progress for all cards in this deck?\n\nThis clears ease factor, interval, and repetitions. The cards themselves are not touched.')) return;
                try {
                  const updated = await DecksAPI.resetProgress(deck.id);
                  setDeck(updated);
                  await load();
                  toast.success('Deck progress reset.');
                } catch (e) { toast.error(apiError(e)); }
              }}
              title="Reset spaced-repetition state to defaults"
            >
              Reset progress
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => { setEditingCard(null); setForm({ question: '', answer: '', hint: '' }); setShowCreate(true); }}>+ Add card</button>
          {cards.length > 0 && <Link to={`/study/${deck.id}`} className="btn btn-primary">Study</Link>}
        </div>
      </header>

      {deck.description && <p className="text-muted mb-6">{deck.description}</p>}

      {cards.length === 0 ? (
        <div className="empty">
          <h3>This deck is empty</h3>
          <p>Add cards manually, or generate them from a note.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add a card</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c, i) => (
            <div key={c.id} className="card">
              <div className="row between mb-4">
                <span className="text-xs text-faint">Card #{i + 1}</span>
                <div className="row gap-sm">
                  <span className="tag">EF {c.ease_factor.toFixed(2)} · {c.interval_days}d</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>Edit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeCard(c)}>Delete</button>
                </div>
              </div>
              <div className="qa-grid">
                <div>
                  <div className="text-xs text-faint mb-4">QUESTION</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.question}</div>
                </div>
                <div>
                  <div className="text-xs text-faint mb-4">ANSWER</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{c.answer}</div>
                </div>
              </div>
              {c.hint && <div className="text-sm text-muted mt-4">💡 {c.hint}</div>}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditingCard(null); }}
        title={editingCard ? 'Edit card' : 'Add card'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowCreate(false); setEditingCard(null); }}>Cancel</button>
            <button className="btn btn-primary" form="card-form">Save</button>
          </>
        }
      >
        <form id="card-form" className="form" onSubmit={submitCard}>
          <div className="field">
            <label>Question</label>
            <textarea
              className="textarea"
              rows={3}
              required
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Answer</label>
            <textarea
              className="textarea"
              rows={3}
              required
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Hint <span className="text-faint text-xs">(optional)</span></label>
            <input
              className="input"
              value={form.hint}
              onChange={(e) => setForm({ ...form, hint: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
