const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const messages = [];
const users = new Map();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
    socket.emit('load messages', messages);

    socket.on('signup', ({ username, password }) => {
        if (users.has(username)) {
            socket.emit('auth-error', 'Username already exists.');
        } else {
            users.set(username, password);
            socket.username = username; // Store username in socket
            socket.emit('auth-success', username);
            io.emit('user joined', username);
        }
    });

    socket.on('signin', ({ username, password }) => {
        if (users.has(username) && users.get(username) === password) {
            socket.username = username; // Store username in socket
            socket.emit('auth-success', username);
            io.emit('user joined', username);
        } else {
            socket.emit('auth-error', 'Invalid username or password.');
        }
    });

    socket.on('chat message', (msg) => {
        const message = { username: socket.username, msg, timestamp: new Date().toLocaleTimeString() }; // Use socket.username
        messages.push(message);
        if (messages.length > 10) messages.shift();
        io.emit('chat message', message);
    });

    socket.on('typing', () => {
        socket.broadcast.emit('typing', socket.username); // Use socket.username
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('user left', socket.username); // Use socket.username
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});