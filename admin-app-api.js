// Initialize AOS
AOS.init({
    duration: 800,
    once: true,
    offset: 100
});

// Data Management
let projects = [];
let currentProjectId = null;
let currentMessageId = null;
let editingProjectId = null;
let editingMilestoneId = null;
let editingProjectUrgency = null;

// DOM Elements
const projectsTableBody = document.getElementById('projectsTableBody');
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

// Dynamic form requirements based on priority
const projectPrioritySelect = document.getElementById('projectPriority');
const startDateInput = document.getElementById('startDate');
const budgetInput = document.getElementById('budget');
const teamSizeInput = document.getElementById('teamSize');
const projectTypeSelect = document.getElementById('projectType');
const pipelineOptionalSpans = document.querySelectorAll('.pipeline-optional');

function updateFormRequirements() {
    const isPipeline = projectPrioritySelect.value === 'pipeline';
    
    // Toggle required attributes
    if (isPipeline) {
        startDateInput.removeAttribute('required');
        budgetInput.removeAttribute('required');
        teamSizeInput.removeAttribute('required');
        projectTypeSelect.removeAttribute('required');
        
        // Show optional labels
        pipelineOptionalSpans.forEach(span => span.style.display = 'inline');
    } else {
        startDateInput.setAttribute('required', 'required');
        budgetInput.setAttribute('required', 'required');
        teamSizeInput.setAttribute('required', 'required');
        projectTypeSelect.setAttribute('required', 'required');
        
        // Hide optional labels
        pipelineOptionalSpans.forEach(span => span.style.display = 'none');
    }
}

// Add event listener for priority change
projectPrioritySelect.addEventListener('change', updateFormRequirements);

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const section = item.dataset.section;
        
        // If no data-section, it's an external link - let it navigate normally
        if (!section) {
            return; // Don't prevent default, allow normal navigation
        }
        
        e.preventDefault();
        
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
        } else if (section === 'timeline') {
            loadTimeline();
        } else if (section === 'audit-logs') {
            loadAuditLogs();
        } else if (section === 'clients') {
            loadClients();
        }
    });
});

