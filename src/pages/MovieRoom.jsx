import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';

const MovieRoom = ({ user, onLogout }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [room, setRoom] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    username: '',
    password: ''
  });
  const [joining, setJoining] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Add refs to prevent stale closures
  const socketRef = useRef(null);
  const currentUserRef = useRef(null);
  const playerRef = useRef(null);
  const isHandlingRemoteAction = useRef(false);

  // Update refs when state changes
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // YouTube iframe API
  useEffect(() => {
    // Load YouTube iframe API
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

    // Initialize YouTube player when API is ready
    window.onYouTubeIframeAPIReady = () => {
      if (room?.movie?.youtubeId) {
        initializeYouTubePlayer();
      }
    };

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (error) {
          console.error('Error destroying player:', error);
        }
      }
    };
  }, []);

  // Initialize player when room data is available
  useEffect(() => {
    if (room?.movie?.youtubeId) {
      const timer = setTimeout(() => {
        if (window.YT && window.YT.Player) {
          initializeYouTubePlayer();
        } else {
          console.log('YouTube API not ready yet, will retry...');
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [room?.movie?.youtubeId]);

  const initializeYouTubePlayer = () => {
    if (!room?.movie?.youtubeId) {
      return;
    }

    // Check if YouTube API is available
    if (!window.YT || !window.YT.Player) {
      setTimeout(initializeYouTubePlayer, 500);
      return;
    }

    // Destroy existing player if any
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (error) {
        console.error('Error destroying existing player:', error);
      }
    }

    try {
      const newPlayer = new window.YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        videoId: room.movie.youtubeId,
        playerVars: {
          'autoplay': 0,
          'controls': 0,
          'disablekb': 1,
          'enablejsapi': 1,
          'origin': window.location.origin,
          'rel': 0,
          'showinfo': 0,
          'modestbranding': 1
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange,
          'onError': onPlayerError
        }
      });

      setPlayer(newPlayer);
      playerRef.current = newPlayer;
    } catch (error) {
      console.error('Error creating YouTube player:', error);
    }
  };

  const onPlayerReady = (event) => {
    setDuration(event.target.getDuration());
  };

  const onPlayerStateChange = (event) => {
    // Prevent infinite loops from remote actions
    if (isHandlingRemoteAction.current) {
      return;
    }

    const state = event.data;
    console.log('Player state changed:', state, 'Socket:', !!socketRef.current);
    
    switch (state) {
      case window.YT.PlayerState.PLAYING:
        setIsPlaying(true);
        // Only emit if we have socket, user
        if (socketRef.current && currentUserRef.current) {
          console.log('Emitting play action to other users');
          socketRef.current.emit('movie-action', {
            roomId,
            action: 'play',
            user: currentUserRef.current,
            timestamp: Date.now()
          });
        } else {
          console.log('Not emitting play - Socket:', !!socketRef.current, 'User:', !!currentUserRef.current);
        }
        break;
      case window.YT.PlayerState.PAUSED:
        setIsPlaying(false);
        // Only emit if we have socket, user
        if (socketRef.current && currentUserRef.current) {
          console.log('Emitting pause action to other users');
          socketRef.current.emit('movie-action', {
            roomId,
            action: 'pause',
            user: currentUserRef.current,
            timestamp: Date.now()
          });
        } else {
          console.log('Not emitting pause - Socket:', !!socketRef.current, 'User:', !!currentUserRef.current);
        }
        break;
      case window.YT.PlayerState.ENDED:
        setIsPlaying(false);
        break;
    }
  };

  const onPlayerError = (event) => {
    console.error('YouTube player error:', event.data);
  };

  useEffect(() => {
    if (roomId) {
      fetchRoomData();
    }
  }, [roomId]);

  // Cleanup socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log('Disconnecting socket on unmount');
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (room && currentUser && !socket) {
      console.log('Initializing socket for user:', currentUser.name);
      initializeSocket(currentUser);
    }
  }, [room, currentUser, socket]);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('Room state changed:', {
      room: room?.id,
      currentUser: currentUser?.name,
      socket: !!socket,
      isHost,
      player: !!player
    });
  }, [room, currentUser, socket, isHost, player]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRoomData = async () => {
    try {
      console.log('Fetching room data for roomId:', roomId);
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/rooms/${roomId}`);

      if (response.data.success) {
        console.log('Room data received:', response.data.room);
        setRoom(response.data.room);
        setUsers(response.data.room.users || []);

        // If user is logged in, set current user and don't show join modal
        if (user) {
          console.log('User is logged in:', user);
          setCurrentUser(user);
          // Check if current user is the host
          const hostStatus = user.id === response.data.room.host?.id;
          setIsHost(hostStatus);
          console.log('Host status:', hostStatus);
        } else {
          console.log('User is not logged in, showing join modal');
          // Only show join modal for non-authenticated users
          setShowJoinModal(true);
        }
      }
    } catch (error) {
      console.error('Error fetching room:', error);
      // If room not found, show join modal for non-authenticated users
      if (!user) {
        setShowJoinModal(true);
      } else {
        // If logged in user but room not found, redirect to movies
        navigate('/movies');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setJoining(true);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/rooms/${roomId}/join`, {
        username: joinForm.username,
        password: joinForm.password
      });

      if (response.data.success) {
        setRoom(response.data.room);
        setUsers(response.data.room.users);
        setCurrentUser(response.data.user);
        setShowJoinModal(false);
        
        // Check if current user is the host
        const hostStatus = response.data.user.id === response.data.room.host?.id;
        setIsHost(hostStatus);
        console.log('Joined as host:', hostStatus);
      }
    } catch (error) {
      console.error('Error joining room:', error);
      alert(error.response?.data?.message || 'Failed to join room');
    } finally {
      setJoining(false);
    }
  };

  const initializeSocket = (userData) => {
    if (!userData) {
      console.log('No user data provided for socket initialization');
      return;
    }
    
    // Prevent multiple socket connections
    if (socketRef.current) {
      console.log('Socket already exists, disconnecting old one');
      socketRef.current.disconnect();
    }

    console.log('Initializing new socket connection for user:', userData.name);
    const newSocket = io('http://localhost:3000', {
      query: {
        roomId: roomId,
        userId: userData.id,
        userName: userData.name
      },
      transports: ['websocket', 'polling'] // Ensure multiple transport methods
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server with ID:', newSocket.id);
      // Join the room via socket
      newSocket.emit('join-room', {
        roomId: roomId,
        username: userData.name,
        userId: userData.id
      });
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    newSocket.on('user-joined', (data) => {
      console.log('User joined:', data);
      setUsers(prev => {
        const existingUser = prev.find(u => u.id === data.user.id);
        if (!existingUser) {
          return [...prev, data.user];
        }
        return prev;
      });
      setMessages(prev => {
        // Check if join message already exists
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
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data);
      setUsers(prev => prev.filter(u => u.id !== data.userId));
      setMessages(prev => {
        // Check if leave message already exists
        const leaveMessageExists = prev.some(msg => 
          msg.type === 'system' && 
          msg.message === `${data.userName} left the room`
        );
        
        if (leaveMessageExists) {
          return prev;
        }
        
        return [...prev, {
          id: Date.now(),
          type: 'system',
          message: `${data.userName} left the room`
        }];
      });
    });

    newSocket.on('chat-message', (data) => {
      console.log('New message:', data);
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const messageExists = prev.some(msg => 
          msg.userId === data.user.id && 
          msg.message === data.message && 
          Math.abs(new Date(msg.timestamp).getTime() - new Date(data.timestamp).getTime()) < 1000
        );
        
        if (messageExists) {
          console.log('Duplicate message detected, skipping');
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
    });

    newSocket.on('movie-action', (data) => {
      console.log('Movie action received:', data);
      // Don't handle actions from ourselves
      if (data.user?.id === userData.id) {
        console.log('Ignoring action from self');
        return;
      }
      handleRemoteAction(data);
    });

    // Test socket connection
    newSocket.on('test-response', (data) => {
      console.log('Test response received:', data);
    });

    // Send test message after connection
    newSocket.on('connect', () => {
      setTimeout(() => {
        newSocket.emit('test-message', { message: 'Socket test from client' });
      }, 1000);
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
  };

  const handleRemoteAction = (data) => {
    console.log('Handling remote action:', data, 'Player available:', !!playerRef.current);
    
    if (!playerRef.current) {
      console.log('No player available for remote action');
      return;
    }

    // Set flag to prevent infinite loops
    isHandlingRemoteAction.current = true;

    try {
      switch (data.action) {
        case 'play':
          console.log('Executing remote play');
          playerRef.current.playVideo();
          setIsPlaying(true);
          break;
        case 'pause':
          console.log('Executing remote pause');
          playerRef.current.pauseVideo();
          setIsPlaying(false);
          break;
        case 'seek':
          const time = data.data?.time || 0;
          console.log('Executing remote seek to:', time);
          playerRef.current.seekTo(time, true);
          setCurrentTime(time);
          break;
        case 'sync':
          const syncTime = data.data?.time || 0;
          console.log('Executing remote sync to:', syncTime);
          playerRef.current.seekTo(syncTime, true);
          setCurrentTime(syncTime);
          break;
      }
    } catch (error) {
      console.error('Error handling remote action:', error);
    } finally {
      // Reset flag after a short delay to allow state changes to propagate
      setTimeout(() => {
        isHandlingRemoteAction.current = false;
      }, 500);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !currentUserRef.current) return;

    const messageData = {
      roomId: roomId,
      user: currentUserRef.current,
      message: newMessage,
      timestamp: new Date().toISOString()
    };

    console.log('Sending message:', messageData);
    socketRef.current.emit('chat-message', messageData);
    setNewMessage('');
  };

  const handlePlayPause = () => {
    if (!playerRef.current) {
      console.log('No player available for play/pause');
      return;
    }

    console.log('Manual play/pause triggered, current state:', isPlaying);
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (e) => {
    if (!playerRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekTime = (clickX / width) * duration;
    
    console.log('Manual seek to:', seekTime);
    playerRef.current.seekTo(seekTime, true);
    setCurrentTime(seekTime);

    // Emit seek action to other users
    if (socketRef.current && currentUserRef.current) {
      console.log('Emitting seek action');
      socketRef.current.emit('movie-action', {
        roomId,
        action: 'seek',
        data: { time: seekTime },
        user: currentUserRef.current,
        timestamp: Date.now()
      });
    }
  };

  const handleSync = () => {
    if (!playerRef.current || !socketRef.current || !currentUserRef.current) return;
    
    const currentVideoTime = playerRef.current.getCurrentTime();
    console.log('Manual sync triggered, current time:', currentVideoTime);
    
    // Emit sync action to other users
    socketRef.current.emit('movie-action', {
      roomId,
      action: 'sync',
      data: { time: currentVideoTime },
      user: currentUserRef.current,
      timestamp: Date.now()
    });
  };

  // Update current time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && isPlaying) {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
        } catch (error) {
          console.error('Error getting current time:', error);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-white text-xl font-semibold">Loading room...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-white/20 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎬</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Join Room
              </h3>
              <p className="text-gray-400">Enter your details to join the room</p>
              {!user && (
                <p className="text-green-400 text-sm mt-2">✨ No login required - join as guest!</p>
              )}
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-3">
                  Your Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-400">👤</span>
                  </div>
                  <input
                    type="text"
                    value={joinForm.username}
                    onChange={(e) => setJoinForm({ ...joinForm, username: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>

              {room?.password && (
                <div>
                  <label className="block text-sm font-semibold text-gray-200 mb-3">
                    Room Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-400">🔒</span>
                    </div>
                    <input
                      type="password"
                      value={joinForm.password}
                      onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
                      className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                      placeholder="Enter room password"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/movies')}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 shadow-lg"
                >
                  {joining ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Joining...</span>
                    </div>
                  ) : (
                    'Join Room'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/movies')}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors bg-white/10 backdrop-blur-sm rounded-full px-4 py-2"
              >
                <span>←</span>
                <span>Back to Movies</span>
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-sm">🎬</span>
                </div>
                <h1 className="text-xl font-bold text-white">{room?.name || 'Movie Room'}</h1>
                {isHost && (
                  <span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-semibold">
                    Host
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${socket ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-gray-300 text-sm">
                  {socket ? `Connected - ${currentUser?.name || 'Guest'}` : 'Disconnected'}
                </span>
              </div>
              {user && (
                <button
                  onClick={onLogout}
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-4 py-2 rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen">
        {/* Video Player */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-black relative group">
            {room?.movie?.youtubeId ? (
              <div id="youtube-player" className="w-full h-full">
                {/* Fallback content while YouTube player loads */}
                {!player && (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <div className="text-xl">Loading video...</div>
                      <div className="text-sm text-gray-400 mt-2">{room.movie.title}</div>
                      <button 
                        onClick={() => initializeYouTubePlayer()}
                        className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                      >
                        Manual Load Video
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎬</div>
                  <div className="text-xl">Video not available</div>
                  <div className="text-sm text-gray-400 mt-2">No YouTube video ID found</div>
                  <div className="text-xs text-gray-500 mt-2">Room movieId: {room?.movieId}</div>
                </div>
              </div>
            )}

            {/* Video Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="flex items-center space-x-6">
                <button
                  onClick={handlePlayPause}
                  className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-full transition-all duration-300 transform hover:scale-110 backdrop-blur-sm"
                >
                  <span className="text-xl">{isPlaying ? '⏸️' : '▶️'}</span>
                </button>
                
                <div className="flex-1 relative">
                  <div 
                    className="bg-white/20 rounded-full h-2 backdrop-blur-sm cursor-pointer"
                    onClick={handleSeek}
                  >
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-200"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <span className="text-white text-sm font-medium bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                
                {isHost && (
                  <button
                    onClick={handleSync}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-full transition-all duration-300 transform hover:scale-105 backdrop-blur-sm"
                    title="Sync with other users"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Movie Info */}
          <div className="bg-gradient-to-r from-gray-800/50 to-gray-900/50 backdrop-blur-xl p-6 border-t border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">{room?.movie?.title}</h2>
            <p className="text-gray-300 text-sm leading-relaxed">{room?.movie?.description}</p>
          </div>
        </div>

        {/* Chat Sidebar */}
        <div className="w-96 bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl border-l border-white/10 flex flex-col">
          {/* Users Online */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Users Online</h3>
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                {users.length} online
              </div>
            </div>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center space-x-3 bg-white/5 backdrop-blur-sm rounded-xl p-3">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-gray-200 text-sm font-medium">
                    {user.name}
                  </span>
                  {user.id === room?.host?.id && (
                    <span className="bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-semibold">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`${msg.type === 'system' ? 'text-center' : ''}`}>
                {msg.type === 'system' ? (
                  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                    <span className="text-gray-400 text-sm">{msg.message}</span>
                  </div>
                ) : (
                  <div className={`${msg.userId === (currentUser?.id || 'guest') ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block max-w-xs px-4 py-3 rounded-2xl ${msg.userId === (currentUser?.id || 'guest')
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/10 backdrop-blur-sm text-gray-200 border border-white/10'
                      }`}>
                      <div className="text-xs opacity-75 mb-1">
                        {msg.userName}
                      </div>
                      <div className="text-sm">{msg.message}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-6 border-t border-white/10">
            <form onSubmit={sendMessage} className="flex space-x-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-400">💬</span>
                </div>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 backdrop-blur-sm"
                />
              </div>
              <button
                type="submit"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieRoom;