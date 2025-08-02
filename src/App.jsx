import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import MovieList from './pages/MovieList';
import MovieRoom from './pages/MovieRoom';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsAdmin(userData.role === 'admin');
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setIsAdmin(userData.role === 'admin');
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    localStorage.removeItem('user');
  };

  return (
    <Router>
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
