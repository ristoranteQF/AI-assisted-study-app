import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Spinner from './components/Spinner.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import ConfirmEmailChange from './pages/ConfirmEmailChange.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Notes from './pages/Notes.jsx';
import NoteDetail from './pages/NoteDetail.jsx';
import Decks from './pages/Decks.jsx';
import DeckDetail from './pages/DeckDetail.jsx';
import Study from './pages/Study.jsx';
import Quizzes from './pages/Quizzes.jsx';
import Quiz from './pages/Quiz.jsx';
import Analytics from './pages/Analytics.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <div className="full-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public landing page — authed users get bounced to the dashboard. */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />

      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/notes/:id" element={<NoteDetail />} />
        <Route path="/decks" element={<Decks />} />
        <Route path="/decks/:id" element={<DeckDetail />} />
        <Route path="/study/:deckId" element={<Study />} />
        <Route path="/quizzes" element={<Quizzes />} />
        <Route path="/quizzes/:id" element={<Quiz />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
