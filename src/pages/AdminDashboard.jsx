import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const AdminDashboard = ({ onLogout, navigate }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [expandedRoom, setExpandedRoom] = useState(null);
  const socketRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [socketEvents, setSocketEvents] = useState([]);

  useEffect(() => {
    fetchActiveRooms();
    const interval = setInterval(fetchActiveRooms, 10000);
    return () => clearInterval(interval);
  }, [navigate]);

  const fetchActiveRooms = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/rooms`);
      if (response.data.success) {
        setRooms(response.data.data)
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRoomClick = (roomId) => {
    const room = rooms.find(r => r.id === roomId);

    if (expandedRoom === roomId) {
      setExpandedRoom(null);
      disconnectSocket();
    } else {
      setExpandedRoom(roomId);
      connectToRoom(roomId, room);
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      addSocketEvent('disconnect', { reason: 'admin disconnect' });
    }
    setSocket(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setMessages([]);
    socketRef.current = null;
  };

  const connectToRoom = (roomId, room) => {
    if (socketRef.current) {
      disconnectSocket();
    }

    setConnectionStatus('connecting');
    addSocketEvent('connecting', { roomId, roomName: room.name });

    const newSocket = io(import.meta.env.VITE_API_URL, {
      query: {
        roomId: roomId,
        isAdmin: true
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      addSocketEvent('connect', { socketId: newSocket.id, roomId });

      newSocket.emit('join-room', {
        roomId: roomId,
        isAdmin: true
      });
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      addSocketEvent('disconnect', { reason });
    });

    newSocket.on('connect_error', (error) => {
      setConnectionStatus('error');
      addSocketEvent('connect_error', { error: error.message });
    });

    newSocket.on('user-joined', (data) => {
      setMessages(prev => {
        const joinMessageExists = prev.some(msg =>
          msg.type === 'system' &&
          msg.message === `${data.user.name} joined the room`
        );

        if (joinMessageExists) {
          return prev;
        }

        return [...prev, {
          id: Date.now(),
          type: 'system',
          message: `${data.user.name} joined the room`
        }];
      });
      addSocketEvent('user-joined', data);
    });

    newSocket.on('user-left', (data) => {
      setMessages(prev => {
        const leaveMessageExists = prev.some(msg =>
          msg.type === 'system' &&
          msg.message === data.message
        );

        if (leaveMessageExists) {
          return prev;
        }

        return [...prev, {
          id: Date.now(),
          type: 'system',
          message: data.message
        }];
      });
      addSocketEvent('user-left', data);
    });

    newSocket.on('chat-message', (data) => {
      setMessages(prev => {
        const messageExists = prev.some(msg =>
          msg.userId === data.user.id &&
          msg.message === data.message &&
          Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 1000
        );

        if (messageExists) {
          return prev;
        }

        return [...prev, {
          id: Date.now(),
          userId: data.user.id,
          userName: data.user.name,
          message: data.message,
          timestamp: data.timestamp || new Date().toISOString()
        }];
      });
      addSocketEvent('chat-message', data);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
  };

  const addSocketEvent = (event, data) => {
    setSocketEvents(prev => [...prev.slice(-19), {
      id: Date.now(),
      event,
      data,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleLogout = () => {
    disconnectSocket();
    onLogout();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-xl font-semibold">Loading admin dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xl">🔧</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Admin Dashboard
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${refreshing ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                <span className="text-gray-300 text-sm">
                  {refreshing ? 'Refreshing...' : `Admin`}
                </span>
              </div>
              <button
                onClick={() => navigate('/movies')}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                📽️ Movies
              </button>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Active Rooms</p>
                <p className="text-white text-3xl font-bold">{rooms.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm font-medium">Total Users</p>
                <p className="text-white text-3xl font-bold">
                  {rooms.reduce((total, room) => total + (room.users ? room.users.length : 0), 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">Active Rooms</h2>
            <p className="text-gray-300 text-lg">Click on a room to monitor socket activity</p>
          </div>
          <button
            onClick={() => fetchActiveRooms()}
            disabled={refreshing}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg"
          >
            {refreshing ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Refreshing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span>🔄</span>
                <span>Refresh</span>
              </div>
            )}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Active Rooms</h3>
            <p className="text-gray-400">No rooms are currently active</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {rooms.map((room, index) => {
              const isExpanded = expandedRoom === room.id;

              return (
                <div key={room.id} className="space-y-4">
                  <div
                    className={`group bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 transform hover:scale-105 cursor-pointer border ${isExpanded
                      ? 'border-purple-500/50 ring-2 ring-purple-500/30'
                      : 'border-white/10 hover:border-purple-500/30'
                      }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => handleRoomClick(room.id)}
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                            <span className="text-xl">🎬</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white group-hover:text-purple-300 transition-colors">
                              {room.name}
                            </h3>
                            <p className="text-gray-400 text-sm">
                              Room ID: {room.id}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 bg-green-500 rounded-full animate-pulse`}></div>
                          <span className="text-gray-300 text-sm font-medium">online</span>
                        </div>
                      </div>

                      {room.movie && (
                        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 mb-4">
                          <div className="flex items-center space-x-3">
                            <img
                              src={`https://img.youtube.com/vi/${room.movie.youtubeId}/default.jpg`}
                              alt={room.movie.title}
                              className="w-16 h-12 object-cover rounded-lg"
                            />
                            <div>
                              <h4 className="text-white font-medium">{room.movie.title}</h4>
                              <p className="text-gray-400 text-sm">{room.movie.genre} • {room.movie.year}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm font-medium">Users Online</span>
                          <span className="text-white font-semibold">{room.users ? room.users.size : 0}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm font-medium">Host</span>
                          <span className="text-purple-300 font-medium">{room.host?.name || 'Unknown'}</span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-sm font-medium">Created</span>
                          <span className="text-gray-300 text-sm">{formatDate(room.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-800/50 backdrop-blur-xl rounded-xl p-6 border border-white/10 ml-4">
                      <div className="grid grid-cols-1 gap-6">
                        <div className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="text-purple-400 text-lg">👥</span>
                            <h3 className="text-white font-semibold">Connected Users ({room.users ? room.users.length : 0})</h3>
                          </div>
                          <ul className="text-white text-sm space-y-1 pl-1">
                            {room.users && room.users.length > 0 ? (
                              room.users.map((user, index) => (
                                <li key={user.id || index} className="flex items-center gap-2">
                                  <span className="text-green-400">•</span>
                                  <span>{user.name}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-gray-400 italic">No users connected</li>
                            )}
                          </ul>
                        </div>

                        <div className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <span className="text-green-400 text-lg">💬</span>
                            <h3 className="text-white font-semibold">Recent Messages</h3>
                          </div>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {messages.length === 0 ? (
                              <p className="text-gray-400 text-sm">No messages yet</p>
                            ) : (
                              messages.slice(-5).map(message => (
                                <div key={message.id} className="text-sm">
                                  <span className="text-gray-400">{message.userName || 'System'}:</span>
                                  <span className="text-gray-300 ml-1">{message.message}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;