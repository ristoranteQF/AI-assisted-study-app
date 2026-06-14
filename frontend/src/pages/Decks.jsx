import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DecksAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';

export default function Decks() {
  const toast = useToast();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    DecksAPI.list()
      .then(setDecks)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await DecksAPI.create({ name: name.trim(), description: description || null });
      setName('');
      setDescription('');
      setShowCreate(false);
      load();
      toast.success('Deck created.');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (deck) => {
    if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
    try {
      await DecksAPI.remove(deck.id);
      toast.success('Deck deleted.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Decks</h1>
          <p className="subtle">Spaced-repetition flashcards. Generate from notes or build by hand.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New deck</button>
      </header>

      {loading ? (
        <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>
      ) : decks.length === 0 ? (
        <div className="empty">
          <h3>No decks yet</h3>
          <p>Create one manually or generate one from a note.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create a deck</button>
        </div>
      ) : (
        <div className="card-grid">
          {decks.map((d) => (
            <div key={d.id} className="card">
              <div className="row between mb-4">
                <span className="tag brand">{d.card_count} card{d.card_count === 1 ? '' : 's'}</span>
                {d.due_count > 0 && <span className="tag warning">{d.due_count} due</span>}
              </div>
              <Link to={`/decks/${d.id}`} style={{ color: 'var(--text)' }}>
                <h3 style={{ marginBottom: 6 }}>{d.name}</h3>
              </Link>
              {d.description && <p className="text-sm text-muted">{d.description}</p>}
              <div className="row mt-4 gap-sm">
                <Link to={`/decks/${d.id}`} className="btn btn-secondary btn-sm">Manage</Link>
                {d.due_count > 0 ? (
                  <Link to={`/study/${d.id}`} className="btn btn-primary btn-sm">Study now</Link>
                ) : d.card_count > 0 ? (
                  <Link to={`/study/${d.id}`} className="btn btn-secondary btn-sm">Review all</Link>
                ) : null}
                <button className="btn btn-ghost btn-sm" onClick={() => remove(d)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New deck"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" form="create-deck-form" disabled={submitting}>
              {submitting ? <Spinner inline /> : 'Create'}
            </button>
          </>
        }
      >
        <form id="create-deck-form" className="form" onSubmit={create}>
          <div className="field">
            <label>Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>Description <span className="text-faint text-xs">(optional)</span></label>
            <textarea
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
