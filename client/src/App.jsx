import { useState } from 'react';
import Canvas from './Canvas';
import './App.css'; 

function App({ socket }) { 
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [tool, setTool] = useState('pen');

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      socket.emit('joinRoom', roomId.trim());
      setIsJoined(true);
    }
  };
  
  const handleToolChange = (newTool) => {
      setTool(newTool);
  };
  
  // New handler to emit the clear canvas event
  const handleClear = () => {
      // NOTE: Using window.confirm() here. In a production app, use a custom modal UI.
      if (socket && isJoined && window.confirm("Are you sure you want to clear the entire canvas? This action cannot be undone.")) {
          socket.emit('clearCanvas');
      }
  };

  return (
    <div className="App p-4 flex flex-col items-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-extrabold mb-4 text-gray-800">
        Collaborative Whiteboard ✍️
      </h1>

      {/* Room Joining Section */}
      <div className="flex space-x-2 mb-6 p-4 bg-white rounded-xl shadow-lg">
        <input
          type="text"
          placeholder="Enter Room ID (e.g., 'design-101')"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={isJoined}
          className="p-3 border border-gray-300 rounded-lg shadow-inner focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 w-64 text-base"
        />
        <button
          onClick={handleJoinRoom}
          disabled={isJoined || !roomId.trim()}
          className={`px-6 py-3 rounded-lg font-semibold transition duration-150 transform hover:scale-105 ${
            isJoined 
              ? 'bg-green-600 text-white cursor-default shadow-md' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
          }`}
        >
          {isJoined ? `Joined: ${roomId}` : 'Join/Create Room'}
        </button>
      </div>

      {isJoined && (
        <div className="w-full flex flex-col items-center max-w-7xl">
          <p className="text-md text-gray-700 mb-4 bg-yellow-100 p-2 rounded-lg shadow-sm">
            Room: <span className="font-mono font-bold text-lg text-blue-800">{roomId}</span>
          </p>
          
          {/* Tool Selector Controls */}
          <div className="flex space-x-4 mb-4">
              <button 
                  onClick={() => handleToolChange('pen')} 
                  className={`px-6 py-3 rounded-lg font-semibold transition duration-150 shadow-md ${
                      tool === 'pen' 
                      ? 'bg-blue-600 text-white border-2 border-blue-700' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-300'
                  }`}
              >
                  Pen 🖊️
              </button>
              <button 
                  onClick={() => handleToolChange('eraser')} 
                  className={`px-6 py-3 rounded-lg font-semibold transition duration-150 shadow-md ${
                      tool === 'eraser' 
                      ? 'bg-red-500 text-white border-2 border-red-600' 
                      : 'bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-300'
                  }`}
              >
                  Eraser 🧼
              </button>
              <button 
                  onClick={handleClear} 
                  className="px-6 py-3 rounded-lg font-semibold transition duration-150 shadow-md bg-gray-600 text-white hover:bg-gray-700 border-2 border-gray-800"
                  title="Clear all drawings in this room (permanent!)"
              >
                  Clear Canvas 🗑️
              </button>
          </div>

          {/* Pass the current tool and socket instance to the Canvas */}
          <Canvas socket={socket} roomId={roomId} tool={tool} />
        </div>
      )}
      
      {!isJoined && (
        <p className="text-red-500 mt-8 text-xl font-medium p-4 bg-red-50 rounded-lg shadow-inner border border-red-200">
          Please join a room to start collaborating.
        </p>
      )}
    </div>
  );
}

export default App;
