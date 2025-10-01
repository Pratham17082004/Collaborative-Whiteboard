import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import { io } from 'socket.io-client';

// Determine the WebSocket server URL based on the environment.
// For production (Vite build), it uses the VITE_SERVER_URL environment variable 
// (which you will set on Vercel/Netlify).
// For local development, it falls back to localhost:5000.
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const socket = io(SERVER_URL);

// Basic check for successful connection
socket.on('connect', () => {
  console.log('Client connected to Socket.IO server:', socket.id, 'at', SERVER_URL);
});

// Check for disconnection
socket.on('disconnect', () => {
  console.log('Client disconnected from Socket.IO server');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Pass the socket instance down to the App component */}
    <App socket={socket} />
  </React.StrictMode>,
)
