# Sync Movie App with WebSocket

A web-based movie theater app that lets multiple users watch a movie in sync, complete with shared playback controls and real-time chat using WebSocket.

---

## Architecture Overview

```text
           ┌────────────┐             WebSocket              ┌───────────────┐
           │  Frontend  │  <------------------------------>  │   Backend     │
           │ (React.js) │         (Socket.IO-client)         │ (Node.js +    │
           └─────┬──────┘                                    │  Express.js)  │
                 │                                           └───────┬───────┘
                 │                                                   │
      ┌──────────▼──────────┐                             ┌──────────▼──────────┐
      │ Users control & view│                             │ Shared movie state, │
      │ movie playback &    │                             │ room sync, chat     │
      │ chat in real-time   │                             │ relay & broadcast   │
      └─────────────────────┘                             └─────────────────────┘
```

- **Frontend**: Built with **React.js**, connects via **Socket.IO-client**.
- **Backend**: Node.js with **Express.js** and **Socket.IO** for real-time communication.
- **Communication**: WebSocket events to sync play/pause/seeking/chat across users in a room.
- **Movie Source**: Movies are streamed from the frontend and controlled by server-coordinated events.

---

## Technical Documentation

### Frontend (React)

- **Pages**:
  - `Login`: Login to host
  - `Movie List`: Movie List
  - `Movie Room`: Video player, chat, shared controls
  - `Admin Dashboard`: Monitor active room and its socket process

- **Core Libraries**:
  - `React`
  - `Socket.IO-client`
  - `TailwindCSS`
  - `React Router`

- **Main Logic**:
  - Connect to server via Socket.IO
  - Emit `join-room`, `chat-message`, movie-action : `play`, `pause`, `seek`, `sync` events
  - Sync state on receiving broadcast from server

### Backend (Node.js)

- **Core Libraries**:
  - `Express.js`
  - `Socket.IO`

- **Main Responsibilities**:
  - Manage rooms and users
  - Relay control commands across sockets

---

## Local Deployment Guide (from Scratch)

These steps assume **no prior experience**. You'll set up both backend and frontend on your computer.

### Requirements

- Internet connection
- Any OS (Windows, Mac, Linux)
- Basic terminal/command prompt knowledge

---

### Step 1: Install Node.js (includes npm)

1. Go to [https://nodejs.org](https://nodejs.org)
2. Click the **LTS (Recommended)** version and install it
3. After installation, open your terminal/command prompt and verify:

```bash
node -v
npm -v
```

### Step 2: Install Node.js (includes npm)

```bash
git clone https://github.com/your-username/sync-movie-backend.git
git clone https://github.com/MichaelTengganus98/nafas-theater-frontend.git
```

### Step 3: Run on each folder
#### Install dependencies:
```bash
npm install
```

#### Start the server:
```bash
npm run dev
```

### Test with 
```bash
email: test@gmail.com
password : testtest

after movie room created, copy url and sent to other
```

## Live Demo

> 🔗 **Use the deployed apps below:**

- **Main App**  
  [https://michaeltengganus98.github.io/nafas-theater-frontend/](https://michaeltengganus98.github.io/nafas-theater-frontend/)

- **Admin Dashboard**  
  [https://michaeltengganus98.github.io/nafas-theater-frontend/admin](https://michaeltengganus98.github.io/nafas-theater-frontend/admin)