// Project Management
async function loadProjects() {
    projectsTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Loading projects...</td></tr>';
    
    projects = await APIService.getProjects();
    projectsTableBody.innerHTML = '';
    
    if (projects.length === 0) {
        projectsTableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem;">
                    <p style="color: var(--text-secondary); margin-bottom: 1rem;">No projects yet</p>
                    <button class="btn btn-primary" onclick="showAddProjectModal()">Create Your First Project</button>
                </td>
            </tr>
        `;
        return;
    }
    
    // Sort projects: completed projects at the bottom
    projects.sort((a, b) => {
        // If one is completed and the other isn't, put completed at bottom
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        
        // If both have same completion status, sort by urgency (higher urgency first)
        if (a.urgency !== null && b.urgency !== null) {
            return a.urgency - b.urgency;
        }
        if (a.urgency !== null && b.urgency === null) return -1;
        if (a.urgency === null && b.urgency !== null) return 1;
        
        // Finally, sort by name if everything else is equal
        return a.name.localeCompare(b.name);
    });
    
    projects.forEach(project => {
        const projectRow = createProjectRow(project);
        projectsTableBody.appendChild(projectRow);
    });
    
    // Update audit log filter
    updateAuditProjectFilter();
    
    // Animate rows
    gsap.fromTo('.project-row', 
        {
            scale: 0.9,
            opacity: 0
        },
        {
            scale: 1,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: "power2.out"
        }
    );
}

function createProjectRow(project) {
    const tr = document.createElement('tr');
    tr.className = 'project-row';
    tr.dataset.projectId = project.id;
    
    const progress = calculateProjectProgress(project);
    const statusClass = `status-${project.status.replace(' ', '-')}`;
    const priorityClass = project.priority === 'converted' ? 'priority-converted' : 'priority-pipeline';
    
    tr.innerHTML = `
        <td class="project-name-cell">
            <div class="project-name-wrapper">
                <h4 class="project-name">${project.name}</h4>
                ${project.project_type === 'retainer' ? '<span class="project-type-badge">Retainer</span>' : project.project_type === 'fixed' ? '<span class="project-type-badge">Fixed</span>' : ''}
            </div>
        </td>
        <td>
            <span class="project-status-badge ${statusClass}">${formatStatus(project.status)}</span>
        </td>
        <td>
            <div class="progress-cell">
                <div class="progress-bar-inline">
                    <div class="progress-fill-inline" style="width: ${progress}%"></div>
                </div>
                <span class="progress-text">${progress}%</span>
            </div>
        </td>
        <td>${project.budget !== undefined ? `₹${project.budget.toLocaleString('en-IN')}` : '-'}</td>
        <td class="urgency-cell">
            <input type="number" 
                   class="urgency-input" 
                   value="${project.urgency || ''}" 
                   placeholder="-" 
                   min="1" 
                   onchange="updateProjectUrgency('${project.id}', this.value)"
                   onclick="event.stopPropagation()"
                   style="width: 60px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); text-align: center;">
        </td>
        <td class="duration-cell">
            <div>${formatDate(project.start_date)}</div>
            <div class="text-muted">${project.end_date ? formatDate(project.end_date) : 'Ongoing'}</div>
        </td>
        <td>
            <span class="project-priority-badge ${priorityClass}">${project.priority === 'converted' ? 'P1' : 'P2'}</span>
        </td>
        <td class="actions-cell">
            <div class="table-actions">
                <button class="btn-icon" onclick="showProjectDetails('${project.id}')" title="Manage">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2L14 4L7 11L5 12L4 10L11 3L12 2Z"></path>
                        <path d="M10 4L12 6"></path>
                        <path d="M2 14L4 10L8 14L4 16L2 14Z"></path>
                    </svg>
                </button>
                <button class="btn-icon" onclick="editProject('${project.id}')" title="Edit">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4C2.89543 4 2 4.89543 2 6V18C2 19.1046 2.89543 20 4 20H16C17.1046 20 18 19.1046 18 18V11"></path>
                        <path d="M18.5 2.5C19.3284 3.32843 19.3284 4.67157 18.5 5.5L8 16L4 17L5 13L15.5 2.5C16.3284 1.67157 17.6716 1.67157 18.5 2.5Z"></path>
                    </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="deleteProject('${project.id}')" title="Delete">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6H21"></path>
                        <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6"></path>
                        <path d="M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6"></path>
                    </svg>
                </button>
                <a href="project.html?id=${project.id}" class="btn-icon" target="_blank" title="View Public Page">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11"></path>
                        <path d="M15 3H21V9"></path>
                        <path d="M10 14L21 3"></path>
                    </svg>
                </a>
                <button class="btn-icon btn-icon-success" onclick="downloadProjectCSV('${project.id}')" title="Download CSV">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            </div>
        </td>
    `;
    
    return tr;
}

function showAddProjectModal() {
    editingProjectId = null;
    editingProjectUrgency = null;
    document.getElementById('modalTitle').textContent = 'Add New Project';
    projectForm.reset();
    // Reset priority to default and update form requirements
    updateFormRequirements();
    projectModal.classList.add('active');
}

async function editProject(projectId) {
    const project = await APIService.getProject(projectId);
    if (!project) return;
    
    editingProjectId = projectId;
    editingProjectUrgency = project.urgency; // Store the current urgency
    document.getElementById('modalTitle').textContent = 'Edit Project';
    
    // Fill form with project data
    document.getElementById('projectName').value = project.name;
    document.getElementById('startDate').value = project.start_date || '';
    document.getElementById('endDate').value = project.end_date || '';
    document.getElementById('budget').value = project.budget || '';
    document.getElementById('teamSize').value = project.team_size || '';
    document.getElementById('projectStatus').value = project.status;
    if (project.project_type) {
        document.getElementById('projectType').value = project.project_type;
    } else {
        document.getElementById('projectType').value = '';
    }
    if (project.priority) {
        document.getElementById('projectPriority').value = project.priority;
        // Update form requirements based on priority
        updateFormRequirements();
    }
    
    projectModal.classList.add('active');
}

async function deleteProject(projectId) {
    const project = await APIService.getProject(projectId);
    if (!project) return;
    
    const confirmMessage = `Are you sure you want to delete "${project.name}"?\n\nThis will permanently delete:\n• The project\n• ${project.milestones?.length || 0} milestones\n• ${project.messages?.length || 0} messages\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        await APIService.deleteProject(projectId);
        showNotification('Project deleted successfully');
        await loadProjects();
    } catch (error) {
        showNotification('Failed to delete project', 'error');
    }
}

async function updateProjectUrgency(projectId, urgencyValue) {
    try {
        const urgency = urgencyValue === '' ? null : parseInt(urgencyValue);
        
        // Make API call to update urgency
        const response = await fetch(`/api/projects/${projectId}/urgency`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ urgency })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update urgency');
        }
        
        showNotification('Urgency updated successfully');
        
        // Reload projects to show the reordered list
        await loadProjects();
    } catch (error) {
        console.error('Error updating urgency:', error);
        showNotification('Failed to update urgency', 'error');
        // Reload to reset the input
        await loadProjects();
    }
}

