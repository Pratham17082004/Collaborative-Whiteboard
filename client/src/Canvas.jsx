const Canvas = ({ socket, roomId, tool, eraserSize }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null); 
  
  const [isDrawing, setIsDrawing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  // --- Utility Function to Draw a Line (Stays stable) ---
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
        // Use 95% of window width and 75% of window height for maximum drawing area
        canvasRef.current.width = window.innerWidth * 0.95;
        // Subtract a bit of space (150px) for the control panel/header
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
    
    // Draw locally (This line must persist!)
    drawLine(x0, y0, x1, y1, color, size); 

    // Emit drawing data to the server
    if (socket) {
      socket.emit('drawing', { x0, y0, x1, y1, color, size });
    }

    // Update start points for the next segment
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
    // CRITICAL: This is the only place setIsDrawing(false) is called.
    // It should NOT clear the canvas.
    setIsDrawing(false);
  };
  
  // --- Initial Setup and Real-Time Listener (The Fix is here!) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // Set initial size and listener (Layout fix)
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);
    
    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    contextRef.current = context;

    // --- Socket Listeners (Stabilized by simple dependencies) ---
    if (!socket || !roomId) return () => window.removeEventListener('resize', setCanvasSize);
      
    // The rest of the socket listeners remain the same...
    const handleHistory = (history) => {
        setTimeout(() => { redrawCanvasWithHistory(history); }, 50); 
    };
    socket.on('drawingHistory', handleHistory);

    const handleRemoteDrawing = (data) => {
        drawLine(data.x0, data.y0, data.x1, data.y1, data.color, data.size);
    };
    socket.on('drawing', handleRemoteDrawing);
    
    const handleCanvasCleared = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
    };
    socket.on('canvasCleared', handleCanvasCleared);
    
    // FIX FOR TOUCH DRAGGING: Manual listener with { passive: false }
    const touchMoveHandler = (e) => {
        e.preventDefault(); 
        
        // Use the current isDrawing state to know if we should draw
        if (isDrawing && e.touches && e.touches.length > 0) {
            drawing(e.touches[0]); 
        }
    };

    // Add the listener with the critical { passive: false } option
    // NOTE: This listener is added once on mount due to dependencies [].
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });


    // Cleanup function: remove listeners 
    return () => {
        socket.off('drawing', handleRemoteDrawing);
        socket.off('drawingHistory', handleHistory);
        socket.off('canvasCleared', handleCanvasCleared);
        canvas.removeEventListener('touchmove', touchMoveHandler); 
        window.removeEventListener('resize', setCanvasSize);
    };
    // CRITICAL FIX: Empty dependency array (or only [socket, roomId]) ensures 
    // context initialization is stable and doesn't wipe the canvas on state changes.
  }, [socket, roomId]); 

  // The rest of the component remains the same
  return (
    // w-full max-w-none ensures the canvas fills the viewport width
    <div ref={containerRef} className="w-full max-w-none flex justify-center flex-grow">
        <canvas
            ref={canvasRef}
            className="whiteboard-canvas"
            onMouseDown={startDrawing}
            onMouseMove={drawing}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing} 
            onTouchStart={(e) => startDrawing(e.touches[0])}
            onTouchEnd={stopDrawing}
            // onTouchMove is handled by the manual listener in useEffect
        />
    </div>
  );
};

export default Canvas;