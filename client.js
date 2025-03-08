document.addEventListener('DOMContentLoaded', () => {

    const socket = io();

    // DOM Elements
    // Auth elements
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const signupBtn = document.getElementById('signup-btn');
    const signinBtn = document.getElementById('signin-btn');
    const authError = document.getElementById('auth-error');
    const currentUserDisplay = document.getElementById('current-user');
    const logoutBtn = document.getElementById('logout-btn');

    // Image viewing elements
    const roastImage = document.getElementById('roast-image');
    const imageUploader = document.getElementById('image-uploader');
    const imageTimestamp = document.getElementById('image-timestamp');
    const nextImageBtn = document.getElementById('next-image');

    // Comments elements
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    const typingIndicator = document.getElementById('typing');

    // Upload elements
    const uploadBtn = document.getElementById('upload-btn');
    const uploadModal = document.getElementById('upload-modal');
    const closeModal = document.querySelector('.close');
    const uploadForm = document.getElementById('upload-form');
    const imageInput = document.getElementById('image-input');

    // App state
    let currentUsername = '';
    let images = [];
    let currentImageIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;
    let firedComments = new Set(); // Track which comments the user has "fired"

    const MAX_USERNAME_LENGTH = 20; // Set your desired limit
    const MAX_PASSWORD_LENGTH = 30; // Set your desired limit
    const MAX_COMMENT_LENGTH = 75; // Set comment character limit to 100

    // Add character counter for comment input
    const charCounterContainer = document.createElement('div');
    charCounterContainer.className = 'char-counter';
    charCounterContainer.style.textAlign = 'right';
    charCounterContainer.style.fontSize = '0.8em';
    charCounterContainer.style.color = '#777';
    charCounterContainer.style.marginBottom = '5px';
    charCounterContainer.textContent = '0/75';
    commentForm.insertBefore(charCounterContainer, commentForm.firstChild);

    usernameInput.addEventListener('input', () => {
        if (usernameInput.value.length > MAX_USERNAME_LENGTH) {
            usernameInput.value = usernameInput.value.slice(0, MAX_USERNAME_LENGTH);
            authError.textContent = `Username cannot exceed ${MAX_USERNAME_LENGTH} characters.`;
        } else {
            authError.textContent = ''; // Clear error if within limit
        }
    });

    passwordInput.addEventListener('input', () => {
        if (passwordInput.value.length > MAX_PASSWORD_LENGTH) {
            passwordInput.value = passwordInput.value.slice(0, MAX_PASSWORD_LENGTH);
            authError.textContent = `Password cannot exceed ${MAX_PASSWORD_LENGTH} characters.`;
        } else {
            authError.textContent = ''; // Clear error if within limit
        }
    });

    // Add event listener for comment input to enforce character limit
    commentInput.addEventListener('input', () => {
        const currentLength = commentInput.value.length;
        charCounterContainer.textContent = `${currentLength}/${MAX_COMMENT_LENGTH}`;
        
        // Update color based on remaining characters
        if (currentLength >= MAX_COMMENT_LENGTH) {
            charCounterContainer.style.color = '#ff3333';
        } else if (currentLength >= MAX_COMMENT_LENGTH * 0.8) {
            charCounterContainer.style.color = '#ff9933';
        } else {
            charCounterContainer.style.color = '#777';
        }
        
        // Truncate if exceeding the limit
        if (currentLength > MAX_COMMENT_LENGTH) {
            commentInput.value = commentInput.value.slice(0, MAX_COMMENT_LENGTH);
            charCounterContainer.textContent = `${MAX_COMMENT_LENGTH}/${MAX_COMMENT_LENGTH}`;
        }
        
        // Emit typing event
        if (images.length > 0) {
            const currentImage = images[currentImageIndex];
            socket.emit('typing comment', {
                imageId: currentImage.id,
                username: currentUsername
            });
        }
    });

    // Auth functions
    signupBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            authError.textContent = 'Username and password are required';
            return;
        }
        
        socket.emit('signup', { username, password });
    });

    signinBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        if (!username || !password) {
            authError.textContent = 'Username and password are required';
            return;
        }
        
        socket.emit('signin', { username, password });
    });

    logoutBtn.addEventListener('click', () => {
        authContainer.style.display = 'flex';
        mainContainer.style.display = 'none';
        currentUsername = '';
        usernameInput.value = '';
        passwordInput.value = '';
        firedComments.clear(); // Clear fired comments when logging out
    });

    // Image navigation
    function showImage(index) {
        if (images.length === 0) {
            roastImage.src = 'placeholder.png';
            imageUploader.textContent = 'No images uploaded yet';
            imageTimestamp.textContent = '';
            return;
        }

        if (index >= images.length) index = 0;
        if (index < 0) index = images.length - 1;

        currentImageIndex = index;
        const image = images[index];
        
        roastImage.src = image.url;
        imageUploader.textContent = `Uploaded by: ${image.username}`;
        imageTimestamp.textContent = image.timestamp;
        
        // Load comments for this image
        socket.emit('get comments', image.id);
    }

    nextImageBtn.addEventListener('click', () => {
        showImage(currentImageIndex + 1);
    });

    // Swipe functionality
    roastImage.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    });

    roastImage.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;
        if (touchStartX - touchEndX > swipeThreshold) {
            // Swipe left
            showImage(currentImageIndex + 1);
        } else if (touchEndX - touchStartX > swipeThreshold) {
            // Swipe right
            showImage(currentImageIndex - 1);
        }
    }

    // Comments functionality
    commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const comment = commentInput.value.trim();
        
        if (comment && images.length > 0) {
            // Ensure comment is within character limit before submitting
            if (comment.length <= MAX_COMMENT_LENGTH) {
                const currentImage = images[currentImageIndex];
                socket.emit('add comment', {
                    imageId: currentImage.id,
                    comment: comment
                });
                commentInput.value = '';
                charCounterContainer.textContent = `0/${MAX_COMMENT_LENGTH}`;
                charCounterContainer.style.color = '#777';
            }
        }
    });

    // Function to handle fire button clicks
    function handleFireClick(commentId, fireButton) {
        if (!firedComments.has(commentId)) {
            const currentImage = images[currentImageIndex];
            socket.emit('fire comment', {
                commentId: commentId,
                imageId: currentImage.id
            });
            
            firedComments.add(commentId);
            fireButton.classList.add('fired');
            
            const countSpan = fireButton.querySelector('.fire-count');
            countSpan.textContent = parseInt(countSpan.textContent) + 1;
        }
    }

    // Upload functionality
    uploadBtn.addEventListener('click', () => {
        uploadModal.style.display = 'block';
    });

    closeModal.addEventListener('click', () => {
        uploadModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const file = imageInput.files[0];
        if (!file) {
            alert('Please select an image to upload');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            socket.emit('upload image', reader.result);
            uploadModal.style.display = 'none';
            imageInput.value = '';
        };
        reader.readAsDataURL(file);
    });

    // Socket event handlers
    socket.on('auth-success', (username) => {
        authContainer.style.display = 'none';
        mainContainer.style.display = 'flex';
        currentUsername = username;
        currentUserDisplay.textContent = `Logged in as: ${username}`;
        
        // Load images
        socket.emit('get images');
    });

    socket.on('auth-error', (message) => {
        authError.textContent = message;
    });

    socket.on('images', (imageData) => {
        images = imageData;
        showImage(0);
    });

    socket.on('new image', (image) => {
        images.push(image);
        // If this is the first image, show it
        if (images.length === 1) {
            showImage(0);
        }
    });

    socket.on('comments', (comments) => {
        commentsList.innerHTML = '';
        comments.forEach(comment => {
            const li = document.createElement('li');
            li.className = `comment ${comment.username === currentUsername ? 'my-comment' : 'other-user'}`;
            
            // Include fire count or initialize to 0 if it doesn't exist
            const fireCount = comment.fireCount || 0;
            const hasFired = firedComments.has(comment.id);
            
            li.innerHTML = `
                <div class="comment-content">
                    <div class="comment-text-container">
                        <span class="comment-user">${comment.username}:</span>
                        <span class="comment-text">${comment.text}</span>
                        <span class="comment-timestamp">${comment.timestamp}</span>
                    </div>
                    <button class="fire-button ${hasFired ? 'fired' : ''}" data-comment-id="${comment.id}">
                        🔥 <span class="fire-count">${fireCount}</span>
                    </button>
                </div>
            `;
            
            commentsList.appendChild(li);
            
            // Add event listener to the fire button
            const fireButton = li.querySelector('.fire-button');
            fireButton.addEventListener('click', () => {
                handleFireClick(comment.id, fireButton);
            });
        });
        
        commentsList.scrollTop = commentsList.scrollHeight;
    });

    socket.on('new comment', (comment) => {
        if (comment.imageId === images[currentImageIndex].id) {
            const li = document.createElement('li');
            li.className = `comment ${comment.username === currentUsername ? 'my-comment' : 'other-user'}`;
            
            // Initialize fire count to 0 for new comments
            li.innerHTML = `
                <div class="comment-content">
                    <div class="comment-text-container">
                        <span class="comment-user">${comment.username}:</span>
                        <span class="comment-text">${comment.text}</span>
                        <span class="comment-timestamp">${comment.timestamp}</span>
                    </div>
                    <button class="fire-button" data-comment-id="${comment.id}">
                        🔥 <span class="fire-count">${comment.fireCount || 0}</span>
                    </button>
                </div>
            `;
            
            commentsList.appendChild(li);
            
            // Add event listener to the fire button
            const fireButton = li.querySelector('.fire-button');
            fireButton.addEventListener('click', () => {
                handleFireClick(comment.id, fireButton);
            });
            
            commentsList.scrollTop = commentsList.scrollHeight;
        }
    });
    
    socket.on('comment fired', (data) => {
        // Update fire count in the UI when someone fires a comment
        const { commentId, fireCount } = data;
        const fireButton = document.querySelector(`.fire-button[data-comment-id="${commentId}"]`);
        
        if (fireButton) {
            const countSpan = fireButton.querySelector('.fire-count');
            countSpan.textContent = fireCount;
        }
    });
    
    socket.on('user typing', (data) => {
        if (data.imageId === images[currentImageIndex].id && data.username !== currentUsername) {
            typingIndicator.textContent = `${data.username} is typing...`;
            typingIndicator.style.display = 'block';
            
            // Clear typing indicator after 2 seconds of inactivity
            clearTimeout(window.typingTimeout);
            window.typingTimeout = setTimeout(() => {
                typingIndicator.style.display = 'none';
            }, 2000);
        }
    });
})