async function showProjectDetails(projectId) {
    currentProjectId = projectId;
    const project = await APIService.getProject(projectId);
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
            <span class="info-label">Project Type</span>
            <span class="info-value">${project.project_type === 'retainer' ? 'Monthly Retainer' : project.project_type === 'fixed' ? 'Fixed Project' : 'Not specified'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Start Date</span>
            <span class="info-value">${formatDate(project.start_date)}</span>
        </div>
        ${project.end_date ? `<div class="info-item">
            <span class="info-label">End Date</span>
            <span class="info-value">${formatDate(project.end_date)}</span>
        </div>` : ''}
        <div class="info-item">
            <span class="info-label">Budget</span>
            <span class="info-value">${project.budget !== undefined ? `₹${project.budget.toLocaleString('en-IN')}${project.project_type === 'retainer' ? '/month' : ''}` : 'N/A'}</span>
        </div>
        <div class="info-item">
            <span class="info-label">Team Size</span>
            <span class="info-value">${project.team_size} members</span>
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
                <h5>${milestone.title} ${milestone.milestone_type === 'finance' ? '<span class="finance-badge">💰 Finance</span>' : ''}</h5>
                <div class="milestone-meta">
                    <span>${formatDate(milestone.date)}</span>
                    <span class="project-status-badge status-${milestone.status}">${milestone.status}</span>
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem; white-space: pre-wrap;">${escapeHtml(milestone.description || '')}</div>
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

async function editMilestone(milestoneId) {
    const project = await APIService.getProject(currentProjectId);
    if (!project) return;
    
    const milestone = project.milestones.find(m => m.id === milestoneId);
    if (!milestone) return;
    
    editingMilestoneId = milestoneId;
    document.getElementById('milestoneModalTitle').textContent = 'Edit Milestone';
    
    // Fill form
    document.getElementById('milestoneTitle').value = milestone.title;
    document.getElementById('milestoneStartDate').value = milestone.start_date || '';
    document.getElementById('milestoneDueDate').value = milestone.due_date || '';
    document.getElementById('milestoneDescription').value = milestone.description;
    document.getElementById('milestoneStatus').value = milestone.status;
    document.getElementById('milestoneType').value = milestone.milestone_type || 'general';
    document.getElementById('milestonePriority').value = milestone.priority || 999;
    
    milestoneModal.classList.add('active');
}

async function deleteMilestone(milestoneId) {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    
    try {
        await APIService.deleteMilestone(milestoneId);
        const project = await APIService.getProject(currentProjectId);
        loadProjectMilestones(project);
        showNotification('Milestone deleted successfully');
    } catch (error) {
        showNotification('Failed to delete milestone', 'error');
    }
}

// Form Handlers
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const priority = document.getElementById('projectPriority').value;
    const isPipeline = priority === 'pipeline';
    
    // Get form values with proper defaults for required fields
    const budgetValue = document.getElementById('budget').value;
    const teamSizeValue = document.getElementById('teamSize').value;
    const startDateValue = document.getElementById('startDate').value;
    
    const projectData = {
        name: document.getElementById('projectName').value,
        start_date: startDateValue || (isPipeline ? new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
        end_date: document.getElementById('endDate').value || null,
        budget: budgetValue && budgetValue.trim() !== '' ? parseInt(budgetValue) : 0,
        team_size: teamSizeValue && teamSizeValue.trim() !== '' ? parseInt(teamSizeValue) : 1,
        status: document.getElementById('projectStatus').value,
        project_type: document.getElementById('projectType').value || (isPipeline ? null : 'fixed'),
        priority: priority,
        urgency: editingProjectId ? editingProjectUrgency : null // Preserve urgency when editing
    };
    
    try {
        if (editingProjectId) {
            // Update existing project
            await APIService.updateProject(editingProjectId, projectData);
            showNotification('Project updated successfully');
        } else {
            // Create new project
            projectData.id = generateId();
            await APIService.createProject(projectData);
            showNotification('Project created successfully');
        }
        
        await loadProjects();
        projectModal.classList.remove('active');
        projectForm.reset();
    } catch (error) {
        console.error('Error saving project:', error);
        showNotification('Failed to save project: ' + error.message, 'error');
    }
});

milestoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const startDate = document.getElementById('milestoneStartDate').value;
    const dueDate = document.getElementById('milestoneDueDate').value;
    
    const milestoneData = {
        title: document.getElementById('milestoneTitle').value,
        date: startDate || dueDate || new Date().toISOString().split('T')[0], // Use start_date, or due_date, or current date
        start_date: startDate || null,
        due_date: dueDate || null,
        description: document.getElementById('milestoneDescription').value,
        status: document.getElementById('milestoneStatus').value,
        milestone_type: document.getElementById('milestoneType').value,
        priority: parseInt(document.getElementById('milestonePriority').value) || 999
    };
    
    try {
        if (editingMilestoneId) {
            // Update existing milestone
            await APIService.updateMilestone(editingMilestoneId, milestoneData);
            showNotification('Milestone updated successfully');
        } else {
            // Create new milestone
            milestoneData.id = generateId();
            await APIService.createMilestone(currentProjectId, milestoneData);
            showNotification('Milestone created successfully');
        }
        
        const project = await APIService.getProject(currentProjectId);
        loadProjectMilestones(project);
        milestoneModal.classList.remove('active');
        milestoneForm.reset();
    } catch (error) {
        showNotification('Failed to save milestone', 'error');
    }
});

