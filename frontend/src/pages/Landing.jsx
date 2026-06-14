import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="landing">
      {/* Top nav */}
      <header className="landing-nav">
        <Link to="/" className="brand" style={{ color: 'var(--text)' }}>
          <div className="brand-mark">SB</div>
          <span>StudyBuddy</span>
        </Link>
        <div className="row gap-sm">
          <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
          <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="landing-hero">
        <span className="hero-badge">AI-assisted learning</span>
        <h1 className="hero-title">
          Turn your notes into <span className="accent">flashcards that stick.</span>
        </h1>
        <p className="hero-sub">
          Upload lecture notes, slides, or PDFs. StudyBuddy generates
          summaries, flashcards, and quizzes — then schedules reviews with
          spaced repetition so you actually remember what you read.
        </p>
        <div className="hero-cta">
          <Link to="/signup" className="btn btn-primary btn-lg">Start studying free</Link>
          <Link to="/login" className="btn btn-secondary btn-lg">I have an account</Link>
        </div>
        <div className="hero-trust">
          Powered by Anthropic Claude · Spaced repetition (SM-2) · No credit card required
        </div>

        {/* Decorative app preview card */}
        <div className="hero-preview" aria-hidden>
          <div className="hero-preview-bar">
            <span className="hero-dot" />
            <span className="hero-dot" />
            <span className="hero-dot" />
            <span className="hero-preview-title">studybuddy.app — Lecture 4: Trees & Graphs</span>
          </div>
          <div className="hero-preview-body">
            <div className="hero-preview-card">
              <div className="face-label">QUESTION</div>
              <div className="hero-preview-q">What does the BFS algorithm guarantee about the path it finds in an unweighted graph?</div>
            </div>
            <div className="hero-preview-row">
              <span className="hero-pill again">Again</span>
              <span className="hero-pill hard">Hard</span>
              <span className="hero-pill good">Good</span>
              <span className="hero-pill easy">Easy</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section">
        <div className="section-head">
          <h2>Everything you need to study smarter.</h2>
          <p>Built for students who want to remember what they learn — not just read it once.</p>
        </div>
        <div className="feature-grid">
          <Feature
            icon="✦"
            title="AI summaries"
            desc="Long lecture notes condensed into a TL;DR and key points in seconds."
          />
          <Feature
            icon="▤"
            title="Auto flashcards"
            desc="Generate dozens of question/answer cards from any document with one click."
          />
          <Feature
            icon="?"
            title="Practice quizzes"
            desc="Multiple-choice quizzes with explanations to test deep understanding, not just recall."
          />
          <Feature
            icon="↻"
            title="Spaced repetition"
            desc="The SM-2 algorithm shows you each card right before you'd forget it. Backed by 40 years of cognitive research."
          />
          <Feature
            icon="✎"
            title="Smart highlights"
            desc="The most important passages are highlighted by importance level, with definitions for key terms."
          />
          <Feature
            icon="↗"
            title="Progress analytics"
            desc="Track your study streak, daily minutes, and accuracy over time. See yourself improve."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="landing-section landing-steps-section">
        <div className="section-head">
          <h2>Three steps. Ten minutes. You're studying.</h2>
        </div>
        <div className="steps">
          <Step n={1} title="Upload your material">
            Drag in a PDF, paste lecture text, or upload a Word doc. StudyBuddy extracts the text for you.
          </Step>
          <Step n={2} title="Generate study tools">
            One click turns your notes into a summary, a deck of flashcards, or a multiple-choice quiz.
          </Step>
          <Step n={3} title="Review on schedule">
            Spaced repetition picks what to show you and when. No more re-reading the same chapter five times.
          </Step>
        </div>
      </section>


      {/* Final CTA */}
      <section className="landing-cta">
        <h2>Ready to actually remember what you study?</h2>
        <p>Free to use. No credit card. Sign up in 30 seconds.</p>
        <Link to="/signup" className="btn btn-primary btn-lg">Create your free account</Link>
      </section>

      <footer className="landing-footer">
        <span>StudyBuddy · Smart Study Companion</span>
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div className="step">
      <div className="step-num">{n}</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function TechBadge({ label }) {
  return <span className="tech-badge">{label}</span>;
}
