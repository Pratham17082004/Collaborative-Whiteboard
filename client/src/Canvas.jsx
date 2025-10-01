import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css'; 

const Canvas = ({ socket, roomId, tool, eraserSize }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null); 
  
  const [isDrawing, setIsDrawing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  // --- Utility Function to Draw a Line ---
  const drawLine = (x0, y0, x1, y1, color, size) => { 
    const context = contextRef.current;
    
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color; 
    context.lineWidth = size; 
    context.stroke();
    context.closePath();
  };
  
  // ... redrawCanvasWithHistory function remains the same ...
  const redrawCanvasWithHistory = (history) => {
    if (!canvasRef.current || !contextRef.current) return;
    
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    history.forEach(data => {
        const size = data.color === '#FFFFFF' ? data.size : 5;
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, size);
    });
    contextRef.current.lineWidth = 5; 
  };
  
  // --- Core Sizing Logic (Full Screen Fix) ---
  const setCanvasSize = () => {
    if (canvasRef.current && containerRef.current) {
        // Use full window size, minus space for header and controls (approx 150px total)
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = Math.max(window.innerHeight - 150, 400); 
    }
  };


  // --- Event Handler Utility ---
  const getCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  // --- Drawing Logic for continuous lines ---
  const drawing = (e) => {
    if (!isDrawing) return; 
    
    const { x: x1, y: y1 } = getCoordinates(e);
    const x0 = startXRef.current;
    const y0 = startYRef.current;
    
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    const size = tool === 'eraser' ? eraserSize : 5;
    
    // Draw locally
    drawLine(x0, y0, x1, y1, color, size); 

    // Emit drawing data to the server
    if (socket) {
      socket.emit('drawing', { x0, y0, x1, y1, color, size });
    }

    // CRITICAL: Update start points for the next segment
    startXRef.current = x1;
    startYRef.current = y1;
  };
  
  const startDrawing = (e) => {
    if (!contextRef.current || !roomId) return; 

    const { x, y } = getCoordinates(e);
    startXRef.current = x;
    startYRef.current = y;
    
    setIsDrawing(true);
    
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    const size = tool === 'eraser' ? eraserSize : 5;
    
    // Draw dot on tap (FIX for tap not registering)
    drawLine(x, y, x, y, color, size); 

    // Emit single dot data to the server immediately
    if (socket) {
      socket.emit('drawing', { x0: x, y0: y, x1: x, y1: y, color, size });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  // --- Initial Setup and Real-Time Listener (Cleaned up touch logic) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context;

    if (!socket || !roomId) return () => window.removeEventListener('resize', setCanvasSize);
      
    // ... socket listeners ...
    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
    };
    socket.on('drawing', handleRemoteDrawing);
    
    const handleCanvasCleared = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on('canvasCleared', handleCanvasCleared);
    
    // FIX FOR TOUCH DRAGGING: Manual listener with { passive: false }
    // This handler must be re-created every time 'isDrawing' changes state
    const touchMoveHandler = (e) => {
        // Prevents scrolling while actively drawing
        e.preventDefault(); 
        
        // CRITICAL: Only call drawing if the mouse/finger is actively down
        if (isDrawing && e.touches && e.touches.length > 0) {
            // Pass the touch event data to the drawing function
            drawing(e.touches[0]); 
        }
    };

    // Add the listener with the critical { passive: false } option
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });


    // Cleanup function: remove listeners 
    return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('canvasCleared', handleCanvasCleared);
        canvas.removeEventListener('touchmove', touchMoveHandler); 
        window.removeEventListener('resize', setCanvasSize);
    };
  }, [socket, roomId, isDrawing, eraserSize, tool]); // Dependencies added

  return (
    // Add the container ref for dynamic sizing 
    // w-full max-w-none ensures the canvas fills the viewport width
    <div ref={containerRef} className="w-full max-w-none flex justify-center flex-grow">
        <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseMove={drawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing} 
            // onTouchStart handles the tap (startDrawing)
            onTouchStart={(e) => startDrawing(e.touches[0])}
            // onTouchMove is handled by the manual listener in useEffect
            onTouchEnd={stopDrawing}
        />
    </div>
  );
};

export default Canvas;