// Initialize AOS
AOS.init({
    duration: 800,
    once: true,
    offset: 100
});

// Get project ID from URL
const urlParams = new URLSearchParams(window.location.search);
const projectId = urlParams.get('id');

// Load project data
let currentProject = null;

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

// Load project data
async function loadProject() {
    if (!projectId) {
        showError();
        return;
    }
    
    currentProject = await APIService.getProject(projectId);
    
    if (!currentProject) {
        showError();
        return;
    }
    
    // Update page title
    document.title = `${currentProject.name} - CampaignHarvest`;
    
    // Update header
    document.getElementById('headerProjectName').textContent = currentProject.name;
    document.getElementById('projectTitle').textContent = currentProject.name;
    
    // Calculate metrics
    const metrics = calculateProjectMetrics();
    
    // Update timeline status
    const timelineStatus = document.getElementById('timelineStatus');
    const timelineLabel = document.getElementById('timelineLabel');
    
    const startDate = dayjs(currentProject.start_date);
    const today = dayjs();
    const daysElapsed = today.diff(startDate, 'day');
    
    if (currentProject.end_date) {
        const endDate = dayjs(currentProject.end_date);
        const totalDays = endDate.diff(startDate, 'day');
        const daysRemaining = endDate.diff(today, 'day');
        
        if (daysRemaining > 0) {
            const currentWeek = Math.ceil(daysElapsed / 7);
            const totalWeeks = Math.ceil(totalDays / 7);
            timelineStatus.textContent = `Week ${currentWeek} of ${totalWeeks}`;
            timelineLabel.textContent = `${daysRemaining} days remaining`;
        } else if (daysRemaining === 0) {
            timelineStatus.textContent = 'Due Today';
            timelineLabel.textContent = 'Project deadline';
        } else {
            timelineStatus.textContent = 'Overdue';
            timelineLabel.textContent = `${Math.abs(daysRemaining)} days overdue`;
        }
    } else {
        // For monthly retainer projects without end date
        const currentWeek = Math.ceil(daysElapsed / 7);
        timelineStatus.textContent = `Week ${currentWeek}`;
        timelineLabel.textContent = 'Ongoing project';
    }
    
    // Update progress
    const progress = calculateProjectProgress();
    document.getElementById('progressPercentage').textContent = `${progress}%`;
    const progressBar = document.getElementById('progressBar');
    
    // Set progress bar width
    progressBar.style.width = `${progress}%`;
    
    // Update budget (hide if not available)
    const budgetContainer = document.getElementById('budgetStatus').parentElement.parentElement;
    if (currentProject.budget !== undefined) {
        document.getElementById('budgetStatus').textContent = `₹${currentProject.budget.toLocaleString('en-IN')}`;
        document.getElementById('budgetLabel').textContent = currentProject.project_type === 'retainer' ? 'monthly budget' : 'allocated budget';
        budgetContainer.style.display = 'block';
    } else {
        budgetContainer.style.display = 'none';
    }
    
    // Update team size
    document.getElementById('teamSize').textContent = currentProject.team_size;
    
    // Update project status
    updateProjectStatus(currentProject.status);
    
    // Load milestones
    loadMilestones();
    
    // Load messages
    loadMessages();
}

// Calculate project progress
function calculateProjectProgress() {
    if (!currentProject.milestones || currentProject.milestones.length === 0) return 0;
    
    const completed = currentProject.milestones.filter(m => m.status === 'completed').length;
    return Math.round((completed / currentProject.milestones.length) * 100);
}

// Calculate project metrics
function calculateProjectMetrics() {
    const startDate = dayjs(currentProject.start_date);
    const today = dayjs();
    const daysElapsed = today.diff(startDate, 'day');
    
    if (currentProject.end_date) {
        const endDate = dayjs(currentProject.end_date);
        const totalDays = endDate.diff(startDate, 'day');
        const daysRemaining = endDate.diff(today, 'day');
        const progress = Math.round((daysElapsed / totalDays) * 100);
        
        return {
            progress: Math.min(100, Math.max(0, progress)),
            daysRemaining,
            totalDays,
            daysElapsed
        };
    } else {
        // For ongoing projects without end date
        return {
            progress: 0, // Progress is based on milestones for ongoing projects
            daysRemaining: null,
            totalDays: null,
            daysElapsed
        };
    }
}

