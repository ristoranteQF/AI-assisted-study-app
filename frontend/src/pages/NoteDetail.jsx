import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AIAPI, NotesAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightContent(content, highlights) {
  if (!highlights?.length) return escapeHtml(content);
  // Sort by length so longer overlaps win.
  const sorted = [...highlights].sort((a, b) => b.text.length - a.text.length);
  const placeholders = [];
  let working = content;
  sorted.forEach((h, i) => {
    const re = new RegExp(escapeRegex(h.text), 'i');
    if (re.test(working)) {
      const placeholder = `\x00HL${i}\x00`;
      // Clamp importance to a known range so the class name can't be injected.
      const importance = Math.max(1, Math.min(5, parseInt(h.importance, 10) || 3));
      const html = `<mark class="imp-${importance}" title="${escapeHtml(h.reason || '')}">${escapeHtml(h.text)}</mark>`;
      placeholders.push({ placeholder, html });
      working = working.replace(re, placeholder);
    }
  });
  let escaped = escapeHtml(working);
  for (const { placeholder, html } of placeholders) {
    escaped = escaped.replace(placeholder, html);
  }
  return escaped;
}

export default function NoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(null); // 'summary' | 'cards' | 'quiz' | 'insights'
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardCount, setCardCount] = useState(10);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizCount, setQuizCount] = useState(8);

  const load = () => {
    setLoading(true);
    NotesAPI.get(id)
      .then((n) => {
        setNote(n);
        setTitle(n.title);
        setContent(n.content);
      })
      .catch((e) => {
        toast.error(apiError(e));
        navigate('/notes');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const renderedContent = useMemo(
    () => (note ? highlightContent(note.content, note.highlights) : ''),
    [note],
  );

  const save = async () => {
    try {
      const updated = await NotesAPI.update(id, { title: title.trim(), content });
      setNote(updated);
      setEditMode(false);
      toast.success('Note updated.');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const remove = async () => {
    if (!confirm('Delete this note? Linked decks/quizzes keep their content but lose the link.')) return;
    try {
      await NotesAPI.remove(id);
      toast.success('Note deleted.');
      navigate('/notes');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  const generateSummary = async () => {
    setBusy('summary');
    try {
      const updated = await AIAPI.summary(Number(id));
      setNote(updated);
      toast.success('Summary generated.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const generateInsights = async () => {
    setBusy('insights');
    try {
      const updated = await AIAPI.insights(Number(id));
      setNote(updated);
      toast.success('Highlights & keywords extracted.');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const generateFlashcards = async () => {
    setBusy('cards');
    try {
      const deck = await AIAPI.flashcards(Number(id), cardCount);
      toast.success(`Generated ${deck.card_count} flashcards.`);
      setShowCardModal(false);
      navigate(`/decks/${deck.id}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  const generateQuiz = async () => {
    setBusy('quiz');
    try {
      const quiz = await AIAPI.quiz(Number(id), quizCount);
      toast.success(`Generated ${quiz.questions.length}-question quiz.`);
      setShowQuizModal(false);
      navigate(`/quizzes/${quiz.id}`);
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(null);
    }
  };

  if (loading || !note) return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;

  return (
    <div>
      <header className="page-header">
        <div style={{ flex: 1 }}>
          <Link to="/notes" className="text-xs text-muted">← Notes</Link>
          {editMode ? (
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ marginTop: 8, fontSize: 24, fontWeight: 600 }}
            />
          ) : (
            <h1 style={{ marginTop: 4 }}>{note.title}</h1>
          )}
          <p className="subtle">
            {note.source_type.toUpperCase()} · Updated {new Date(note.updated_at).toLocaleString()}
          </p>
        </div>
        <div className="row gap-sm">
          {editMode ? (
            <>
              <button className="btn btn-secondary" onClick={() => { setEditMode(false); setTitle(note.title); setContent(note.content); }}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={remove}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setEditMode(true)}>Edit</button>
            </>
          )}
        </div>
      </header>

      <div className="card mb-6">
        <h3 className="mb-4">AI study tools</h3>
        <div className="row wrap gap-sm">
          <button className="btn btn-primary btn-sm" onClick={generateSummary} disabled={busy === 'summary'}>
            {busy === 'summary' ? <Spinner inline /> : '✦ Summarise'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={generateInsights} disabled={busy === 'insights'}>
            {busy === 'insights' ? <Spinner inline /> : '✦ Highlights & keywords'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCardModal(true)}>
            ✦ Make flashcards
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowQuizModal(true)}>
            ✦ Make quiz
          </button>
        </div>
      </div>

      {note.summary && (
        <section className="mb-6">
          <h3 className="mb-4">Summary</h3>
          <div className="summary-block">{note.summary}</div>
        </section>
      )}

      {note.keywords?.length > 0 && (
        <section className="mb-6">
          <h3 className="mb-4">Keywords</h3>
          <div>
            {note.keywords.map((k) => (
              <span key={k.id} className="keyword-pill" title={k.definition || ''}>
                {k.term}
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-4">Content</h3>
        {editMode ? (
          <textarea
            className="textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
          />
        ) : (
          <div className="card">
            <div
              className="note-content"
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
          </div>
        )}
      </section>

      <Modal
        open={showCardModal}
        onClose={() => !busy && setShowCardModal(false)}
        title="Generate flashcards"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowCardModal(false)} disabled={busy === 'cards'}>Cancel</button>
            <button className="btn btn-primary" onClick={generateFlashcards} disabled={busy === 'cards'}>
              {busy === 'cards' ? <Spinner inline label="Generating…" /> : 'Generate'}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted mb-4">A new deck will be created from this note.</p>
        <div className="field">
          <label>Number of cards</label>
          <input
            className="input"
            type="number"
            min={3}
            max={40}
            value={cardCount}
            onChange={(e) => setCardCount(Math.max(3, Math.min(40, Number(e.target.value) || 10)))}
          />
        </div>
      </Modal>

      <Modal
        open={showQuizModal}
        onClose={() => !busy && setShowQuizModal(false)}
        title="Generate quiz"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowQuizModal(false)} disabled={busy === 'quiz'}>Cancel</button>
            <button className="btn btn-primary" onClick={generateQuiz} disabled={busy === 'quiz'}>
              {busy === 'quiz' ? <Spinner inline label="Generating…" /> : 'Generate'}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted mb-4">Multiple-choice, 4 options each.</p>
        <div className="field">
          <label>Number of questions</label>
          <input
            className="input"
            type="number"
            min={3}
            max={20}
            value={quizCount}
            onChange={(e) => setQuizCount(Math.max(3, Math.min(20, Number(e.target.value) || 8)))}
          />
        </div>
      </Modal>
    </div>
  );
}
