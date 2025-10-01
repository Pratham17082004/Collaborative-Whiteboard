const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 5000; 

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || "whiteboard_db";
const COLLECTION_NAME = "drawings";

const VERCEL_URL = "https://collaborative-whiteboard-pink.vercel.app"; // Your live client domain

let db; 

const server = http.createServer(app);

// Final CORS Configuration
const io = new Server(server, {
  cors: {
    origin: [VERCEL_URL, "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true
  },
  path: '/socket.io'
});

/**
 * Connects to MongoDB Atlas using the URI from environment variables.
 */
async function connectToMongo() {
    try {
        console.log("Attempting to connect to MongoDB...");
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DATABASE_NAME);
        console.log("SUCCESS: MongoDB connection established.");
    } catch (error) {
        console.error("FAILURE: Failed to connect to MongoDB. Error details:", error);
        process.exit(1); 
    }
}

// Utility function to handle clearing and broadcasting the result
async function handleClearCanvas(roomId) {
    if (!db) return; // Database not ready

    try {
        // Delete all records for this room from MongoDB
        const result = await db.collection(COLLECTION_NAME).deleteMany({ roomId: roomId });
        console.log(`Cleared ${result.deletedCount} records for room: ${roomId}`);
        
        // Broadcast clear command to everyone in the room (including sender)
        io.to(roomId).emit('canvasCleared');
    } catch (error) {
        console.error("Error clearing canvas:", error);
    }
}


// Call connectToMongo and then start the server
connectToMongo().then(() => {
    // Socket.IO Connection Handler
    io.on('connection', (socket) => {
      
        let currentRoomId = null; 

        // 1. Handle user joining a room
        socket.on('joinRoom', async (roomId) => {
            if (currentRoomId) {
                socket.leave(currentRoomId);
            }
            
            socket.join(roomId);
            currentRoomId = roomId;
            console.log(`User ${socket.id} joined room: ${roomId}`);

            // Send the entire history from the database to the joining user
            const history = await db.collection(COLLECTION_NAME).find({ roomId: roomId }).toArray();
            socket.emit('drawingHistory', history);
        });

        // 2. Handle incoming drawing data (pen/eraser)
        socket.on('drawing', async (data) => {
            if (!currentRoomId) return;

            // 2a. Save drawing event to MongoDB
            const drawingData = { ...data, roomId: currentRoomId, timestamp: new Date() };
            await db.collection(COLLECTION_NAME).insertOne(drawingData);
            
            // 2b. Broadcast the drawing data ONLY to others in the SAME room
            socket.to(currentRoomId).emit('drawing', data);
        });
        
        // 3. Handle clearing the canvas (Calling the robust utility function)
        socket.on('clearCanvas', () => {
            if (!currentRoomId) return;
            handleClearCanvas(currentRoomId);
        });

        socket.on('disconnect', () => {
            if (currentRoomId) {
                socket.leave(currentRoomId);
            }
            console.log(`User Disconnected: ${socket.id}`);
        });
    });

    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
});