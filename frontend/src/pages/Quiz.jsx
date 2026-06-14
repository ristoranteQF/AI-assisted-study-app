import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QuizzesAPI, SessionsAPI } from '../api/index.js';
import { useToast } from '../components/Toast.jsx';
import { apiError } from '../api/client.js';
import Spinner from '../components/Spinner.jsx';

export default function Quiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({}); 
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const sessionRef = useRef(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let alive = true;
    QuizzesAPI.get(id)
      .then(async (q) => {
        if (!alive) return;
        setQuiz(q);
        try {
          const s = await SessionsAPI.start({ activity: 'quiz', quiz_id: Number(id) });
          sessionRef.current = s.id;
        } catch {  }
      })
      .catch((e) => {
        toast.error(apiError(e));
        navigate('/quizzes');
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    return () => {
      const id = sessionRef.current;
      if (!id) return;
      sessionRef.current = null;
      const duration = Math.round((Date.now() - startedAt.current) / 1000);
      SessionsAPI.end(id, {
        duration_seconds: duration,
        cards_reviewed: 0,
        correct_count: 0,
        incorrect_count: 0,
      }).catch(() => {});
    };
  }, []);

  const allAnswered = quiz?.questions.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    if (!allAnswered) {
      toast.error('Answer every question first.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = quiz.questions.map((q) => ({
        question_id: q.id, selected_index: answers[q.id],
      }));
      const attempt = await QuizzesAPI.submit(quiz.id, payload);
      setResult(attempt);

      const sid = sessionRef.current;
      if (sid) {
        const duration = Math.round((Date.now() - startedAt.current) / 1000);
        SessionsAPI.end(sid, {
          duration_seconds: duration,
          cards_reviewed: attempt.total,
          correct_count: attempt.score,
          incorrect_count: attempt.total - attempt.score,
        }).catch(() => {});
        sessionRef.current = null;
      }
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const restart = () => {
    setAnswers({});
    setResult(null);
    startedAt.current = Date.now();
  };

  if (loading || !quiz) return <div className="full-center" style={{ minHeight: 200 }}><Spinner /></div>;

  if (quiz.questions.length === 0) {
    return (
      <div>
        <header className="page-header"><Link to="/quizzes" className="text-xs text-muted">← Quizzes</Link></header>
        <div className="empty"><h3>This quiz has no questions.</h3></div>
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div>
          <Link to="/quizzes" className="text-xs text-muted">← Quizzes</Link>
          <h1 style={{ marginTop: 4 }}>{quiz.title}</h1>
          <p className="subtle">{quiz.questions.length} questions · multiple choice</p>
        </div>
        {result && (
          <div className="row gap-sm">
            <button className="btn btn-secondary" onClick={restart}>Retake</button>
          </div>
        )}
      </header>

      {result && (
        <div className="card padded-lg mb-6" style={{ background: 'var(--brand-soft)', border: 'none' }}>
          <h2>You scored {result.score} / {result.total}</h2>
          <p className="text-muted mt-2">
            {Math.round((result.score / result.total) * 100)}% accuracy. Review the answers below.
          </p>
        </div>
      )}

      <div className="quiz-stage">
        {quiz.questions.map((q, i) => (
          <div key={q.id} className="quiz-question">
            <div className="q-num">Q{i + 1}</div>
            <h3>{q.prompt}</h3>
            <div className="quiz-options">
              {q.options.map((opt, idx) => {
                const selected = answers[q.id] === idx;
                let cls = 'quiz-option';
                if (result) {
                  if (idx === q.correct_index) cls += ' correct';
                  else if (selected && idx !== q.correct_index) cls += ' incorrect';
                } else if (selected) {
                  cls += ' selected';
                }
                const letter = String.fromCharCode(65 + idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cls}
                    disabled={!!result}
                    onClick={() => setAnswers({ ...answers, [q.id]: idx })}
                  >
                    <span className="marker">{letter}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {result && q.explanation && (
              <div className="explanation">{q.explanation}</div>
            )}
          </div>
        ))}

        {!result && (
          <div className="row mt-6" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-lg" onClick={submit} disabled={submitting || !allAnswered}>
              {submitting ? <Spinner inline /> : 'Submit answers'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
