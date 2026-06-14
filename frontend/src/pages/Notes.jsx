import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotesAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';

export default function Notes() {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [mode, setMode] = useState('text'); 
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef(null);

  const load = () => {
    setLoading(true);
    NotesAPI.list()
      .then(setNotes)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const reset = () => {
    setTitle('');
    setContent('');
    setMode('text');
    if (fileInput.current) fileInput.current.value = '';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return toast.error('Title is required.');
    setSubmitting(true);
    try {
      if (mode === 'text') {
        if (!content.trim()) {
          toast.error('Content cannot be empty.');
          setSubmitting(false);
          return;
        }
        await NotesAPI.create({ title: title.trim(), content });
      } else {
        const file = fileInput.current?.files?.[0];
        if (!file) {
          toast.error('Pick a file to upload.');
          setSubmitting(false);
          return;
        }
        await NotesAPI.upload(title.trim(), file);
      }
      toast.success('Note saved.');
      setShowCreate(false);
      reset();
      load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (note) => {
    if (!confirm(`Delete "${note.title}"? This cannot be undone.`)) return;
    try {
      await NotesAPI.remove(note.id);
      toast.success('Note deleted.');
      load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Notes</h1>
          <p className="subtle">Upload lectures, paste text, then turn them into study material.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New note</button>
      </header>

      {loading ? (
        <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>
      ) : notes.length === 0 ? (
        <div className="empty">
          <h3>No notes yet</h3>
          <p>Add your first set of lecture notes to start generating flashcards and quizzes.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Add a note</button>
        </div>
      ) : (
        <div className="card-grid">
          {notes.map((n) => (
            <div key={n.id} className="card">
              <div className="row between mb-4">
                <span className="tag">{n.source_type.toUpperCase()}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(n)}>Delete</button>
              </div>
              <Link to={`/notes/${n.id}`} style={{ color: 'var(--text)' }}>
                <h3 style={{ marginBottom: 6 }}>{n.title}</h3>
              </Link>
              <p className="text-xs text-muted">
                Updated {new Date(n.updated_at).toLocaleDateString()}
              </p>
              {n.summary && (
                <p className="text-sm text-muted mt-4" style={{
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {n.summary.replace(/^TL;DR:\s*/, '')}
                </p>
              )}
              <div className="row mt-4">
                <Link to={`/notes/${n.id}`} className="btn btn-secondary btn-sm">Open</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); reset(); }}
        title="New note"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setShowCreate(false); reset(); }} type="button">
              Cancel
            </button>
            <button className="btn btn-primary" form="create-note-form" disabled={submitting}>
              {submitting ? <Spinner inline /> : 'Save'}
            </button>
          </>
        }
      >
        <div className="row gap-sm mb-4">
          <button
            className={`btn btn-sm ${mode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('text')}
            type="button"
          >Paste text</button>
          <button
            className={`btn btn-sm ${mode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('upload')}
            type="button"
          >Upload file</button>
        </div>
        <form id="create-note-form" className="form" onSubmit={handleCreate}>
          <div className="field">
            <label>Title</label>
            <input
              className="input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lecture 4 — Trees & Graphs"
            />
          </div>
          {mode === 'text' ? (
            <div className="field">
              <label>Content</label>
              <textarea
                className="textarea"
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder="Paste your lecture notes, slide text, or summary here…"
              />
            </div>
          ) : (
            <div className="field">
              <label>File</label>
              <input
                className="input"
                type="file"
                ref={fileInput}
                accept=".pdf,.docx,.txt,.md"
                required
              />
              <span className="hint">Supports PDF, DOCX, TXT, MD (up to 20 MB).</span>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