// Messages Management
async function loadMessages() {
    const container = document.getElementById('adminMessagesContainer');
    const filterSelect = document.getElementById('messageProjectFilter');
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;">Loading messages...</div>';
    
    // Update filter options
    const projects = await APIService.getProjects();
    filterSelect.innerHTML = '<option value="">All Projects</option>';
    projects.forEach(project => {
        filterSelect.innerHTML += `<option value="${project.id}">${project.name}</option>`;
    });
    
    // Get all messages
    const allMessages = await APIService.getMessages();
    
    // Display messages
    container.innerHTML = '';
    if (allMessages.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No messages yet</p>';
        return;
    }
    
    allMessages.forEach(message => {
        if (!message.is_admin) {
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
                <p class="message-project">${message.project_name}</p>
                <p class="message-author">${message.author}</p>
                <p class="message-time">${formatTime(message.timestamp)}</p>
            </div>
            <button class="btn btn-sm btn-primary reply-btn" onclick="showReplyModal('${message.project_id}', '${message.id}')">Reply</button>
        </div>
        <p class="message-content">${message.content}</p>
    `;
    
    return div;
}

async function showReplyModal(projectId, messageId) {
    const messages = await APIService.getMessages();
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    currentProjectId = projectId;
    currentMessageId = messageId;
    
    // Show original message
    document.getElementById('originalMessage').innerHTML = `
        <p><strong>${message.author}</strong> - ${formatTime(message.timestamp)}</p>
        <p>${message.content}</p>
    `;
    
    replyModal.classList.add('active');
}

replyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const replyMessage = {
        id: generateId(),
        author: "Sarah Johnson",
        role: "admin",
        content: document.getElementById('replyContent').value,
        timestamp: new Date().toISOString(),
        is_admin: true
    };
    
    try {
        await APIService.createMessage(currentProjectId, replyMessage);
        showNotification('Reply sent successfully');
        await loadMessages();
        replyModal.classList.remove('active');
        replyForm.reset();
    } catch (error) {
        showNotification('Failed to send reply', 'error');
    }
});

// Analytics
async function loadAnalytics() {
    const analytics = await APIService.getAnalytics();
    
    document.getElementById('totalProjects').textContent = analytics.total_projects;
    document.getElementById('activeProjects').textContent = analytics.active_projects;
    document.getElementById('completedProjects').textContent = analytics.completed_projects;
    document.getElementById('totalMessages').textContent = analytics.total_messages;
    
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

// Escape HTML to prevent XSS while preserving whitespace
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatStatus(status) {
    return status.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Download project as CSV
function downloadProjectCSV(projectId) {
    // Get project name for notification
    const project = projects.find(p => p.id === projectId);
    const projectName = project ? project.name : 'Project';
    
    // Create a temporary link and trigger download
    const downloadUrl = `/api/projects/${projectId}/export/csv`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${projectName.replace(/[^a-z0-9]/gi, '_')}_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Downloading ${projectName} data as CSV...`);
}

// Download all projects as CSV
function downloadAllProjectsCSV() {
    // Create a temporary link and trigger download
    const downloadUrl = '/api/projects/export/csv';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = 'all_projects_export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Downloading all projects data as CSV...');
}

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
    
    // Animate in
    gsap.to(notification, {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out"
    });
    
    // Remove after delay
    setTimeout(() => {
        gsap.to(notification, {
            opacity: 0,
            y: '1rem',
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => notification.remove()
        });
    }, 3000);
}

// Project type change handler
document.getElementById('projectType').addEventListener('change', (e) => {
    // End date is always optional, so we don't need to set required attribute
    // The pipeline-optional span is already handled by updateFormRequirements()
});

// Audit Logs Functions
let auditLogsCache = [];

async function loadAuditLogs() {
    const projectFilter = document.getElementById('auditProjectFilter').value;
    const entityFilter = document.getElementById('auditEntityFilter').value;
    
    const params = new URLSearchParams();
    if (projectFilter) params.append('project_id', projectFilter);
    if (entityFilter) params.append('entity_type', entityFilter);
    params.append('limit', '200');
    
    try {
        const response = await fetch(`/api/audit-logs?${params}`);
        const logs = await response.json();
        auditLogsCache = logs;
        renderAuditLogs(logs);
    } catch (error) {
        console.error('Failed to load audit logs:', error);
    }
}

function renderAuditLogs(logs) {
    const tbody = document.getElementById('auditLogsTableBody');
    tbody.innerHTML = '';
    
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    No audit logs found
                </td>
            </tr>
        `;
        return;
    }
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        
        // Format timestamp
        const timestamp = dayjs(log.timestamp).format('MMM DD, YYYY h:mm A');
        
        // Find project name
        const project = projects.find(p => p.id === log.project_id);
        const projectName = project ? project.name : 'Unknown Project';
        
        // Format changes
        const changesHtml = formatAuditChanges(log);
        
        row.innerHTML = `
            <td class="audit-log-timestamp">${timestamp}</td>
            <td class="audit-log-user">${log.user_name} <span style="color: var(--text-secondary); font-size: 0.75rem;">(${log.user_role})</span></td>
            <td class="audit-log-project">${projectName}</td>
            <td><span class="audit-log-entity">${log.entity_type}</span></td>
            <td><span class="audit-log-action ${log.action}">${log.action}</span></td>
            <td class="audit-log-changes">${changesHtml}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add click handlers for toggles
    document.querySelectorAll('.audit-log-changes-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            const details = toggle.nextElementSibling;
            details.classList.toggle('show');
            toggle.textContent = details.classList.contains('show') ? 'Hide details' : 'View details';
        });
    });
}

