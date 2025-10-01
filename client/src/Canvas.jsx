import React, { useRef, useEffect, useState } from 'react'; // <--- CRITICAL FIX: The missing import is here!
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
  
  const redrawCanvasWithHistory = (history) => {
    if (!canvasRef.current || !contextRef.current) return;
    
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    history.forEach(data => {
        const size = data.color === '#FFFFFF' ? data.size : 5;
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, size);
    });
    contextRef.current.lineWidth = 5; 
  };
  
  // --- Core Sizing Logic ---
  const setCanvasSize = () => {
    if (canvasRef.current) {
        // Use 95% of window width and calculate height dynamically (Layout fix)
        canvasRef.current.width = window.innerWidth * 0.95;
        canvasRef.current.height = Math.max(window.innerHeight - 150, 400); 
    }
  };

  // --- Drawing Logic for continuous lines ---
  // Memoize the drawing function to ensure stability inside useEffect dependencies
  const drawing = React.useCallback((e) => {
    if (!isDrawing) return; 
    
    const { x: x1, y: y1 } = getCoordinates(e);
    const x0 = startXRef.current;
    const y0 = startYRef.current;
    
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    const size = tool === 'eraser' ? eraserSize : 5;
    
    drawLine(x0, y0, x1, y1, color, size); 

    if (socket) {
      socket.emit('drawing', { x0, y0, x1, y1, color, size });
    }

    startXRef.current = x1;
    startYRef.current = y1;
  }, [isDrawing, tool, eraserSize, socket]);


  // --- Event Handler Utility ---
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
    const size = tool === 'eraser' ? eraserSize : 5;
    
    // Draw dot
    drawLine(x, y, x, y, color, size); 

    if (socket) {
      socket.emit('drawing', { x0: x, y0: y, x1: x, y1: y, color, size });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // --- EFFECT 1: INITIALIZATION (Runs only once on mount) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // 1. Sizing and Responsiveness
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    
    // 2. Context Setup
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context; 

    // 3. Cleanup resize listener
    return () => {
        window.removeEventListener('resize', setCanvasSize);
    };
  }, []); 

  // --- EFFECT 2: SOCKET LISTENERS & TOUCH FIX (Runs on socket/roomId/drawing changes) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!socket || !roomId) return;
    
    // Set up all socket listeners
    const handleHistory = (history) => {
        setTimeout(() => { redrawCanvasWithHistory(history); }, 50); 
    };
    socket.on('drawingHistory', handleHistory);

    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
    };
    socket.on('drawing', handleRemoteDrawing);
    
    const handleCanvasCleared = () => {
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on('canvasCleared', handleCanvasCleared);
    
    // FIX FOR TOUCH DRAGGING: Manual listener with { passive: false }
    const touchMoveHandler = (e) => {
        e.preventDefault(); 
        
        // Call the memoized drawing function
        if (e.touches && e.touches.length > 0) {
            drawing(e.touches[0]); 
        }
    };

    // Add the listener
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });


    // Cleanup function: remove listeners 
    return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('drawingHistory', handleHistory);
        socket.off('canvasCleared', handleCanvasCleared);
        canvas.removeEventListener('touchmove', touchMoveHandler); 
    };
  }, [socket, roomId, drawing]); // Added drawing dependency here

  // The rest of the component remains the same
  return (
    // w-full max-w-none ensures the canvas fills the viewport width
    <div ref={containerRef} className="w-full max-w-none flex justify-center flex-grow">
        <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            // Mouse Handlers
            onMouseDown={startDrawing}
            onMouseMove={drawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing} 
            // Touch Handlers
            onTouchStart={(e) => startDrawing(e.touches[0])}
            onTouchEnd={stopDrawing}
        />
    </div>
  );
};

export default Canvas;