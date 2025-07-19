// Client Dashboard JavaScript
let currentProject = null;

// API Service for client
const clientAPI = {
    async request(url, options = {}) {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(url, {
            ...options,
            headers
        });
        
        return response;
    },
    
    get(url) {
        return this.request(url, { method: 'GET' });
    },
    
    post(url, data) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// Load client projects
async function loadProjects() {
    const container = document.getElementById('projectsContainer');
    const noProjectsMessage = document.getElementById('noProjectsMessage');
    
    try {
        container.innerHTML = '<div class="loading"></div>';
        
        const response = await clientAPI.get('/api/projects');
        
        if (response.ok) {
            const projects = await response.json();
            
            if (projects.length === 0) {
                container.innerHTML = '';
                noProjectsMessage.style.display = 'block';
            } else {
                noProjectsMessage.style.display = 'none';
                displayProjects(projects);
            }
        } else {
            throw new Error('Failed to load projects');
        }
    } catch (error) {
        console.error('Error loading projects:', error);
        container.innerHTML = '<p style="text-align: center; color: var(--danger);">Error loading projects. Please try again.</p>';
    }
}

// Display projects
function displayProjects(projects) {
    const container = document.getElementById('projectsContainer');
    
    container.innerHTML = projects.map(project => {
        const progress = calculateProgress(project.milestones || []);
        const totalMilestones = project.milestones_count || 0;
        const messageCount = project.messages_count || 0;
        
        return `
            <div class="project-card" onclick="openProject('${project.id}')">
                <div class="project-header">
                    <div>
                        <h3 class="project-title">${project.name}</h3>
                        <span class="project-status ${project.status}">${formatStatus(project.status)}</span>
                    </div>
                </div>
                
                <div class="project-meta">
                    <div class="project-meta-item">
                        <span class="project-meta-label">Progress</span>
                        <span class="project-meta-value">${progress}%</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Milestones</span>
                        <span class="project-meta-value">${totalMilestones}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Messages</span>
                        <span class="project-meta-value">${messageCount}</span>
                    </div>
                    <div class="project-meta-item">
                        <span class="project-meta-label">Priority</span>
                        <span class="project-meta-value">${formatPriority(project.priority)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Calculate project progress
function calculateProgress(milestones) {
    if (!milestones || milestones.length === 0) return 0;
    
    const completed = milestones.filter(m => m.status === 'completed').length;
    return Math.round((completed / milestones.length) * 100);
}

// Format status
function formatStatus(status) {
    const statusMap = {
        'on-track': 'On Track',
        'at-risk': 'At Risk',
        'delayed': 'Delayed',
        'completed': 'Completed'
    };
    return statusMap[status] || status;
}

// Format priority
function formatPriority(priority) {
    const priorityMap = {
        'converted': 'Active',
        'pipeline': 'Pipeline'
    };
    return priorityMap[priority] || priority;
}

// Open project details
async function openProject(projectId) {
    currentProject = projectId;
    
    try {
        const response = await clientAPI.get(`/api/projects/${projectId}`);
        
        if (response.ok) {
            const project = await response.json();
            displayProjectDetails(project);
            document.getElementById('projectModal').classList.add('show');
        } else {
            throw new Error('Failed to load project details');
        }
    } catch (error) {
        console.error('Error loading project details:', error);
        showToast('Error loading project details', 'error');
    }
}

// Display project details in modal
function displayProjectDetails(project) {
    document.getElementById('projectModalTitle').textContent = project.name;
    
    // Project info
    const projectInfo = document.getElementById('projectInfo');
    const startDate = project.start_date ? dayjs(project.start_date).format('MMM D, YYYY') : 'Not set';
    const endDate = project.end_date ? dayjs(project.end_date).format('MMM D, YYYY') : 'Not set';
    
    projectInfo.innerHTML = `
        <div class="project-info-grid">
            <div class="project-info-item">
                <div class="project-info-label">Status</div>
                <div class="project-info-value">
                    <span class="project-status ${project.status}">${formatStatus(project.status)}</span>
                </div>
            </div>
            <div class="project-info-item">
                <div class="project-info-label">Priority</div>
                <div class="project-info-value">${formatPriority(project.priority)}</div>
            </div>
            <div class="project-info-item">
                <div class="project-info-label">Start Date</div>
                <div class="project-info-value">${startDate}</div>
            </div>
            <div class="project-info-item">
                <div class="project-info-label">End Date</div>
                <div class="project-info-value">${endDate}</div>
            </div>
            <div class="project-info-item">
                <div class="project-info-label">Team Size</div>
                <div class="project-info-value">${project.team_size || 'Not specified'}</div>
            </div>
            <div class="project-info-item">
                <div class="project-info-label">Project Type</div>
                <div class="project-info-value">${project.project_type || 'Not specified'}</div>
            </div>
        </div>
    `;
    
    // Milestones
    displayMilestones(project.milestones || []);
    
    // Messages
    displayMessages(project.messages || []);
    
    // Initialize audit logs
    initializeAuditLogs();
}

// Display milestones
function displayMilestones(milestones) {
    const container = document.getElementById('milestonesContainer');
    
    if (milestones.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No milestones yet</p>';
        return;
    }
    
    // Sort milestones by date
    const sortedMilestones = milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    container.innerHTML = sortedMilestones.map(milestone => `
        <div class="milestone-item">
            <div class="milestone-icon ${milestone.status}">
                ${getMilestoneIcon(milestone.status)}
            </div>
            <div class="milestone-content">
                <div class="milestone-title">${milestone.title}</div>
                <div class="milestone-date">${dayjs(milestone.date).format('MMM D, YYYY')}</div>
                <div class="milestone-description">${milestone.description || ''}</div>
            </div>
        </div>
    `).join('');
}

// Get milestone icon
function getMilestoneIcon(status) {
    const icons = {
        upcoming: '○',
        current: '◐',
        completed: '●'
    };
    return icons[status] || '○';
}

// Display messages
function displayMessages(messages) {
    const container = document.getElementById('messagesContainer');
    
    if (messages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No messages yet</p>';
        return;
    }
    
    // Sort messages by timestamp (newest first)
    const sortedMessages = messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    container.innerHTML = sortedMessages.map(message => `
        <div class="message-item">
            <div class="message-header">
                <div class="message-author">${message.author} ${message.is_admin ? '(Team)' : ''}</div>
                <div class="message-date">${dayjs(message.timestamp).format('MMM D, YYYY h:mm A')}</div>
            </div>
            <div class="message-content">${message.content}</div>
        </div>
    `).join('');
}

// Send message
async function sendMessage(event) {
    event.preventDefault();
    
    const content = document.getElementById('messageContent').value.trim();
    if (!content || !currentProject) return;
    
    try {
        const response = await clientAPI.post(`/api/projects/${currentProject}/messages`, {
            content: content
        });
        
        if (response.ok) {
            document.getElementById('messageContent').value = '';
            showToast('Message sent successfully', 'success');
            
            // Reload project details to show new message
            setTimeout(() => openProject(currentProject), 500);
        } else {
            throw new Error('Failed to send message');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message', 'error');
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6'};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Theme toggle
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    if (savedTheme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
    }
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (newTheme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Display user info
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userInfo = document.getElementById('userInfo');
            const clientName = document.getElementById('clientName');
            
            if (userInfo) {
                userInfo.textContent = `Client Dashboard - ${payload.username}`;
            }
            if (clientName) {
                clientName.textContent = payload.username;
            }
        } catch (e) {
            console.error('Error parsing token:', e);
        }
    }
    
    // Modal close handlers
    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('projectModal').classList.remove('show');
    });
    
    // Close modal on backdrop click
    document.getElementById('projectModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            document.getElementById('projectModal').classList.remove('show');
        }
    });
    
    // Message form
    document.getElementById('messageForm').addEventListener('submit', sendMessage);
    
    // Load projects
    loadProjects();
    
    // Add entrance animations
    if (typeof gsap !== 'undefined') {
        gsap.from('.welcome-section', {
            y: 50,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out"
        });
        
        gsap.from('.projects-section', {
            y: 50,
            opacity: 0,
            duration: 0.8,
            delay: 0.2,
            ease: "power3.out"
        });
    }
});

// Add toast animations CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Audit Logs Functionality
let auditLogsLoaded = false;

function initializeAuditLogs() {
    const toggleBtn = document.getElementById('toggleAuditLogsBtn');
    const container = document.getElementById('auditLogsContainer');
    const toggleText = toggleBtn && toggleBtn.querySelector('.toggle-text');
    
    if (toggleBtn && container) {
        // Reset state
        auditLogsLoaded = false;
        container.style.display = 'none';
        toggleBtn.classList.remove('expanded');
        if (toggleText) toggleText.textContent = 'Show Activity Log';
        
        // Remove existing listener
        toggleBtn.replaceWith(toggleBtn.cloneNode(true));
        const newToggleBtn = document.getElementById('toggleAuditLogsBtn');
        const newToggleText = newToggleBtn.querySelector('.toggle-text');
        
        newToggleBtn.addEventListener('click', () => {
            const isVisible = container.style.display !== 'none';
            
            if (isVisible) {
                // Hide audit logs
                container.style.display = 'none';
                newToggleBtn.classList.remove('expanded');
                if (newToggleText) newToggleText.textContent = 'Show Activity Log';
            } else {
                // Show audit logs
                container.style.display = 'block';
                newToggleBtn.classList.add('expanded');
                if (newToggleText) newToggleText.textContent = 'Hide Activity Log';
                
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
    
    if (!loadingEl || !listEl || !emptyEl) return;
    
    // Show loading state
    loadingEl.style.display = 'flex';
    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    try {
        const response = await clientAPI.get(`/api/projects/${currentProject}/audit-logs`);
        
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
        const emptyText = emptyEl.querySelector('p');
        if (emptyText) emptyText.textContent = 'Failed to load activity log. Please try again.';
    }
}

function displayAuditLogs(auditLogs) {
    const listEl = document.getElementById('auditLogsList');
    if (!listEl) return;
    
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