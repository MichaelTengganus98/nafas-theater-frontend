import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MovieList from './pages/MovieList';
import MovieRoom from './pages/MovieRoom';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/movies" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/movies" /> : <Login onLogin={handleLogin} />}
        />
        <Route
          path="/movies"
          element={user ? <MovieList user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
        />
        <Route
          path="/room/:roomId"
          element={<MovieRoom user={user} onLogout={handleLogout} />}
        />
        <Route
          path="/admin"
          element={<AdminDashboard />}
        />
      </Routes>
    </div>
  );
}

export default App;
