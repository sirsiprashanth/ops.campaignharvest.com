// Initialize AOS
AOS.init({
    duration: 800,
    once: true,
    offset: 100
});

// Data Management
let projects = JSON.parse(localStorage.getItem('campaignHarvestProjects')) || [];
let currentProjectId = null;
let currentMilestoneId = null;
let editingProjectId = null;
let editingMilestoneId = null;

// DOM Elements
const projectsGrid = document.getElementById('projectsGrid');
const projectModal = document.getElementById('projectModal');
const milestoneModal = document.getElementById('milestoneModal');
const projectDetailsModal = document.getElementById('projectDetailsModal');
const replyModal = document.getElementById('replyModal');
const projectForm = document.getElementById('projectForm');
const milestoneForm = document.getElementById('milestoneForm');
const replyForm = document.getElementById('replyForm');

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const sunIcon = themeToggle.querySelector('.sun-icon');
const moonIcon = themeToggle.querySelector('.moon-icon');

// Load theme preference
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

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        
        // Update active nav
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show corresponding section
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        document.getElementById(`${section}-section`).classList.add('active');
        
        // Load data for section
        if (section === 'messages') {
            loadMessages();
        } else if (section === 'analytics') {
            loadAnalytics();
        }
    });
});

// Project Management
function loadProjects() {
    projectsGrid.innerHTML = '';
    
    if (projects.length === 0) {
        projectsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">No projects yet</p>
                <button class="btn btn-primary" onclick="showAddProjectModal()">Create Your First Project</button>
            </div>
        `;
        return;
    }
    
    projects.forEach(project => {
        const projectCard = createProjectCard(project);
        projectsGrid.appendChild(projectCard);
    });
    
    // Animate cards
    gsap.from('.project-card', {
        scale: 0.9,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out"
    });
}

function createProjectCard(project) {
    const div = document.createElement('div');
    div.className = 'project-card';
    div.dataset.projectId = project.id;
    
    const progress = calculateProjectProgress(project);
    const statusClass = `status-${project.status.replace(' ', '-')}`;
    
    div.innerHTML = `
        <div class="project-card-header">
            <div>
                <h3 class="project-name">${project.name}</h3>
                <p class="project-dates">${formatDate(project.startDate)} - ${formatDate(project.endDate)}</p>
            </div>
            <span class="project-status-badge ${statusClass}">${formatStatus(project.status)}</span>
        </div>
        <div class="project-stats">
            <div class="project-stat">
                <span class="stat-label">Progress</span>
                <span class="stat-value">${progress}%</span>
            </div>
            <div class="project-stat">
                <span class="stat-label">Budget</span>
                <span class="stat-value">₹${project.budget.toLocaleString('en-IN')}</span>
            </div>
            <div class="project-stat">
                <span class="stat-label">Team Size</span>
                <span class="stat-value">${project.teamSize}</span>
            </div>
            <div class="project-stat">
                <span class="stat-label">Milestones</span>
                <span class="stat-value">${project.milestones?.length || 0}</span>
            </div>
        </div>
        <div class="project-actions">
            <button class="btn btn-sm btn-primary" onclick="showProjectDetails('${project.id}')">Manage</button>
            <button class="btn btn-sm btn-secondary" onclick="editProject('${project.id}')">Edit</button>
            <a href="project.html?id=${project.id}" class="project-link" target="_blank">
                View Public Page
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M7 17L17 7M17 7H7M17 7V17"></path>
                </svg>
            </a>
        </div>
    `;
    
    return div;
}

function showAddProjectModal() {
    editingProjectId = null;
    document.getElementById('modalTitle').textContent = 'Add New Project';
    projectForm.reset();
    projectModal.classList.add('active');
}

function editProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    editingProjectId = projectId;
    document.getElementById('modalTitle').textContent = 'Edit Project';
    
    // Fill form with project data
    document.getElementById('projectName').value = project.name;
    document.getElementById('startDate').value = project.startDate;
    document.getElementById('endDate').value = project.endDate;
    document.getElementById('budget').value = project.budget;
    document.getElementById('teamSize').value = project.teamSize;
    document.getElementById('projectStatus').value = project.status;
    
    projectModal.classList.add('active');
}

function showProjectDetails(projectId) {
    currentProjectId = projectId;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    document.getElementById('projectDetailsTitle').textContent = project.name;
    
    // Load project info
    const projectInfo = document.getElementById('projectInfo');
    projectInfo.innerHTML = `
        <div class="info-item">
            <span class="info-label">Status</span>
            <span class="info-value">${formatStatus(project.status)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Start Date</span>
            <span class="info-value">${formatDate(project.startDate)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">End Date</span>
            <span class="info-value">${formatDate(project.endDate)}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Budget</span>
            <span class="info-value">₹${project.budget.toLocaleString('en-IN')}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Team Size</span>
            <span class="info-value">${project.teamSize} members</span>
        </div>
        <div class="info-item">
            <span class="info-label">Progress</span>
            <span class="info-value">${calculateProjectProgress(project)}%</span>
        </div>
    `;
    
    // Load milestones
    loadProjectMilestones(project);
    
    // Load messages preview
    loadProjectMessages(project);
    
    projectDetailsModal.classList.add('active');
}

function loadProjectMilestones(project) {
    const milestonesList = document.getElementById('milestonesList');
    milestonesList.innerHTML = '';
    
    if (!project.milestones || project.milestones.length === 0) {
        milestonesList.innerHTML = '<p style="color: var(--text-secondary);">No milestones yet</p>';
        return;
    }
    
    project.milestones.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    project.milestones.forEach(milestone => {
        const milestoneEl = document.createElement('div');
        milestoneEl.className = 'milestone-item';
        milestoneEl.innerHTML = `
            <div class="milestone-info">
                <h5>${milestone.title}</h5>
                <div class="milestone-meta">
                    <span>${formatDate(milestone.date)}</span>
                    <span class="project-status-badge status-${milestone.status}">${milestone.status}</span>
                </div>
                <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">${milestone.description}</p>
            </div>
            <div class="milestone-actions">
                <button class="icon-btn" onclick="editMilestone('${milestone.id}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="icon-btn delete" onclick="deleteMilestone('${milestone.id}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"></path>
                    </svg>
                </button>
            </div>
        `;
        milestonesList.appendChild(milestoneEl);
    });
}

function loadProjectMessages(project) {
    const messagesPreview = document.getElementById('projectMessagesPreview');
    messagesPreview.innerHTML = '';
    
    if (!project.messages || project.messages.length === 0) {
        messagesPreview.innerHTML = '<p style="color: var(--text-secondary);">No messages yet</p>';
        return;
    }
    
    // Show last 5 messages
    const recentMessages = project.messages.slice(-5);
    recentMessages.forEach(message => {
        const messageEl = document.createElement('div');
        messageEl.className = 'message-item';
        messageEl.innerHTML = `
            <div class="message-header">
                <div class="message-info">
                    <p class="message-author">${message.author}</p>
                    <p class="message-time">${formatTime(message.timestamp)}</p>
                </div>
            </div>
            <p class="message-content">${message.content}</p>
        `;
        messagesPreview.appendChild(messageEl);
    });
}

// Milestone Management
function showAddMilestoneModal() {
    if (!currentProjectId) return;
    
    editingMilestoneId = null;
    document.getElementById('milestoneModalTitle').textContent = 'Add Milestone';
    milestoneForm.reset();
    milestoneModal.classList.add('active');
}

function editMilestone(milestoneId) {
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;
    
    editingMilestoneId = milestoneId;
    document.getElementById('milestoneModalTitle').textContent = 'Edit Milestone';
    
    // Fill form
    document.getElementById('milestoneTitle').value = milestone.title;
    document.getElementById('milestoneDate').value = milestone.date;
    document.getElementById('milestoneDescription').value = milestone.description;
    document.getElementById('milestoneStatus').value = milestone.status;
    
    milestoneModal.classList.add('active');
}

function deleteMilestone(milestoneId) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    project.milestones = project.milestones.filter(m => m.id !== milestoneId);
    saveProjects();
    loadProjectMilestones(project);
}

// Form Handlers
projectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const projectData = {
        name: document.getElementById('projectName').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        budget: parseInt(document.getElementById('budget').value),
        teamSize: parseInt(document.getElementById('teamSize').value),
        status: document.getElementById('projectStatus').value
    };
    
    if (editingProjectId) {
        // Update existing project
        const projectIndex = projects.findIndex(p => p.id === editingProjectId);
        if (projectIndex !== -1) {
            projects[projectIndex] = { ...projects[projectIndex], ...projectData };
        }
    } else {
        // Create new project
        const newProject = {
            id: generateId(),
            ...projectData,
            milestones: [],
            messages: [],
            createdAt: new Date().toISOString()
        };
        projects.push(newProject);
    }
    
    saveProjects();
    loadProjects();
    projectModal.classList.remove('active');
    projectForm.reset();
});

milestoneForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    const milestoneData = {
        title: document.getElementById('milestoneTitle').value,
        date: document.getElementById('milestoneDate').value,
        description: document.getElementById('milestoneDescription').value,
        status: document.getElementById('milestoneStatus').value
    };
    
    if (editingMilestoneId) {
        // Update existing milestone
        const milestoneIndex = project.milestones.findIndex(m => m.id === editingMilestoneId);
        if (milestoneIndex !== -1) {
            project.milestones[milestoneIndex] = { ...project.milestones[milestoneIndex], ...milestoneData };
        }
    } else {
        // Create new milestone
        if (!project.milestones) project.milestones = [];
        const newMilestone = {
            id: generateId(),
            ...milestoneData
        };
        project.milestones.push(newMilestone);
    }
    
    saveProjects();
    loadProjectMilestones(project);
    milestoneModal.classList.remove('active');
    milestoneForm.reset();
});

// Messages Management
function loadMessages() {
    const container = document.getElementById('adminMessagesContainer');
    const filterSelect = document.getElementById('messageProjectFilter');
    
    // Update filter options
    filterSelect.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
        filterSelect.innerHTML += `<option value="${project.id}">${project.name}</option>`;
    });
    
    // Collect all messages
    let allMessages = [];
    projects.forEach(project => {
        if (project.messages) {
            project.messages.forEach(message => {
                allMessages.push({
                    ...message,
                    projectId: project.id,
                    projectName: project.name
                });
            });
        }
    });
    
    // Sort by timestamp
    allMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Display messages
    container.innerHTML = '';
    if (allMessages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No messages yet</p>';
        return;
    }
    
    allMessages.forEach(message => {
        if (!message.isAdmin) {
            const messageEl = createAdminMessageElement(message);
            container.appendChild(messageEl);
        }
    });
}

function createAdminMessageElement(message) {
    const div = document.createElement('div');
    div.className = 'message-item';
    
    div.innerHTML = `
        <div class="message-header">
            <div class="message-info">
                <p class="message-project">${message.projectName}</p>
                <p class="message-author">${message.author}</p>
                <p class="message-time">${formatTime(message.timestamp)}</p>
            </div>
            <button class="btn btn-sm btn-primary reply-btn" onclick="showReplyModal('${message.projectId}', '${message.id}')">Reply</button>
        </div>
        <p class="message-content">${message.content}</p>
    `;
    
    return div;
}

function showReplyModal(projectId, messageId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const message = project.messages.find(m => m.id === messageId);
    if (!message) return;
    
    currentProjectId = projectId;
    currentMilestoneId = messageId;
    
    // Show original message
    document.getElementById('originalMessage').innerHTML = `
        <p><strong>${message.author}</strong> - ${formatTime(message.timestamp)}</p>
        <p>${message.content}</p>
    `;
    
    replyModal.classList.add('active');
}

replyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const project = projects.find(p => p.id === currentProjectId);
    if (!project) return;
    
    const replyMessage = {
        id: generateId(),
        author: "Sarah Johnson",
        role: "admin",
        content: document.getElementById('replyContent').value,
        timestamp: new Date().toISOString(),
        isAdmin: true
    };
    
    if (!project.messages) project.messages = [];
    project.messages.push(replyMessage);
    
    saveProjects();
    loadMessages();
    replyModal.classList.remove('active');
    replyForm.reset();
});

// Analytics
function loadAnalytics() {
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => p.status !== 'completed').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    
    let totalMessages = 0;
    projects.forEach(project => {
        if (project.messages) {
            totalMessages += project.messages.length;
        }
    });
    
    document.getElementById('totalProjects').textContent = totalProjects;
    document.getElementById('activeProjects').textContent = activeProjects;
    document.getElementById('completedProjects').textContent = completedProjects;
    document.getElementById('totalMessages').textContent = totalMessages;
    
    // Animate numbers
    gsap.from('.analytics-value', {
        textContent: 0,
        duration: 2,
        ease: "power1.in",
        snap: { textContent: 1 },
        stagger: 0.1
    });
}

// Modal Controls
document.getElementById('addProjectBtn').addEventListener('click', showAddProjectModal);
document.getElementById('addMilestoneBtn').addEventListener('click', showAddMilestoneModal);

// Close modals
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
    });
});

document.querySelectorAll('#cancelBtn, #milestoneCancelBtn, #replyCancelBtn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
    });
});

// Click outside modal to close
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// Utility Functions
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function saveProjects() {
    localStorage.setItem('campaignHarvestProjects', JSON.stringify(projects));
}

function calculateProjectProgress(project) {
    if (!project.milestones || project.milestones.length === 0) return 0;
    
    const completed = project.milestones.filter(m => m.status === 'completed').length;
    return Math.round((completed / project.milestones.length) * 100);
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

function formatStatus(status) {
    return status.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Initialize
window.addEventListener('load', () => {
    loadProjects();
    
    // Add entrance animation
    gsap.from('.header', {
        y: -100,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    });
    
    gsap.from('.sidebar', {
        x: -250,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
    });
});