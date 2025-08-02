import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getUser, getToken } from '../utils/auth'

const MovieList = ({ user, onLogout }) => {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    password: ''
  });
  const [creatingRoom, setCreatingRoom] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/movies`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (response.data.success) {
        setMovies(response.data.data)
      }
    } catch (error) {
      console.error('Error fetching movies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie);
    setShowModal(true);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreatingRoom(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/rooms`,
        {
          movieId: selectedMovie.id,
          name: roomForm.name,
          password: roomForm.password,
        },
        {
          headers: {
            'Authorization': `Bearer ${getToken()}`
          }
        }
      );      

      console.log('Create Room API Response:', response.data);

      if (response.data.success) {
        navigate(`/room/${response.data.room.id}`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        alert(`Error: ${error.response.data.message}`);
      } else {
        alert('Failed to create room. Please try again.');
      }
    } finally {
      setCreatingRoom(false);
      setShowModal(false);
      setRoomForm({ name: '', password: '' });
    }
  };

  const handleLogout = () => {
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-xl font-semibold">Loading movies...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎬</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Theater
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-300 text-sm">Welcome, {user.name}</span>
              </div>
              {user.role === 'admin' && (
                <button
                  onClick={() => navigate('/admin')}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  🔧 Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">Available Movies</h2>
          <p className="text-gray-300 text-lg">Choose a movie to start watching together</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {movies.map((movie, index) => (
            <div
              key={movie.id}
              className="group bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 transform hover:scale-105 cursor-pointer border border-white/10 hover:border-purple-500/30"
              style={{ animationDelay: `${index * 100}ms` }}
              onClick={() => handleMovieClick(movie)}
            >
              <div className="h-80 bg-gray-700 relative overflow-hidden">
                <img
                  src={`https://img.youtube.com/vi/${movie.youtubeId}/0.jpg`}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div className="absolute top-4 right-4">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    {movie.genre}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="flex items-center justify-between text-white">
                    <span className="text-sm font-medium">{movie.year}</span>
                    <span className="text-sm font-medium">{movie.duration}</span>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-300 transition-colors">
                  {movie.title}
                </h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2 leading-relaxed">
                  {movie.description}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-purple-400 text-sm font-semibold">🎬</span>
                    <span className="text-gray-300 text-sm">Click to create room</span>
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-white text-sm">→</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Create Room Modal */}
      {showModal && selectedMovie && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/20 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎬</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Create Room
              </h3>
              <p className="text-gray-400">for "{selectedMovie.title}"</p>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Room Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400">🏠</span>
                  </div>
                  <input
                    type="text"
                    value={roomForm.name}
                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                    placeholder="Enter room name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Room Password (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400">🔒</span>
                  </div>
                  <input
                    type="password"
                    value={roomForm.password}
                    onChange={(e) => setRoomForm({ ...roomForm, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                    placeholder="Enter password (optional)"
                  />
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg"
                >
                  {creatingRoom ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </div>
                  ) : (
                    'Create Room'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieList;
