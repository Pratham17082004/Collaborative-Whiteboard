import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css'; 

const Canvas = ({ socket, roomId, tool, eraserSize }) => { // Accepts 'eraserSize' prop
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null); // Ref for the containing div
  
  const [isDrawing, setIsDrawing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  // --- Utility Function to Draw a Line ---
  const drawLine = (x0, y0, x1, y1, color, size) => { // Accepts size
    const context = contextRef.current;
    
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color; 
    context.lineWidth = size; // Use the provided size
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
        // Line size is determined by checking the saved color (White = Eraser, Black = Pen)
        const size = data.color === '#FFFFFF' ? data.size : 5; // Use saved size for eraser, default 5 for pen
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, size);
    });
    // Reset line width back to standard pen size for new drawings
    contextRef.current.lineWidth = 5; 
  };
  
  // --- Initial Setup and Real-Time Listener ---
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // Set initial size based on the container (Fixes right shift/scrolling)
    const setCanvasSize = () => {
        if (containerRef.current) {
            canvas.width = containerRef.current.clientWidth;
            canvas.height = Math.min(window.innerHeight * 0.8, 800); // Max height limit for stability
        }
    };

    setCanvasSize();
    // Add event listener for window resize to maintain responsiveness
    window.addEventListener('resize', setCanvasSize);
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context;

    if (!socket || !roomId) return () => window.removeEventListener('resize', setCanvasSize);
      
    // Listener for initial history load when joining a room
    const handleHistory = (history) => {
        setTimeout(() => {
            redrawCanvasWithHistory(history);
        }, 50); 
    };
    socket.on('drawingHistory', handleHistory);

    // Listener for real-time remote drawing
    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
    };
    socket.on('drawing', handleRemoteDrawing);
    
    // Listener for clear canvas command
    const handleCanvasCleared = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on('canvasCleared', handleCanvasCleared);

    // FIX: Manually set up touchmove event listener with { passive: false }
    const touchMoveHandler = (e) => {
        e.preventDefault(); 
        
        if (e.touches && e.touches.length > 0) {
            drawing(e.touches[0]);
        }
    };
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });


    // Cleanup function: remove listeners 
    return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('drawingHistory', handleHistory);
        socket.off('canvasCleared', handleCanvasCleared);
        canvas.removeEventListener('touchmove', touchMoveHandler);
        window.removeEventListener('resize', setCanvasSize);
    };
  }, [socket, roomId]);


  // --- Event Handlers ---

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
    
    setIsDrawing(true);
    
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    const size = tool === 'eraser' ? eraserSize : 5; // Use eraserSize or pen default
    
    // Draw dot on tap (FIX for tap not registering)
    drawLine(x, y, x, y, color, size); 

    // Emit single dot data to the server immediately
    if (socket) {
      socket.emit('drawing', { x0: x, y0: y, x1: x, y1: y, color, size });
    }
  };

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

    // Update start points for the next segment
    startXRef.current = x1;
    startYRef.current = y1;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  return (
    // Add the container ref for dynamic sizing (fixes layout issue)
    <div ref={containerRef} className="w-full max-w-7xl">
        <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseMove={drawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing} 
            onTouchStart={(e) => startDrawing(e.touches[0])}
            onTouchEnd={stopDrawing}
            // onTouchMove is handled in the useEffect hook with { passive: false }
        />
    </div>
  );
};

export default Canvas;