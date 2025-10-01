const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { MongoClient } = require('mongodb');
require('dotenv').config(); // Load environment variables

const app = express();
// Render typically provides the PORT, but we default to 5000
const PORT = process.env.PORT || 5000; 

const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = process.env.DATABASE_NAME || "whiteboard_db";
const COLLECTION_NAME = "drawings";

let db; // Global reference to the database instance

const VERCEL_URL = "https://collaborative-whiteboard-pink.vercel.app";

const server = http.createServer(app);

// FINAL CORS CONFIGURATION: Explicitly allow the Vercel domain and credentials
const io = new Server(server, {
  cors: {
    origin: [VERCEL_URL, "http://localhost:5173"], // Allow Vercel and local origins
    methods: ["GET", "POST"],
    credentials: true // Crucial for cross-origin Socket.IO connections
  },
  path: '/socket.io' // Helps with Render proxy configuration
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
        
        // 3. Handle clearing the canvas
        socket.on('clearCanvas', async () => {
            if (!currentRoomId) return;

            // 3a. Delete all records for this room from MongoDB
            await db.collection(COLLECTION_NAME).deleteMany({ roomId: currentRoomId });
            console.log(`Cleared canvas for room: ${currentRoomId}`);
            
            // 3b. Broadcast clear command to everyone in the room (including sender)
            io.to(currentRoomId).emit('canvasCleared');
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