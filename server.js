const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// In-memory data storage
const users = new Map();
const images = [];
const comments = new Map(); // Map of image ID to array of comments
const firedComments = new Map(); // Map to track fired comments by users

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    console.log('A user connected');
    // Auth handlers
    socket.on('signup', ({ username, password }) => {
        if (users.has(username)) {
            socket.emit('auth-error', 'Username already exists.');
        } else {
            users.set(username, password);
            socket.username = username;
            socket.emit('auth-success', username);
        }
    });

    socket.on('signin', ({ username, password }) => {
        if (users.has(username) && users.get(username) === password) {
            socket.username = username;
            socket.emit('auth-success', username);
        } else {
            socket.emit('auth-error', 'Invalid username or password.');
        }
    });

    // Image handlers
    socket.on('get images', () => {
        socket.emit('images', images);
    });

    socket.on('upload image', (imageData) => {
        const imageId = uuidv4();
        const newImage = {
            id: imageId,
            url: imageData,
            username: socket.username,
            timestamp: new Date().toLocaleString()
        };
        
        images.push(newImage);
        comments.set(imageId, []);
        
        io.emit('new image', newImage);
    });

    // Comment handlers
    socket.on('get comments', (imageId) => {
        const imageComments = comments.get(imageId) || [];
        socket.emit('comments', imageComments);
    });

    socket.on('add comment', ({ imageId, comment }) => {
        if (!socket.username) return;
        
        const commentId = uuidv4();
        const newComment = {
            id: commentId,
            imageId: imageId,
            username: socket.username,
            text: comment,
            timestamp: new Date().toLocaleString(),
            fireCount: 0 // Initialize fire count to 0
        };
        
        if (!comments.has(imageId)) {
            comments.set(imageId, []);
        }
        
        comments.get(imageId).push(newComment);
        io.emit('new comment', newComment);
    });

    // Handle firing (liking) a comment
    socket.on('fire comment', ({ commentId, imageId }) => {
        if (!socket.username) return;
        
        // Create a unique key for this user+comment combination
        const fireKey = `${socket.username}-${commentId}`;
        
        // Check if this user has already fired this comment
        if (!firedComments.has(fireKey)) {
            firedComments.set(fireKey, true);
            
            // Find the comment and increment its fire count
            const imageComments = comments.get(imageId);
            if (imageComments) {
                const comment = imageComments.find(c => c.id === commentId);
                if (comment) {
                    // Initialize fireCount if it doesn't exist
                    if (!comment.fireCount) {
                        comment.fireCount = 0;
                    }
                    
                    // Increment the fire count
                    comment.fireCount += 1;
                    
                    // Broadcast the updated fire count to all clients
                    io.emit('comment fired', {
                        commentId: commentId,
                        fireCount: comment.fireCount
                    });
                }
            }
        }
    });

    socket.on('typing comment', ({ imageId, username }) => {
        socket.broadcast.emit('user typing', { imageId, username });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Create a placeholder image
const fs = require('fs');
const path = require('path');

// Check if placeholder image exists, if not create an empty file
const placeholderPath = path.join(__dirname, 'placeholder.png');
if (!fs.existsSync(placeholderPath)) {
    fs.writeFileSync(placeholderPath, '');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Bulldog Beef server running on http://localhost:${PORT}`);
});