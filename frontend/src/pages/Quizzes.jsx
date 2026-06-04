import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuizzesAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export default function Quizzes() {
  const toast = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    QuizzesAPI.list()
      .then(setQuizzes)
      .catch((e) => toast.error(apiError(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (q) => {
    if (!confirm(`Delete "${q.title}"?`)) return;
    try {
      await QuizzesAPI.remove(q.id);
      toast.success('Quiz deleted.');
      load();
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <header className="page-header">
        <div>
          <h1>Quizzes</h1>
          <p className="subtle">Generate multiple-choice quizzes from your notes and track your scores.</p>
        </div>
      </header>

      {loading ? (
        <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>
      ) : quizzes.length === 0 ? (
        <div className="empty">
          <h3>No quizzes yet</h3>
          <p>Open any note and use the AI tools to generate one.</p>
          <Link to="/notes" className="btn btn-primary">Browse notes</Link>
        </div>
      ) : (
        <div className="card-grid">
          {quizzes.map((q) => (
            <div key={q.id} className="card">
              <div className="row between mb-4">
                <span className="tag brand">{q.question_count} Q</span>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(q)}>Delete</button>
              </div>
              <Link to={`/quizzes/${q.id}`} style={{ color: 'var(--text)' }}>
                <h3 style={{ marginBottom: 6 }}>{q.title}</h3>
              </Link>
              {q.description && <p className="text-sm text-muted">{q.description}</p>}
              <div className="row mt-4">
                <Link to={`/quizzes/${q.id}`} className="btn btn-primary btn-sm">Take quiz</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