function formatAuditChanges(log) {
    if (log.action === 'create') {
        return `<span style="color: var(--success);">Created new ${log.entity_type}</span>`;
    } else if (log.action === 'delete') {
        return `<span style="color: var(--danger);">Deleted ${log.entity_type}</span>`;
    } else if (log.action === 'update' && log.old_values && log.new_values) {
        const changes = [];
        const fields = Object.keys(log.new_values);
        
        fields.forEach(field => {
            if (JSON.stringify(log.old_values[field]) !== JSON.stringify(log.new_values[field])) {
                changes.push(field);
            }
        });
        
        if (changes.length === 0) {
            return '<span style="color: var(--text-secondary);">No changes</span>';
        }
        
        const changesId = `changes-${log.id}`;
        let detailsHtml = `
            <a href="#" class="audit-log-changes-toggle">View details</a>
            <div class="audit-log-changes-details" id="${changesId}">
        `;
        
        changes.forEach(field => {
            const oldValue = formatFieldValue(field, log.old_values[field]);
            const newValue = formatFieldValue(field, log.new_values[field]);
            
            detailsHtml += `
                <div class="audit-log-field">
                    <span class="audit-log-field-name">${formatFieldName(field)}:</span><br>
                    <span class="audit-log-old-value">${oldValue}</span> → 
                    <span class="audit-log-new-value">${newValue}</span>
                </div>
            `;
        });
        
        detailsHtml += '</div>';
        return detailsHtml;
    }
    
    return '<span style="color: var(--text-secondary);">Unknown action</span>';
}

function formatFieldName(field) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatFieldValue(field, value) {
    if (value === null || value === undefined) {
        return 'None';
    }
    
    if (field === 'date' || field.includes('_date')) {
        return dayjs(value).format('MMM DD, YYYY');
    }
    
    if (field === 'budget') {
        return `₹${value.toLocaleString('en-IN')}`;
    }
    
    if (field === 'status') {
        return value.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    return value.toString();
}

// Update audit log project filter when projects are loaded
function updateAuditProjectFilter() {
    const filter = document.getElementById('auditProjectFilter');
    filter.innerHTML = '<option value="">All Projects</option>';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        filter.appendChild(option);
    });
}

// Add event listeners for audit log filters
document.getElementById('auditProjectFilter').addEventListener('change', loadAuditLogs);
document.getElementById('auditEntityFilter').addEventListener('change', loadAuditLogs);

// Timeline Functions
let timelineMilestones = [];

async function loadTimeline() {
    try {
        const response = await fetch('/api/timeline');
        timelineMilestones = await response.json();
        
        // Populate project filter if it's empty
        populateTimelineProjectFilter();
        
        // Set default status filter to 'upcoming'
        document.getElementById('timelineStatusFilter').value = 'upcoming';
        
        // Apply filters
        applyTimelineFilters();
    } catch (error) {
        console.error('Failed to load timeline:', error);
    }
}

function populateTimelineProjectFilter() {
    const projectFilter = document.getElementById('timelineProjectFilter');
    
    // Only populate if it has just the "All Projects" option
    if (projectFilter.options.length <= 1) {
        // Get unique projects from milestones
        const uniqueProjects = [...new Map(timelineMilestones.map(m => 
            [m.project_id, { id: m.project_id, name: m.project_name, priority: m.project_priority }]
        )).values()];
        
        // Sort projects by priority then name
        uniqueProjects.sort((a, b) => {
            if (a.priority === 'converted' && b.priority !== 'converted') return -1;
            if (a.priority !== 'converted' && b.priority === 'converted') return 1;
            return a.name.localeCompare(b.name);
        });
        
        // Add options
        uniqueProjects.forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = `${project.name} ${project.priority === 'converted' ? '(P1)' : '(P2)'}`;
            projectFilter.appendChild(option);
        });
    }
}

function applyTimelineFilters() {
    const projectFilter = document.getElementById('timelineProjectFilter').value;
    const priorityFilter = document.getElementById('timelinePriorityFilter').value;
    const statusFilter = document.getElementById('timelineStatusFilter').value;
    
    let filteredMilestones = timelineMilestones;
    
    if (projectFilter) {
        filteredMilestones = filteredMilestones.filter(m => m.project_id === projectFilter);
    }
    
    if (priorityFilter) {
        filteredMilestones = filteredMilestones.filter(m => m.project_priority === priorityFilter);
    }
    
    if (statusFilter) {
        filteredMilestones = filteredMilestones.filter(m => m.milestone_status === statusFilter);
    }
    
    renderTimeline(filteredMilestones);
}

