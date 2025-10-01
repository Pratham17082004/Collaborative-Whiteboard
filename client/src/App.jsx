import { useState } from 'react';
import Canvas from './Canvas';
import './App.css'; 

const App = ({ socket }) => { 
  const [roomId, setRoomId] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [tool, setTool] = useState('pen'); 
  const [eraserSize, setEraserSize] = useState(15); 

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      socket.emit('joinRoom', roomId.trim());
      setIsJoined(true);
    }
  };
  
  const handleClear = () => {
    if (!isJoined || !socket) return;
    
    // In a deployed environment, this would be a custom modal.
    const confirmed = true; 
    
    if (confirmed) {
        socket.emit('clearCanvas');
        console.log(`Clearing canvas for room ${roomId}`);
    }
  };

  return (
    // Set min-h-screen for full height and remove horizontal padding
    <div className="App flex flex-col items-center min-h-screen bg-gray-50">
      <h1 className="text-4xl font-extrabold my-4 text-gray-800">
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
          className="p-3 border border-gray-300 rounded-lg shadow-inner focus:ring-blue-600 focus:border-blue-600 disabled:bg-gray-100 w-64 text-base"
        />
        <button
          onClick={handleJoinRoom}
          disabled={isJoined || !roomId.trim()}
          className={`px-6 py-3 rounded-xl font-semibold transition duration-150 transform hover:scale-[1.02] ${
            isJoined 
              ? 'bg-green-600 text-white cursor-default shadow-md' 
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl'
          }`}
        >
          {isJoined ? `Joined: ${roomId}` : 'Join/Create Room'}
        </button>
      </div>

      {isJoined && (
        // w-full max-w-none ensures the canvas can expand horizontally
        <div className="w-full flex flex-col items-center max-w-none flex-grow">
          <p className="text-md text-gray-700 mb-4 bg-yellow-100 p-2 rounded-lg shadow-sm">
            Room: <span className="font-mono font-bold text-lg text-blue-800">{roomId}</span>
          </p>
          
          {/* CONTROL PANEL */}
          <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-4 p-5 bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl">
              
              {/* Tool Selector */}
              <div className="flex space-x-3 items-center">
                  <button 
                      onClick={() => setTool('pen')} 
                      className={`px-4 py-2 rounded-xl font-semibold transition shadow-inner ${
                          tool === 'pen' 
                          ? 'bg-blue-500 text-white ring-2 ring-blue-300' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                      Pen 🖊️
                  </button>
                  <button 
                      onClick={() => setTool('eraser')} 
                      className={`px-4 py-2 rounded-xl font-semibold transition shadow-inner ${
                          tool === 'eraser' 
                          ? 'bg-red-500 text-white ring-2 ring-red-300' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                  >
                      Eraser 🧼
                  </button>
              </div>

              {/* Eraser Size Control */}
              <div className="flex flex-col items-center space-y-1 mt-2 sm:mt-0">
                  <label className="text-xs font-medium text-gray-300">Eraser Size: {eraserSize}px</label>
                  <input
                      type="range"
                      min="5"
                      max="50"
                      value={eraserSize}
                      onChange={(e) => setEraserSize(Number(e.target.value))}
                      disabled={tool !== 'eraser'}
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
              </div>

              {/* Clear Button */}
              <button 
                  onClick={handleClear} 
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold transition duration-150 transform hover:bg-purple-700 shadow-lg mt-4 sm:mt-0"
              >
                  Clear Canvas 🗑️
              </button>
          </div>

          {/* Pass the eraser size down */}
          <Canvas socket={socket} roomId={roomId} tool={tool} eraserSize={eraserSize} />
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