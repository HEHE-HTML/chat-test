document.addEventListener('DOMContentLoaded', () => {

    const socket = io();

    // DOM Elements
    // Ping function to keep connection alive
    function startPing() {
        setInterval(() => {
            fetch('/ping')
                .then(response => {
                    if (!response.ok) {
                        console.error('Ping failed:', response.status);
                    }
                })
                .catch(error => {
                    console.error('Error during ping:', error);
                });
        }, 5 * 60 * 500); // Ping every 5 minutes
    }

    startPing(); // Start the pinging process

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
    const submitImageBtn = document.getElementById('submit-image');

    // Create notification container and add to body
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    document.body.appendChild(notificationContainer);

    // App state
    let userStats = {
        imagesUploaded: 0,
        commentsPosted: 0,
        firesReceived: 0,
        firesGiven: 0
    };
    let userBadges = [];

    // Define available badges
    const availableBadges = [
        { 
            id: 'first-upload', 
            name: 'First Blood', 
            description: 'Upload your first image', 
            icon: '🔥',
            condition: stats => stats.imagesUploaded >= 1
        },
        { 
            id: 'roast-master', 
            name: 'Roast Master', 
            description: 'Post 10 comments', 
            icon: '🎯',
            condition: stats => stats.commentsPosted >= 10
        },
        { 
            id: 'fire-starter', 
            name: 'Fire Starter', 
            description: 'Give 5 fire reactions', 
            icon: '⚡',
            condition: stats => stats.firesGiven >= 5
        },
        { 
            id: 'popular-beef', 
            name: 'Popular Beef', 
            description: 'Receive 10 fire reactions on your comments', 
            icon: '✨',
            condition: stats => stats.firesReceived >= 10
        },
        { 
            id: 'content-creator', 
            name: 'Content Creator', 
            description: 'Upload 5 images', 
            icon: '📸',
            condition: stats => stats.imagesUploaded >= 5
        }
    ];

    let currentUsername = '';
    let images = [];
    let currentImageIndex = 0;
    let touchStartX = 0;
    let touchEndX = 0;
    let firedComments = new Set(); // Track which comments the user has "fired"
    let myImages = new Set(); // Track images uploaded by current user

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

    // Detect if running on mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Set appropriate attributes for mobile vs desktop
    if (isMobile) {
        imageInput.setAttribute('accept', 'image/*');
        imageInput.setAttribute('capture', 'environment'); // This specifies rear camera on mobile devices
    } else {
        imageInput.setAttribute('accept', 'image/*');
        // No capture attribute for desktop to ensure file browser opens
    }

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

    // Notification function
    function showNotification(title, message, imageId, commentId) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.dataset.imageId = imageId;
        notification.dataset.commentId = commentId;
        
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
            <span class="notification-close">&times;</span>
        `;
        
        notificationContainer.appendChild(notification);
        
        // Add click event to navigate to image
        notification.addEventListener('click', (e) => {
            if (!e.target.classList.contains('notification-close')) {
                // Find index of the image
                const targetIndex = images.findIndex(img => img.id === imageId);
                if (targetIndex !== -1) {
                    showImage(targetIndex);
                    
                    // Highlight the comment
                    setTimeout(() => {
                        const commentElement = document.querySelector(`.comment [data-comment-id="${commentId}"]`);
                        if (commentElement) {
                            const parentLi = commentElement.closest('.comment');
                            parentLi.style.backgroundColor = '#382828';
                            parentLi.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Remove highlight after a moment
                            setTimeout(() => {
                                if (parentLi.classList.contains('my-comment')) {
                                    parentLi.style.backgroundColor = '#2d2d2d';
                                } else {
                                    parentLi.style.backgroundColor = '#252525';
                                }
                            }, 2000);
                        }
                    }, 300);
                }
                
                // Remove notification
                notification.remove();
            }
        });
        
        // Add click event to close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

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
        myImages.clear(); // Clear tracked images when logging out
        
        // Clear any notifications
        notificationContainer.innerHTML = '';
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
        
        // On mobile, we'll add a direct camera button
        if (isMobile && !document.getElementById('take-photo-btn')) {
            const uploadForm = document.getElementById('upload-form');
            const cameraButton = document.createElement('button');
            cameraButton.id = 'take-photo-btn';
            cameraButton.className = 'red-button';
            cameraButton.type = 'button';
            cameraButton.textContent = '📷 Take Photo';
            cameraButton.style.marginRight = '10px';
            cameraButton.addEventListener('click', (e) => {
                e.preventDefault();
                imageInput.setAttribute('capture', 'environment');
                imageInput.click();
            });
            
            const galleryButton = document.createElement('button');
            galleryButton.id = 'gallery-btn';
            galleryButton.className = 'red-button';
            galleryButton.type = 'button';
            galleryButton.textContent = '📁 From Gallery';
            galleryButton.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove capture attribute to open gallery instead of camera
                imageInput.removeAttribute('capture');
                imageInput.click();
            });
            
            // Clear previous buttons if they exist
            const existingButtons = uploadForm.querySelectorAll('button:not(#submit-image)');
            existingButtons.forEach(btn => btn.remove());
            
            // Add buttons to form
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'button-container';
            buttonContainer.appendChild(cameraButton);
            buttonContainer.appendChild(galleryButton);
            
            // Insert before the upload button
            uploadForm.insertBefore(buttonContainer, submitImageBtn);
            
            // Hide the regular submit button on mobile
            submitImageBtn.style.display = 'none';
        }
    });

    closeModal.addEventListener('click', () => {
        uploadModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === uploadModal) {
            uploadModal.style.display = 'none';
        }
    });

    // Also add a change listener to automatically submit once a file is selected
    imageInput.addEventListener('change', (e) => {
        if (imageInput.files.length > 0) {
            handleFileUpload();
        }
    });
    
    // Extract file upload logic to a separate function - MODIFIED to improve mobile handling
    function handleFileUpload() {
        const file = imageInput.files[0];
        if (!file) {
            alert('Please select an image to upload');
            return;
        }
        
        // Add file type validation
        if (!file.type.match('image.*')) {
            alert('Please select an image file (JPEG, PNG, etc.)');
            return;
        }
        
        // Show loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<p>Uploading your image...</p><div class="spinner"></div>';
        document.body.appendChild(loadingIndicator);
        
        // For mobile photos, check if we need to resize (optional but helps with large camera photos)
        const maxDimension = 1200; // Reasonable max dimension that won't cause issues
        
        // Create an image element to check dimensions and potentially resize
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Resize if necessary (for very large camera photos)
            if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                    height = Math.round(height * (maxDimension / width));
                    width = maxDimension;
                } else {
                    width = Math.round(width * (maxDimension / height));
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get the resized image as a data URL
                const resizedDataURL = canvas.toDataURL(file.type || 'image/jpeg', 0.85);
                
                // Upload the resized image
                socket.emit('upload image', resizedDataURL);
                uploadModal.style.display = 'none';
            } else {
                // If no resize needed, just use the original reader result
                readAndUploadImage(file);
            }
            
            // Reset form and clean up
            imageInput.value = '';
            URL.revokeObjectURL(objectURL);
        };
        
        // Handle errors in image loading
        img.onerror = function() {
            console.error('Error loading image for processing');
            readAndUploadImage(file); // Fall back to regular upload
            URL.revokeObjectURL(objectURL);
        };
        
        // Load image from file for processing
        const objectURL = URL.createObjectURL(file);
        img.src = objectURL;
        
        // Helper function to read and upload unmodified image
        function readAndUploadImage(file) {
            const reader = new FileReader();
            
            reader.onload = function(event) {
                try {
                    socket.emit('upload image', event.target.result);
                    uploadModal.style.display = 'none';
                } catch (error) {
                    console.error('Upload error:', error);
                    alert('Error uploading image. Please try again.');
                    loadingIndicator.remove();
                }
            };
            
            reader.onerror = function() {
                console.error('FileReader error:', reader.error);
                alert('Error reading file. Please try again.');
                loadingIndicator.remove();
            };
            
            reader.readAsDataURL(file);
        }
    }

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
        
        // Track which images were uploaded by current user
        myImages.clear();
        images.forEach(image => {
            if (image.username === currentUsername) {
                myImages.add(image.id);
            }
        });
        
        showImage(0);
    });

    socket.on('new image', (image) => {
        images.push(image);
        
        // Track if this is my image
        if (image.username === currentUsername) {
            myImages.add(image.id);
        }
        
        // If this is the first image, show it
        if (images.length === 1) {
            showImage(0);
        }
        
        // Remove loading indicator if it exists
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    });

    socket.on('upload error', (message) => {
        alert(`Upload failed: ${message}`);
        
        // Remove loading indicator if it exists
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
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
        // Check if this comment is on one of my images (for notifications)
        const isMyImage = myImages.has(comment.imageId);
        const isMyComment = comment.username === currentUsername;
        
        // Show notification if it's my image but not my comment
        if (isMyImage && !isMyComment) {
            const commentPreview = comment.text.length > 30 ? 
                `${comment.text.substring(0, 30)}...` : comment.text;
            
            showNotification(
                `New Roast!`, 
                `${comment.username} said: "${commentPreview}"`, 
                comment.imageId,
                comment.id
            );
        }
        
        // Add comment to list if it's for the current image
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
    
    // Touch-specific behavior for upload button
    uploadBtn.addEventListener('touchstart', () => {
        uploadBtn.classList.add('pressed');
    });
    
    uploadBtn.addEventListener('touchend', () => {
        uploadBtn.classList.remove('pressed');
    });
});