function renderTimeline(milestones) {
    const timeline = document.getElementById('consolidatedTimeline');
    timeline.innerHTML = '';
    
    if (milestones.length === 0) {
        const projectFilter = document.getElementById('timelineProjectFilter').value;
        const message = projectFilter 
            ? 'No milestones found for the selected project and filters' 
            : 'No milestones found matching the selected filters';
            
        timeline.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                ${message}
            </div>
        `;
        return;
    }
    
    // Add summary if filtering by project
    const projectFilter = document.getElementById('timelineProjectFilter').value;
    if (projectFilter) {
        const projectName = timelineMilestones.find(m => m.project_id === projectFilter)?.project_name;
        const totalMilestones = milestones.length;
        const completedMilestones = milestones.filter(m => m.milestone_status === 'completed').length;
        
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'timeline-summary';
        summaryDiv.innerHTML = `
            <h3>${projectName}</h3>
            <p>${completedMilestones} of ${totalMilestones} milestones completed</p>
        `;
        timeline.appendChild(summaryDiv);
    }
    
    // Group milestones by date
    const groupedMilestones = {};
    milestones.forEach(milestone => {
        const dateKey = dayjs(milestone.date).format('YYYY-MM-DD');
        if (!groupedMilestones[dateKey]) {
            groupedMilestones[dateKey] = [];
        }
        groupedMilestones[dateKey].push(milestone);
    });
    
    // Sort dates
    const sortedDates = Object.keys(groupedMilestones).sort();
    
    // Render each date group
    sortedDates.forEach(dateKey => {
        const dateGroupMilestones = groupedMilestones[dateKey];
        
        // Create date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        dateHeader.innerHTML = `
            <div class="timeline-date-label">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                ${formatDate(dateKey)}
                <span class="milestone-count">(${dateGroupMilestones.length} milestone${dateGroupMilestones.length !== 1 ? 's' : ''})</span>
            </div>
        `;
        timeline.appendChild(dateHeader);
        
        // Create date group container
        const dateGroup = document.createElement('div');
        dateGroup.className = 'timeline-date-group';
        
        // Add milestones for this date
        dateGroupMilestones.forEach((milestone, index) => {
            const milestoneEl = createTimelineMilestone(milestone, index);
            dateGroup.appendChild(milestoneEl);
        });
        
        timeline.appendChild(dateGroup);
    });
    
    // Animate milestones
    gsap.from('.milestone', {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.3,
        ease: "back.out(1.7)"
    });
}

function createTimelineMilestone(milestone, index) {
    const div = document.createElement('div');
    const priorityClass = milestone.project_priority === 'converted' ? 'priority-1' : 'priority-2';
    
    div.className = `milestone ${milestone.status} ${priorityClass}`;
    
    // Only show project name if not filtering by specific project
    const projectFilter = document.getElementById('timelineProjectFilter').value;
    const showProjectName = !projectFilter;
    
    // Create compact view with tooltip
    div.innerHTML = `
        <div class="milestone-dot"></div>
        <div class="milestone-content">
            ${showProjectName ? `<div class="milestone-project-name clickable-project" onclick="openProjectMilestoneManager('${milestone.project_id}', '${milestone.project_name.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Click to manage project milestones">${milestone.project_name}</div>` : ''}
            <div class="milestone-title-row">
                <div class="milestone-title" onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})" style="cursor: pointer; flex: 1;">${milestone.title}</div>
                <div class="milestone-priority-edit">
                    <input type="number" 
                           class="priority-input" 
                           value="${milestone.priority || 999}" 
                           min="1" 
                           max="999" 
                           onblur="updateMilestonePriorityAdmin('${milestone.id}', this.value)"
                           onkeypress="if(event.key==='Enter') updateMilestonePriorityAdmin('${milestone.id}', this.value)"
                           onclick="event.stopPropagation()"
                           title="Priority (1 = highest)">
                </div>
            </div>
            <div class="milestone-meta">
                <span class="milestone-priority-indicator ${priorityClass}">
                    ${milestone.project_priority === 'converted' ? 'P1' : 'P2'}
                </span>
            </div>
        </div>
        <div class="milestone-tooltip">
            <div class="milestone-tooltip-header">
                ${showProjectName ? `<div class="milestone-tooltip-project">${milestone.project_name}</div>` : ''}
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
            </div>
            ${milestone.description ? `<div class="milestone-tooltip-description">${milestone.description}</div>` : ''}
        </div>
    `;
    
    return div;
}

// Update milestone priority function for admin dashboard
async function updateMilestonePriorityAdmin(milestoneId, newPriority) {
    try {
        const priorityValue = parseInt(newPriority) || 999;
        
        // Get current milestone data first
        const currentMilestone = timelineMilestones.find(m => m.id === milestoneId);
        if (!currentMilestone) {
            throw new Error('Milestone not found');
        }
        
        const milestoneData = {
            title: currentMilestone.title,
            description: currentMilestone.description,
            date: currentMilestone.date,
            start_date: currentMilestone.start_date,
            due_date: currentMilestone.due_date,
            status: currentMilestone.status,
            priority: priorityValue
        };
        
        // Get auth headers like APIService does
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        console.log('Updating milestone priority (admin):', { milestoneId, priorityValue, milestoneData });
        
        const response = await fetch(`/api/milestones/${milestoneId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(milestoneData)
        });
        
        if (response.ok) {
            console.log('Priority update successful (admin)');
            showNotification(`Priority updated to ${priorityValue}`, 'success');
            await loadTimeline(); // Reload timeline to show new order
        } else {
            const errorData = await response.text();
            console.error('Priority update failed (admin):', response.status, errorData);
            throw new Error(`Failed to update priority: ${response.status} ${errorData}`);
        }
    } catch (error) {
        console.error('Error updating milestone priority:', error);
        showNotification('Failed to update priority. Please try again.', 'error');
        // Reload to reset the input value
        await loadTimeline();
    }
}

