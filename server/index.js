const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
require('dotenv').config(); 

const app = express();
const PORT = 5000; 

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"]
  }
});

// --- MongoDB Setup ---
const MONGO_URI = process.env.MONGO_URI; 
const DATABASE_NAME = process.env.DATABASE_NAME;

if (!MONGO_URI) {
    console.error("FATAL ERROR: MONGO_URI is missing from the .env file. Please check the file path and content.");
    process.exit(1);
}

const client = new MongoClient(MONGO_URI);
let drawingCollection; 

/**
 * Connects to MongoDB Atlas and sets up the collection reference.
 */
async function connectToMongo() {
    try {
        console.log("Attempting to connect to MongoDB...");
        await client.connect();
        
        console.log("SUCCESS: MongoDB connection established.");
        
        const database = client.db(DATABASE_NAME);
        // Using 'drawings' collection to store all pen and eraser strokes
        drawingCollection = database.collection("drawings"); 

    } catch (error) {
        console.error("FAILURE: Failed to connect to MongoDB.");
        console.error("Error details:", error.message);
        process.exit(1); 
    }
}

/**
 * Utility to fetch the entire history from MongoDB and send it to a single socket.
 */
async function sendHistoryToSocket(roomId, socket) {
    if (!drawingCollection) return;

    try {
        // Fetch ALL drawing/erasing events for the room
        const history = await drawingCollection.find({ 
            roomId: roomId,
        }).sort({ timestamp: 1 }).toArray();

        // Send history ONLY to the user who just joined
        socket.emit('drawingHistory', history);
        console.log(`Sent ${history.length} drawing events to user ${socket.id} in room ${roomId}`);
    } catch (error) {
        console.error("Error sending history:", error);
    }
}

// --- Socket.IO Logic ---
io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);
  
  let currentRoomId = null; 

  // 1. Handle user joining a room
  socket.on('joinRoom', async (roomId) => {
    if (currentRoomId) {
      socket.leave(currentRoomId);
    }
    
    socket.join(roomId);
    currentRoomId = roomId;
    console.log(`User ${socket.id} joined room: ${roomId}`);

    // Send the current history to the joining user
    await sendHistoryToSocket(roomId, socket);
  });

  // 2. Handle incoming drawing/erasing data
  socket.on('drawing', async (data) => {
    if (!currentRoomId) return;

    const drawingEvent = {
        ...data,
        roomId: currentRoomId, 
        timestamp: new Date(),
    };

    // Save the new event to MongoDB
    if (drawingCollection) {
        try {
            await drawingCollection.insertOne(drawingEvent);
        } catch (error) {
            console.error("Error saving drawing to MongoDB:", error);
        }
    }
    
    // Broadcast the event ONLY to others in the SAME room
    socket.to(currentRoomId).emit('drawing', data);
  });

  // 3. Handle clearing the canvas (NEW LOGIC)
  socket.on('clearCanvas', async () => {
    if (!currentRoomId) return;

    if (drawingCollection) {
        try {
            // Delete all drawing events for this room from the database
            const result = await drawingCollection.deleteMany({ roomId: currentRoomId });
            console.log(`Cleared ${result.deletedCount} items from room: ${currentRoomId}`);

            // Broadcast the clear command to all other users in the room (including sender)
            // We use 'io.to' here to ensure the sender also receives the confirmation to clear the screen
            io.to(currentRoomId).emit('canvasCleared');
        } catch (error) {
            console.error("Error clearing canvas in MongoDB:", error);
        }
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      socket.leave(currentRoomId);
    }
    console.log(`User Disconnected: ${socket.id}`);
  });
});

// --- Server Startup ---
connectToMongo().then(() => {
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});
