import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 1. Import socket.io-client
import { io } from 'socket.io-client';

// 2. Establish connection to the server running on port 5000
const socket = io('http://localhost:5000');

// Basic log for connection status
socket.on('connect', () => {
  console.log('Client connected to Socket.IO server:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Client disconnected from Socket.IO server');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Pass the socket instance down to the App component */}
    <App socket={socket} />
  </React.StrictMode>,
)