// Add event listeners for timeline filters
document.getElementById('timelineProjectFilter').addEventListener('change', applyTimelineFilters);
document.getElementById('timelinePriorityFilter').addEventListener('change', applyTimelineFilters);
document.getElementById('timelineStatusFilter').addEventListener('change', applyTimelineFilters);

// Create a flexible API service
const apiService = {
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
    },
    
    put(url, data) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    delete(url, data) {
        const options = { method: 'DELETE' };
        if (data) {
            options.body = JSON.stringify(data);
        }
        return this.request(url, options);
    }
};

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

// Add CSS animations for toast
if (!document.getElementById('toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
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
}

// Client Management Functions
let allClients = [];
let currentClientUsername = null;

// Load clients
async function loadClients() {
    const response = await apiService.get('/api/clients');
    if (response.ok) {
        allClients = await response.json();
        displayClients();
    }
}

// Display clients in table
function displayClients() {
    const tbody = document.getElementById('clientsTableBody');
    tbody.innerHTML = '';
    
    allClients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.username}</td>
            <td>${client.email || '-'}</td>
            <td>${dayjs(client.created_at).format('MMM D, YYYY')}</td>
            <td id="client-projects-${client.username}">Loading...</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="manageClientProjects('${client.username}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="14" height="14" rx="2" ry="2"></rect>
                        <line x1="3" y1="9" x2="17" y2="9"></line>
                        <line x1="9" y1="17" x2="9" y2="9"></line>
                    </svg>
                    Projects
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteClient('${client.username}')">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
        
        // Load project count for this client
        loadClientProjectCount(client.username);
    });
}

// Load project count for a client
async function loadClientProjectCount(username) {
    const response = await apiService.get(`/api/clients/${username}/projects`);
    if (response.ok) {
        const projects = await response.json();
        const cell = document.getElementById(`client-projects-${username}`);
        if (cell) {
            cell.textContent = projects.length;
        }
    }
}

// Delete client
async function deleteClient(username) {
    if (!confirm(`Are you sure you want to delete client "${username}"? This will also remove all project assignments.`)) {
        return;
    }
    
    const response = await apiService.delete(`/api/clients/${username}`);
    if (response.ok) {
        loadClients();
        showToast('Client deleted successfully', 'success');
    } else {
        const error = await response.json();
        showToast(error.error || 'Failed to delete client', 'error');
    }
}

// Manage client projects
async function manageClientProjects(username) {
    currentClientUsername = username;
    document.getElementById('clientProjectsTitle').textContent = `Manage Projects for ${username}`;
    
    // Load all projects for dropdown
    const projectsResponse = await apiService.get('/api/projects');
    if (projectsResponse.ok) {
        const allProjects = await projectsResponse.json();
        const select = document.getElementById('projectAssignSelect');
        select.innerHTML = '<option value="">-- Select a project --</option>';
        allProjects.forEach(project => {
            select.innerHTML += `<option value="${project.id}">${project.name}</option>`;
        });
    }
    
    // Load assigned projects
    loadAssignedProjects();
    
    // Show modal
    document.getElementById('clientProjectsModal').classList.add('active');
}

// Load assigned projects for current client
async function loadAssignedProjects() {
    const response = await apiService.get(`/api/clients/${currentClientUsername}/projects`);
    if (response.ok) {
        const projects = await response.json();
        const container = document.getElementById('assignedProjectsList');
        
        if (projects.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">No projects assigned</p>';
        } else {
            container.innerHTML = projects.map(project => `
                <div class="assigned-project-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--surface); border-radius: 0.5rem; margin-bottom: 0.5rem;">
                    <div>
                        <strong>${project.name}</strong>
                        <span style="color: var(--text-secondary); margin-left: 1rem;">${project.status}</span>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="removeProjectAssignment('${project.id}')">
                        Remove
                    </button>
                </div>
            `).join('');
        }
    }
}

// Assign project to client
async function assignProject() {
    const projectId = document.getElementById('projectAssignSelect').value;
    if (!projectId) {
        showToast('Please select a project', 'error');
        return;
    }
    
    const response = await apiService.post('/api/project-assignments', {
        project_id: projectId,
        client_username: currentClientUsername
    });
    
    if (response.ok) {
        document.getElementById('projectAssignSelect').value = '';
        loadAssignedProjects();
        loadClientProjectCount(currentClientUsername);
        showToast('Project assigned successfully', 'success');
    } else {
        const error = await response.json();
        showToast(error.error || 'Failed to assign project', 'error');
    }
}

// Remove project assignment
async function removeProjectAssignment(projectId) {
    const response = await apiService.delete('/api/project-assignments', {
        project_id: projectId,
        client_username: currentClientUsername
    });
    
    if (response.ok) {
        loadAssignedProjects();
        loadClientProjectCount(currentClientUsername);
        showToast('Project assignment removed', 'success');
    } else {
        const error = await response.json();
        showToast(error.error || 'Failed to remove assignment', 'error');
    }
}

