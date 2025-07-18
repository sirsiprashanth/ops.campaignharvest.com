// Initialize AOS
AOS.init({
    duration: 800,
    once: true,
    offset: 100
});

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const sunIcon = themeToggle.querySelector('.sun-icon');
const moonIcon = themeToggle.querySelector('.moon-icon');

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    
    if (isDark) {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
        localStorage.setItem('theme', 'dark');
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
        localStorage.setItem('theme', 'light');
    }
});

// Load project data and update UI
function loadProjectData() {
    const metrics = calculateProjectMetrics();
    
    // Update timeline status
    document.getElementById('timelineStatus').textContent = `Week ${projectData.currentWeek} of ${projectData.totalWeeks}`;
    document.querySelector('.stat-card:nth-child(1) .stat-label').textContent = `${metrics.weeksRemaining} weeks remaining`;
    
    // Update progress
    document.getElementById('progressPercentage').textContent = `${metrics.progress}%`;
    const progressBar = document.getElementById('progressBar');
    
    // Animate progress bar with GSAP
    gsap.to(progressBar, {
        width: `${metrics.progress}%`,
        duration: 1.5,
        ease: "power2.out",
        delay: 0.5
    });
    
    // Update budget
    const budgetStatus = document.getElementById('budgetStatus');
    budgetStatus.textContent = `₹${projectData.budget.spent.toLocaleString('en-IN')}`;
    
    // Update project status
    updateProjectStatus(projectData.status);
    
    // Load milestones
    loadMilestones();
    
    // Load messages
    loadMessages();
}

// Update project status indicator
function updateProjectStatus(status) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    const statusConfig = {
        'on-track': { color: '#10B981', text: 'On Track' },
        'at-risk': { color: '#F59E0B', text: 'At Risk' },
        'delayed': { color: '#EF4444', text: 'Delayed' }
    };
    
    const config = statusConfig[status];
    statusIndicator.style.backgroundColor = config.color;
    statusText.textContent = config.text;
    
    // Update animation
    statusIndicator.style.animation = 'none';
    setTimeout(() => {
        statusIndicator.style.animation = 'pulse 2s infinite';
    }, 10);
}

// Load milestones to timeline
function loadMilestones() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    
    projectData.milestones.forEach((milestone, index) => {
        const milestoneEl = createMilestoneElement(milestone, index);
        timeline.appendChild(milestoneEl);
    });
    
    // Animate milestones
    gsap.from('.milestone', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.8,
        ease: "back.out(1.7)"
    });
}

// Create milestone element
function createMilestoneElement(milestone, index) {
    const div = document.createElement('div');
    div.className = `milestone ${milestone.status}`;
    
    div.innerHTML = `
        <div class="milestone-dot"></div>
        <div class="milestone-content">
            <div class="milestone-title">${milestone.title}</div>
            <div class="milestone-date">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${formatDate(milestone.date)}
            </div>
        </div>
        ${milestone.description ? `
        <div class="milestone-tooltip">
            <div class="milestone-tooltip-title">${milestone.title}</div>
            <div class="milestone-tooltip-date">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${formatDate(milestone.date)}
            </div>
            <div class="milestone-tooltip-description">${milestone.description}</div>
        </div>
        ` : ''}
    `;
    
    // Add hover effect
    div.addEventListener('mouseenter', () => {
        gsap.to(div.querySelector('.milestone-dot'), {
            scale: 1.2,
            duration: 0.3,
            ease: "power2.out"
        });
    });
    
    div.addEventListener('mouseleave', () => {
        gsap.to(div.querySelector('.milestone-dot'), {
            scale: 1,
            duration: 0.3,
            ease: "power2.out"
        });
    });
    
    return div;
}

// Load messages
function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    projectData.messages.forEach(message => {
        const messageEl = createMessageElement(message);
        messagesList.appendChild(messageEl);
    });
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'message';
    
    const authorClass = message.isAdmin ? 'admin' : '';
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-author ${authorClass}">${message.author}</span>
            <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="message-content">${message.content}</div>
    `;
    
    return div;
}

// Message input handling
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;
    
    // Create new message
    const newMessage = {
        id: projectData.messages.length + 1,
        author: "You",
        role: "client",
        content: content,
        timestamp: new Date().toISOString(),
        isAdmin: false
    };
    
    // Add to data
    projectData.messages.push(newMessage);
    
    // Add to UI with animation
    const messagesList = document.getElementById('messagesList');
    const messageEl = createMessageElement(newMessage);
    messageEl.style.opacity = '0';
    messagesList.appendChild(messageEl);
    
    // Animate
    gsap.to(messageEl, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out"
    });
    
    // Clear input
    messageInput.value = '';
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
    
    // Simulate admin response after delay
    setTimeout(() => {
        simulateAdminResponse();
    }, 2000);
}

// Simulate admin response
function simulateAdminResponse() {
    const responses = [
        "Thank you for your message. I'll look into this and get back to you shortly.",
        "Great question! Let me gather the information and provide you with a detailed response.",
        "I understand your concern. We're working on addressing this right away.",
        "Thanks for bringing this to our attention. The team is on it!",
        "Excellent point! We'll incorporate this feedback into our next sprint."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    const adminMessage = {
        id: projectData.messages.length + 1,
        author: "Sarah Johnson",
        role: "admin",
        content: randomResponse,
        timestamp: new Date().toISOString(),
        isAdmin: true
    };
    
    projectData.messages.push(adminMessage);
    
    const messagesList = document.getElementById('messagesList');
    const messageEl = createMessageElement(adminMessage);
    messageEl.style.opacity = '0';
    messagesList.appendChild(messageEl);
    
    gsap.to(messageEl, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out"
    });
    
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Utility functions
function formatDate(dateString) {
    return dayjs(dateString).format('MMM DD, YYYY');
}

function formatTime(timestamp) {
    const date = dayjs(timestamp);
    const now = dayjs();
    
    if (date.isSame(now, 'day')) {
        return date.format('h:mm A');
    } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
        return 'Yesterday ' + date.format('h:mm A');
    } else {
        return date.format('MMM DD, h:mm A');
    }
}

// Animate stat cards on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            gsap.from(entry.target, {
                y: 30,
                opacity: 0,
                duration: 0.8,
                ease: "power2.out"
            });
            observer.unobserve(entry.target);
        }
    });
}, observerOptions);

// Observe stat cards
document.querySelectorAll('.stat-card').forEach(card => {
    observer.observe(card);
});

// Initialize on load
window.addEventListener('load', () => {
    loadProjectData();
    
    // Add entrance animation for header
    gsap.from('.header', {
        y: -100,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    });
});

// Add smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});