// Update project status indicator
function updateProjectStatus(status) {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    const statusConfig = {
        'on-track': { color: '#10B981', text: 'On Track' },
        'at-risk': { color: '#F59E0B', text: 'At Risk' },
        'delayed': { color: '#EF4444', text: 'Delayed' },
        'completed': { color: '#3B82F6', text: 'Completed' }
    };
    
    const config = statusConfig[status] || statusConfig['on-track'];
    statusIndicator.style.backgroundColor = config.color;
    statusText.textContent = config.text;
    
    // Update animation
    if (status !== 'completed') {
        statusIndicator.style.animation = 'pulse 2s infinite';
    }
}

// Load milestones
function loadMilestones() {
    const container = document.getElementById('milestones-container');
    container.innerHTML = '';
    
    if (!currentProject.milestones || currentProject.milestones.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="mb-3 opacity-50">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p>No milestones have been set for this project yet.</p>
            </div>
        `;
        return;
    }
    
    // Sort milestones by date
    const sortedMilestones = [...currentProject.milestones].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Create Bootstrap accordion
    const accordionId = 'milestoneAccordion';
    const accordionDiv = document.createElement('div');
    accordionDiv.className = 'accordion';
    accordionDiv.id = accordionId;
    
    sortedMilestones.forEach((milestone, index) => {
        const milestoneEl = createMilestoneElement(milestone, index, accordionId);
        accordionDiv.appendChild(milestoneEl);
    });
    
    container.appendChild(accordionDiv);
    
    // Show the expand/collapse controls
    const controls = document.getElementById('milestoneControls');
    if (controls && sortedMilestones.length > 0) {
        controls.style.display = 'block';
    }
    
    // Set up expand/collapse all functionality
    setupMilestoneControls(accordionId);
}

// Create milestone element
function createMilestoneElement(milestone, index, accordionId) {
    const div = document.createElement('div');
    div.className = 'accordion-item';
    const collapseId = `collapse${index}`;
    const headerId = `heading${index}`;
    
    // Determine status badge class and text
    const statusClass = milestone.status === 'completed' ? 'bg-success' : 
                       milestone.status === 'current' ? 'bg-primary' : 
                       'bg-secondary';
    const statusText = milestone.status.replace('-', ' ');
    
    div.innerHTML = `
        <h2 class="accordion-header" id="${headerId}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" 
                    data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                <div class="d-flex justify-content-between align-items-center w-100 me-3">
                    <div>
                        <div class="d-flex align-items-center gap-3 mb-1">
                            <span class="milestone-title">${milestone.title}</span>
                            <span class="badge ${statusClass} text-capitalize">${statusText}</span>
                        </div>
                        <div class="text-muted small">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" class="me-1">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            ${formatDate(milestone.date)}
                        </div>
                    </div>
                </div>
            </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse" 
             aria-labelledby="${headerId}" data-bs-parent="#${accordionId}">
            <div class="accordion-body">
                ${milestone.description ? escapeHtml(milestone.description) : '<em class="text-muted">No description available</em>'}
            </div>
        </div>
    `;
    
    return div;
}

// Set up expand/collapse all controls
function setupMilestoneControls(accordionId) {
    const expandAllBtn = document.getElementById('expandAllBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const accordion = document.getElementById(accordionId);
    
    if (!expandAllBtn || !collapseAllBtn || !accordion) return;
    
    expandAllBtn.addEventListener('click', () => {
        const collapseElements = accordion.querySelectorAll('.accordion-collapse');
        collapseElements.forEach(element => {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(element);
            bsCollapse.show();
        });
    });
    
    collapseAllBtn.addEventListener('click', () => {
        const collapseElements = accordion.querySelectorAll('.accordion-collapse');
        collapseElements.forEach(element => {
            const bsCollapse = bootstrap.Collapse.getOrCreateInstance(element);
            bsCollapse.hide();
        });
    });
}

// Load messages
function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    if (!currentProject.messages || currentProject.messages.length === 0) {
        messagesList.innerHTML = `
            <div class="empty-messages">
                <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                </svg>
                <p>No messages yet. Be the first to ask a question!</p>
            </div>
        `;
        return;
    }
    
    currentProject.messages.forEach(message => {
        const messageEl = createMessageElement(message);
        messagesList.appendChild(messageEl);
    });
    
    // Scroll to bottom
    messagesList.scrollTop = messagesList.scrollHeight;
}

// Create message element
function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = message.is_admin ? 'message admin-reply' : 'message';
    
    const authorClass = message.is_admin ? 'admin' : '';
    
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

async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;
    
    // Create new message
    const newMessage = {
        id: generateId(),
        author: "Client",
        role: "client",
        content: content,
        timestamp: new Date().toISOString(),
        is_admin: false
    };
    
    try {
        await APIService.createMessage(projectId, newMessage);
        
        // Reload project to get updated messages
        await loadProject();
        
        // Clear input
        messageInput.value = '';
        
        // Show success notification
        showNotification('Message sent! You\'ll receive a response soon.');
    } catch (error) {
        showNotification('Failed to send message', 'error');
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        background: ${type === 'success' ? 'var(--primary-gradient)' : '#EF4444'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: var(--shadow-lg);
        z-index: 1000;
        opacity: 0;
        transform: translateY(1rem);
    `;
    
    document.body.appendChild(notification);
    
    // Show notification
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(1rem)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Utility functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Escape HTML to prevent XSS while preserving whitespace
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format description text with proper line breaks and styling
function formatDescription(text) {
    if (!text) return '';
    
    // Escape HTML first
    let formatted = escapeHtml(text);
    
    // Convert line breaks to <br> tags
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Process line by line for better formatting
    const lines = formatted.split('<br>');
    formatted = lines.map((line, index) => {
        // Skip empty lines
        if (!line.trim()) return '';
        
        // Headers (lines ending with colon)
        if (line.trim().endsWith(':') && line.trim().length < 50) {
            return `<strong class="milestone-header">${line}</strong>`;
        }
        
        // Lines starting with space or tab are list items
        if (line.match(/^\s+/)) {
            const trimmed = line.trim();
            return `<div class="milestone-list-item">• ${trimmed}</div>`;
        }
        
        return line;
    }).filter(line => line !== '').join('<br>');
    
    return formatted;
}

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

function showError() {
    document.getElementById('errorState').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
    
    // Update the back link in error state to go to admin
    const errorBackLink = document.querySelector('#errorState a');
    if (errorBackLink) {
        errorBackLink.href = '/admin';
        errorBackLink.textContent = 'Go to Admin Dashboard';
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
            // Add fade-in class instead of GSAP
            entry.target.classList.add('fade-in');
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
    // Check if Bootstrap is loaded
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded!');
    } else {
        console.log('Bootstrap version:', bootstrap.Collapse.VERSION);
    }
    
    loadProject();
    
    // Header is visible immediately
    console.log('Project page loaded successfully');
    
    // Initialize audit logs toggle
    initializeAuditLogs();
});

// Audit Logs Functionality
let auditLogsLoaded = false;

function initializeAuditLogs() {
    const toggleBtn = document.getElementById('toggleAuditLogsBtn');
    const container = document.getElementById('auditLogsContainer');
    const toggleText = toggleBtn.querySelector('.toggle-text');
    
    if (toggleBtn && container) {
        toggleBtn.addEventListener('click', () => {
            const isVisible = container.style.display !== 'none';
            
            if (isVisible) {
                // Hide audit logs
                container.style.display = 'none';
                toggleBtn.classList.remove('expanded');
                toggleText.textContent = 'Show Activity Log';
            } else {
                // Show audit logs
                container.style.display = 'block';
                toggleBtn.classList.add('expanded');
                toggleText.textContent = 'Hide Activity Log';
                
                // Load audit logs if not already loaded
                if (!auditLogsLoaded) {
                    loadAuditLogs();
                }
            }
        });
    }
}

async function loadAuditLogs() {
    const loadingEl = document.getElementById('auditLogsLoading');
    const listEl = document.getElementById('auditLogsList');
    const emptyEl = document.getElementById('auditLogsEmpty');
    
    // Show loading state
    loadingEl.style.display = 'flex';
    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    try {
        const response = await fetch(`/api/projects/${currentProjectId}/audit-logs`);
        
        if (!response.ok) {
            throw new Error('Failed to load audit logs');
        }
        
        const auditLogs = await response.json();
        auditLogsLoaded = true;
        
        // Hide loading state
        loadingEl.style.display = 'none';
        
        if (auditLogs.length === 0) {
            emptyEl.style.display = 'flex';
        } else {
            displayAuditLogs(auditLogs);
            listEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading audit logs:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'flex';
        emptyEl.querySelector('p').textContent = 'Failed to load activity log. Please try again.';
    }
}

function displayAuditLogs(auditLogs) {
    const listEl = document.getElementById('auditLogsList');
    
    listEl.innerHTML = auditLogs.map(log => {
        const timestamp = dayjs(log.timestamp).format('MMM D, YYYY h:mm A');
        const relativeTime = dayjs(log.timestamp).fromNow();
        
        return `
            <div class="audit-log-item">
                <div class="audit-log-icon ${log.action.toLowerCase()}">
                    ${getAuditLogIcon(log.action)}
                </div>
                <div class="audit-log-content">
                    <div class="audit-log-header">
                        <div>
                            <div class="audit-log-action">${formatAuditAction(log)}</div>
                            <div class="audit-log-user">by ${log.user_name} (${log.user_role})</div>
                        </div>
                        <div class="audit-log-timestamp" title="${timestamp}">
                            ${relativeTime}
                        </div>
                    </div>
                    ${log.old_values || log.new_values ? createChangesSection(log) : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Add click handlers for change details
    addChangeDetailsHandlers();
}

function getAuditLogIcon(action) {
    const icons = {
        'created': '+',
        'updated': '✓',
        'deleted': '×'
    };
    return icons[action.toLowerCase()] || '•';
}

function formatAuditAction(log) {
    const entity = log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1);
    const action = log.action.toLowerCase();
    
    switch (action) {
        case 'created':
            return `Created ${entity.toLowerCase()}`;
        case 'updated':
            return `Updated ${entity.toLowerCase()}`;
        case 'deleted':
            return `Deleted ${entity.toLowerCase()}`;
        default:
            return `${action.charAt(0).toUpperCase() + action.slice(1)} ${entity.toLowerCase()}`;
    }
}

function createChangesSection(log) {
    if (!log.old_values && !log.new_values) return '';
    
    const logId = `changes-${log.id}`;
    
    return `
        <div class="audit-log-changes">
            <a href="#" class="audit-log-changes-toggle" data-target="${logId}">
                View changes
            </a>
            <div class="audit-log-changes-details" id="${logId}">
                ${formatChanges(log.old_values, log.new_values)}
            </div>
        </div>
    `;
}

function formatChanges(oldValues, newValues) {
    try {
        const oldData = oldValues ? JSON.parse(oldValues) : {};
        const newData = newValues ? JSON.parse(newValues) : {};
        
        const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
        
        return Array.from(allKeys).map(key => {
            const oldValue = oldData[key];
            const newValue = newData[key];
            
            if (oldValue === newValue) return '';
            
            const fieldName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            return `
                <div class="audit-log-change-item">
                    <div class="audit-log-change-field">${fieldName}:</div>
                    <div class="audit-log-change-values">
                        ${oldValue !== undefined ? `<div class="audit-log-old-value">${formatValue(oldValue)}</div>` : ''}
                        ${newValue !== undefined ? `<div class="audit-log-new-value">${formatValue(newValue)}</div>` : ''}
                    </div>
                </div>
            `;
        }).filter(item => item).join('');
    } catch (error) {
        console.error('Error formatting changes:', error);
        return '<div class="audit-log-change-item">Unable to display changes</div>';
    }
}

function formatValue(value) {
    if (value === null || value === undefined) return 'None';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && value.includes('T') && value.includes(':')) {
        // Looks like a date
        try {
            return dayjs(value).format('MMM D, YYYY');
        } catch {
            return value;
        }
    }
    return String(value);
}

function addChangeDetailsHandlers() {
    document.querySelectorAll('.audit-log-changes-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = toggle.dataset.target;
            const details = document.getElementById(targetId);
            
            if (details) {
                details.classList.toggle('show');
                toggle.textContent = details.classList.contains('show') ? 'Hide changes' : 'View changes';
            }
        });
    });
}