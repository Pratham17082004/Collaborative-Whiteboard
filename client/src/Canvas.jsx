import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css'; 

const Canvas = ({ socket, roomId, tool }) => { // Accepts 'tool' prop
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  // --- Utility Function to Draw a Line ---
  const drawLine = (x0, y0, x1, y1, color) => {
    const context = contextRef.current;
    
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color; 
    // Set line thickness: 15px for eraser (white), 5px for pen (black)
    context.lineWidth = color === '#FFFFFF' ? 15 : 5; 
    context.stroke();
    context.closePath();
  };
  
  /**
   * Clears the canvas and redraws the entire history.
   */
  const redrawCanvasWithHistory = (history) => {
    if (!canvasRef.current || !contextRef.current) return;
    
    // Clear the entire canvas
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Redraw all historical events
    history.forEach(data => {
        // Use the color saved in the database to determine line thickness
        const lineWidth = data.color === '#FFFFFF' ? 15 : 5;
        contextRef.current.lineWidth = lineWidth;
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color);
    });
    // Reset line width back to standard pen size for new drawings
    contextRef.current.lineWidth = 5; 
  };
  
  // --- Initial Setup and Real-Time Listener ---
  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 0.9;
    canvas.height = window.innerHeight * 0.8;
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context;

    if (!socket || !roomId) return;
      
    // Listener for initial history load when joining a room
    const handleHistory = (history) => {
        setTimeout(() => {
            redrawCanvasWithHistory(history);
        }, 50); 
    };
    socket.on('drawingHistory', handleHistory);
    
    // Listener for server-side clear confirmation (NEW)
    const handleCanvasCleared = () => {
        if(contextRef.current && canvasRef.current) {
             contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
             console.log("Canvas cleared remotely.");
        }
    };
    socket.on('canvasCleared', handleCanvasCleared);

    // Listener for real-time remote drawing
    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color);
    };
    socket.on('drawing', handleRemoteDrawing);

    // Cleanup function: remove listeners 
    return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('drawingHistory', handleHistory);
        socket.off('canvasCleared', handleCanvasCleared);
    };
  }, [socket, roomId]);


  // --- Event Handlers (Mouse/Touch) ---

  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const startDrawing = (e) => {
    if (!contextRef.current || !roomId) return; 

    const { x, y } = getCoordinates(e);
    startXRef.current = x;
    startYRef.current = y;
    
    // Set line width based on current tool for local drawing only
    contextRef.current.lineWidth = tool === 'eraser' ? 15 : 5;

    // --- FIX: Draw a dot immediately on press to ensure taps work ---
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    
    // Draw dot locally (x0=x1, y0=y1)
    drawLine(x, y, x, y, color); 

    // Emit the dot event to the server for persistence and synchronization
    if (socket) {
      socket.emit('drawing', { x0: x, y0: y, x1: x, y1: y, color });
    }
    // --- END FIX ---
    
    setIsDrawing(true);
  };

  const drawing = (e) => {
    if (!isDrawing) return; 
    
    const { x: x1, y: y1 } = getCoordinates(e);
    const x0 = startXRef.current;
    const y0 = startYRef.current;
    
    // Determine color based on tool: White for eraser, Black for pen
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    
    // Draw locally
    drawLine(x0, y0, x1, y1, color); 

    // Emit drawing data to the server
    if (socket) {
      socket.emit('drawing', { x0, y0, x1, y1, color });
    }

    // Update start points for the next segment
    startXRef.current = x1;
    startYRef.current = y1;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    <canvas
      ref={canvasRef}
      className="whiteboard-canvas"
      // Mouse handlers
      onMouseDown={startDrawing}
      onMouseMove={drawing}
      onMouseUp={stopDrawing}
      onMouseOut={stopDrawing} 
      // Mobile touch handlers
      onTouchStart={(e) => startDrawing(e.touches[0])}
      // CRITICAL FIX: preventDefault stops the default scrolling/panning behavior
      onTouchMove={(e) => { e.preventDefault(); drawing(e.touches[0]); }} 
      onTouchEnd={stopDrawing}
    />
  );
};

export default Canvas;