// Client modal handlers
const addClientBtn = document.getElementById('addClientBtn');
const clientModal = document.getElementById('clientModal');
const clientForm = document.getElementById('clientForm');
const clientModalTitle = document.getElementById('clientModalTitle');

if (addClientBtn && clientModal && clientForm && clientModalTitle) {
    addClientBtn.addEventListener('click', () => {
        console.log('Add client button clicked');
        clientModal.classList.add('active');
        clientForm.reset();
        clientModalTitle.textContent = 'Add New Client';
    });
} else {
    console.error('Client modal elements not found:', {
        addClientBtn: !!addClientBtn,
        clientModal: !!clientModal,
        clientForm: !!clientForm,
        clientModalTitle: !!clientModalTitle
    });
}

const clientModalClose = document.getElementById('clientModalClose');
const clientCancelBtn = document.getElementById('clientCancelBtn');
const clientProjectsClose = document.getElementById('clientProjectsClose');

if (clientModalClose) {
    clientModalClose.addEventListener('click', () => {
        clientModal.classList.remove('active');
    });
}

if (clientCancelBtn) {
    clientCancelBtn.addEventListener('click', () => {
        clientModal.classList.remove('active');
    });
}

if (clientProjectsClose) {
    clientProjectsClose.addEventListener('click', () => {
        document.getElementById('clientProjectsModal').classList.remove('active');
    });
}

document.getElementById('assignProjectBtn').addEventListener('click', assignProject);

// Client form submission
document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const clientData = {
        username: document.getElementById('clientUsername').value,
        password: document.getElementById('clientPassword').value,
        email: document.getElementById('clientEmail').value || null
    };
    
    const response = await apiService.post('/api/clients', clientData);
    
    if (response.ok) {
        document.getElementById('clientModal').classList.remove('active');
        loadClients();
        showToast('Client created successfully', 'success');
    } else {
        const error = await response.json();
        showToast(error.error || 'Failed to create client', 'error');
    }
});

// Navigation handler is already set up above - no need for duplicate

// Initialize
window.addEventListener('load', () => {
    // Display user role
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userInfo = document.getElementById('userInfo');
            if (userInfo) {
                userInfo.textContent = `${payload.role.charAt(0).toUpperCase() + payload.role.slice(1)} Panel - ${payload.username}`;
            }
        } catch (e) {
            console.error('Error parsing token:', e);
        }
    }
    
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
});// Milestone editing functionality
function openMilestoneEditModal(milestone) {
    const modal = document.getElementById('milestoneEditModal');
    const form = document.getElementById('milestoneEditForm');
    
    // Populate form with milestone data
    document.getElementById('editMilestoneId').value = milestone.id;
    document.getElementById('editProjectId').value = milestone.project_id;
    document.getElementById('editMilestoneTitle').value = milestone.title;
    document.getElementById('editMilestoneDescription').value = milestone.description || '';
    document.getElementById('editMilestoneStartDate').value = milestone.start_date || '';
    document.getElementById('editMilestoneDueDate').value = milestone.due_date || '';
    document.getElementById('editMilestoneStatus').value = milestone.status;
    document.getElementById('editMilestonePriority').value = milestone.priority || 999;
    
    modal.style.display = 'block';
    
    // Add event listener for form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        await saveMilestoneChanges();
    };
}

function closeMilestoneEditModal() {
    const modal = document.getElementById('milestoneEditModal');
    modal.style.display = 'none';
}

async function saveMilestoneChanges() {
    const milestoneId = document.getElementById('editMilestoneId').value;
    const projectId = document.getElementById('editProjectId').value;
    const title = document.getElementById('editMilestoneTitle').value;
    const description = document.getElementById('editMilestoneDescription').value;
    const startDate = document.getElementById('editMilestoneStartDate').value;
    const dueDate = document.getElementById('editMilestoneDueDate').value;
    const status = document.getElementById('editMilestoneStatus').value;
    
    const milestoneData = {
        title: title,
        description: description,
        date: startDate || dueDate || new Date().toISOString().split('T')[0], // Use start_date, or due_date, or current date
        start_date: startDate || null,
        due_date: dueDate || null,
        status: status,
        priority: parseInt(document.getElementById('editMilestonePriority').value) || 999
    };
    
    try {
        const response = await fetch("/api/milestones/" + milestoneId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(milestoneData)
        });
        
        if (response.ok) {
            closeMilestoneEditModal();
            showNotification('Milestone updated successfully!', 'success');
            applyTimelineFilters();
            
        } else {
            throw new Error('Failed to update milestone');
        }
    } catch (error) {
        console.error('Error updating milestone:', error);
        showNotification('Failed to update milestone. Please try again.', 'error');
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById('milestoneEditModal');
    if (event.target === modal) {
        closeMilestoneEditModal();
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1100;
        background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
        color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
        border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
        border-radius: 8px;
        padding: 1rem;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add animation styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(100%);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.notification-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.notification-close {
    background: none;
    border: none;
    font-size: 18px;
    cursor: pointer;
    margin-left: 1rem;
    opacity: 0.7;
}

.notification-close:hover {
    opacity: 1;
}
`;
document.head.appendChild(notificationStyles);