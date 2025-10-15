import React, { useRef, useEffect, useState } from 'react';
import './Canvas.css'; 

const Canvas = ({ socket, roomId, tool, eraserSize }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null); 
  
  const [isDrawing, setIsDrawing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  
  // CRITICAL FIX 1: Stable Ref to store the array of strokes (history)
  const strokesRef = useRef([]); 

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
  
  // --- Redraw function now uses the stable strokesRef ---
  const redrawCanvasWithHistory = (history) => {
    if (!canvasRef.current || !contextRef.current) return;
    
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Use the history array passed (or stored in ref)
    history.forEach(data => {
        const size = data.color === '#FFFFFF' ? data.size : 5;
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, size);
    });
    contextRef.current.lineWidth = 5; 
  };
  
  // --- Core Sizing Logic (Layout Fix) ---
  const setCanvasSize = () => {
    if (canvasRef.current) {
        // Use 95% of window width and calculate height dynamically
        canvasRef.current.width = window.innerWidth * 0.95;
        canvasRef.current.height = Math.max(window.innerHeight - 150, 400); 
    }
  };
  
  // CRITICAL FIX 2: Memoize the drawing function for useEffect stability
  const drawing = React.useCallback((e) => {
    if (!isDrawing) return; 
    
    const { x: x1, y: y1 } = getCoordinates(e);
    const x0 = startXRef.current;
    const y0 = startYRef.current;
    
    const color = tool === 'eraser' ? '#FFFFFF' : '#000000';
    const size = tool === 'eraser' ? eraserSize : 5;
    
    // Draw locally
    drawLine(x0, y0, x1, y1, color, size); 

    // Emit data and push to local history ref
    if (socket) {
      const stroke = { x0, y0, x1, y1, color, size };
      socket.emit('drawing', stroke);
      strokesRef.current.push(stroke); // Save locally for immediate redraw
    }

    startXRef.current = x1;
    startYRef.current = y1;
  }, [isDrawing, tool, eraserSize, socket]);


  // --- Standard Event Handlers ---
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
    
    // Draw dot and emit
    const dot = { x0: x, y0: y, x1: x, y1: y, color, size };
    drawLine(dot.x0, dot.y0, dot.x1, dot.y1, dot.color, dot.size); 

    if (socket) {
      socket.emit('drawing', dot);
      strokesRef.current.push(dot); // Save dot to local history
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // --- EFFECT 1: INITIALIZATION & RESIZE REDRAW (CRITICAL) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // Initial Sizing and Context Setup
    setCanvasSize();
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context; 

    // CRITICAL FIX 3: Handler for viewport change (console open/close)
    const handleResizeAndRedraw = () => {
        setCanvasSize(); // Wipe the canvas by changing dimensions
        // Immediately redraw the entire persisted history
        redrawCanvasWithHistory(strokesRef.current); 
    };

    // Attach the handler
    window.addEventListener('resize', handleResizeAndRedraw);
    
    // Cleanup resize listener
    return () => {
        window.removeEventListener('resize', handleResizeAndRedraw);
    };
  }, []); // Runs only once!

  // --- EFFECT 2: SOCKET LISTENERS (Stable) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!socket || !roomId) return;
    
    // 1. Handle Initial History Load
    const handleHistory = (history) => {
        // Store the full history and redraw
        strokesRef.current = history; 
        setTimeout(() => { redrawCanvasWithHistory(history); }, 50); 
    };
    socket.on('drawingHistory', handleHistory);

    // 2. Handle Remote Drawing (just redraws, the local drawing updates strokesRef)
    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
        strokesRef.current.push(data); // Add remote stroke to local history
    };
    socket.on('drawing', handleRemoteDrawing);
    
    // 3. Handle Canvas Clear
    const handleCanvasCleared = () => {
        contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
        strokesRef.current = []; // Clear local history ref
    };
    socket.on('canvasCleared', handleCanvasCleared);
    
    // 4. Touch Move Fix (Ensures continuous drawing)
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
    };
  }, [socket, roomId, drawing]);


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