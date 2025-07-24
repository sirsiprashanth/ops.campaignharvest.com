// Timeline-specific functionality
let currentProjects = [];
let timelineData = [];

// Initialize timeline page
document.addEventListener('DOMContentLoaded', async () => {
    await loadTimelineData();
    setupEventListeners();
});

async function loadTimelineData() {
    try {
        // Load projects and timeline data
        const [projects, timeline] = await Promise.all([
            APIService.getProjects(),
            APIService.getTimeline()
        ]);
        
        currentProjects = projects;
        timelineData = timeline;
        
        // Populate project filter
        populateProjectFilter();
        
        // Set default status filter to 'upcoming'
        document.getElementById('timelineStatusFilter').value = 'upcoming';
        
        // Load timeline
        applyTimelineFilters();
        
    } catch (error) {
        console.error('Error loading timeline data:', error);
        showNotification('Failed to load timeline data', 'error');
    }
}

function populateProjectFilter() {
    const select = document.getElementById('timelineProjectFilter');
    select.innerHTML = '<option value="">All Projects</option>';
    
    currentProjects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        select.appendChild(option);
    });
}

function setupEventListeners() {
    // Filter event listeners
    ['timelineProjectFilter', 'timelinePriorityFilter', 'timelineStatusFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyTimelineFilters);
    });
}

function applyTimelineFilters() {
    const projectFilter = document.getElementById('timelineProjectFilter').value;
    const priorityFilter = document.getElementById('timelinePriorityFilter').value;
    const statusFilter = document.getElementById('timelineStatusFilter').value;
    
    let filteredTimeline = [...timelineData];
    
    if (projectFilter) {
        filteredTimeline = filteredTimeline.filter(item => item.project_id === projectFilter);
    }
    
    if (priorityFilter) {
        filteredTimeline = filteredTimeline.filter(item => item.project_priority === priorityFilter);
    }
    
    if (statusFilter) {
        filteredTimeline = filteredTimeline.filter(item => item.milestone_status === statusFilter);
    }
    
    renderTimeline(filteredTimeline);
}

function renderTimeline(timeline) {
    const container = document.getElementById('consolidatedTimeline');
    
    if (timeline.length === 0) {
        container.innerHTML = '<p class="no-data">No milestones found matching the current filters.</p>';
        return;
    }
    
    const timelineHTML = timeline.map((milestone, index) => {
        return createTimelineMilestone(milestone, index);
    }).join('');
    
    container.innerHTML = timelineHTML;
    
    // Animate timeline items
    gsap.from('.milestone', {
        y: 50,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power3.out"
    });
}

function createTimelineMilestone(milestone, index) {
    const priorityClass = milestone.project_priority === 'converted' ? 'priority-1' : 'priority-2';
    
    return `
        <div class="milestone ${milestone.milestone_status} ${priorityClass}">
            <div class="milestone-dot"></div>
            <div class="milestone-content">
                <div class="milestone-header">
                    <div class="milestone-title-row">
                        <h4 onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})" style="cursor: pointer; flex: 1;">${milestone.title}</h4>
                        <div class="milestone-priority-edit">
                            <input type="number" 
                                   class="priority-input" 
                                   value="${milestone.priority || 999}" 
                                   min="1" 
                                   max="999" 
                                   onblur="updateMilestonePriority('${milestone.id}', this.value)"
                           onkeypress="if(event.key==='Enter') updateMilestonePriority('${milestone.id}', this.value)"
                                   onclick="event.stopPropagation()"
                                   title="Priority (1 = highest)">
                        </div>
                    </div>
                    <div class="milestone-meta">
                        <span class="project-name clickable-project" onclick="openProjectMilestoneManager('${milestone.project_id}', '${milestone.project_name.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Click to manage project milestones">${milestone.project_name}</span>
                        <span class="milestone-date">${formatDate(milestone.date)}</span>
                    </div>
                </div>
                <div class="milestone-body" onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})" style="cursor: pointer;">
                    ${milestone.description ? `<p class="milestone-description">${milestone.description}</p>` : ''}
                    <div class="milestone-badges">
                        ${milestone.start_date ? `<span class="date-badge">Start: ${formatDate(milestone.start_date)}</span>` : ''}
                        ${milestone.due_date ? `<span class="date-badge">Due: ${formatDate(milestone.due_date)}</span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return '';
    return dayjs(dateString).format('MMM DD, YYYY');
}

// Milestone editing functionality
function openMilestoneEditModal(milestone) {
    const modal = document.getElementById('milestoneEditModal');
    const form = document.getElementById('milestoneEditForm');
    
    // Populate form with milestone data
    document.getElementById('editMilestoneId').value = milestone.id;
    document.getElementById('editProjectId').value = milestone.project_id;
    document.getElementById('editMilestoneTitle').value = milestone.title;
    document.getElementById('editMilestoneDescription').value = milestone.description || '';
    document.getElementById('editMilestoneDate').value = milestone.date;
    document.getElementById('editMilestoneStartDate').value = milestone.start_date || '';
    document.getElementById('editMilestoneDueDate').value = milestone.due_date || '';
    document.getElementById('editMilestoneStatus').value = milestone.milestone_status;
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
    const title = document.getElementById('editMilestoneTitle').value;
    const description = document.getElementById('editMilestoneDescription').value;
    const date = document.getElementById('editMilestoneDate').value;
    const startDate = document.getElementById('editMilestoneStartDate').value;
    const dueDate = document.getElementById('editMilestoneDueDate').value;
    const status = document.getElementById('editMilestoneStatus').value;
    
    const milestoneData = {
        title: title,
        description: description,
        date: date,
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
            await loadTimelineData(); // Reload timeline data
        } else {
            throw new Error('Failed to update milestone');
        }
    } catch (error) {
        console.error('Error updating milestone:', error);
        showNotification('Failed to update milestone. Please try again.', 'error');
    }
}

let currentProjectId = null;
let currentProjectName = null;
let projectMilestones = [];

// Open project milestone management modal
async function openProjectMilestoneManager(projectId, projectName) {
    currentProjectId = projectId;
    currentProjectName = projectName;
    
    const modal = document.getElementById('projectMilestoneModal');
    const title = document.getElementById('projectMilestoneTitle');
    
    title.textContent = `Manage Milestones - ${projectName}`;
    modal.style.display = 'block';
    
    // Load project milestones
    await loadProjectMilestones(projectId);
    
    // Setup form submission
    setupNewMilestoneForm();
}

// Close project milestone modal
function closeProjectMilestoneModal() {
    const modal = document.getElementById('projectMilestoneModal');
    modal.style.display = 'none';
    currentProjectId = null;
    currentProjectName = null;
    projectMilestones = [];
}

// Load milestones for specific project
async function loadProjectMilestones(projectId) {
    try {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/projects/${projectId}`, {
            headers: headers
        });
        
        if (response.ok) {
            const project = await response.json();
            projectMilestones = project.milestones || [];
            renderProjectMilestones();
        } else {
            throw new Error('Failed to load project milestones');
        }
    } catch (error) {
        console.error('Error loading project milestones:', error);
        showNotification('Failed to load project milestones', 'error');
    }
}

// Render project milestones list
function renderProjectMilestones() {
    const container = document.getElementById('projectMilestonesList');
    
    if (projectMilestones.length === 0) {
        container.innerHTML = '<p class="no-milestones">No milestones found for this project.</p>';
        return;
    }
    
    // Sort by priority, then by date
    const sortedMilestones = [...projectMilestones].sort((a, b) => {
        if (a.priority !== b.priority) {
            return (a.priority || 999) - (b.priority || 999);
        }
        return new Date(a.date) - new Date(b.date);
    });
    
    const milestonesHTML = sortedMilestones.map(milestone => `
        <div class="project-milestone-item">
            <div class="milestone-item-header">
                <div class="milestone-item-title">${milestone.title}</div>
                <div class="milestone-item-actions">
                    <button class="btn-small btn-edit" onclick="editProjectMilestone('${milestone.id}')">Edit</button>
                    <button class="btn-small btn-delete" onclick="deleteProjectMilestone('${milestone.id}')">Delete</button>
                </div>
            </div>
            <div class="milestone-item-meta">
                <span class="milestone-item-date">Date: ${formatDate(milestone.date)}</span>
                <span class="milestone-item-status status-${milestone.status}">${milestone.status}</span>
                <span class="milestone-item-priority">Priority: ${milestone.priority || 999}</span>
            </div>
            ${milestone.description ? `<div class="milestone-item-description">${milestone.description}</div>` : ''}
            <div class="milestone-item-dates">
                ${milestone.start_date ? `<span class="date-info">Start: ${formatDate(milestone.start_date)}</span>` : ''}
                ${milestone.due_date ? `<span class="date-info">Due: ${formatDate(milestone.due_date)}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    container.innerHTML = milestonesHTML;
}

// Setup new milestone form
function setupNewMilestoneForm() {
    const form = document.getElementById('newMilestoneForm');
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        await createNewMilestone();
    };
}

// Create new milestone
async function createNewMilestone() {
    try {
        const milestoneData = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            title: document.getElementById('newMilestoneTitle').value,
            date: document.getElementById('newMilestoneDate').value,
            start_date: document.getElementById('newMilestoneStartDate').value || null,
            due_date: document.getElementById('newMilestoneDueDate').value || null,
            description: document.getElementById('newMilestoneDescription').value,
            status: document.getElementById('newMilestoneStatus').value,
            milestone_type: 'general',
            priority: parseInt(document.getElementById('newMilestonePriority').value) || 999
        };
        
        const response = await APIService.createMilestone(currentProjectId, milestoneData);
        
        if (response) {
            showNotification('Milestone created successfully!', 'success');
            
            // Clear form
            document.getElementById('newMilestoneForm').reset();
            document.getElementById('newMilestonePriority').value = 999;
            
            // Reload milestones
            await loadProjectMilestones(currentProjectId);
            
            // Refresh main timeline
            await loadTimelineData();
        }
    } catch (error) {
        console.error('Error creating milestone:', error);
        showNotification('Failed to create milestone. Please try again.', 'error');
    }
}

// Edit project milestone
async function editProjectMilestone(milestoneId) {
    const milestone = projectMilestones.find(m => m.id === milestoneId);
    if (!milestone) return;
    
    // Close project modal and open regular edit modal
    closeProjectMilestoneModal();
    openMilestoneEditModal(milestone);
}

// Delete project milestone
async function deleteProjectMilestone(milestoneId) {
    if (!confirm('Are you sure you want to delete this milestone?')) {
        return;
    }
    
    try {
        const response = await APIService.deleteMilestone(milestoneId);
        
        if (response) {
            showNotification('Milestone deleted successfully!', 'success');
            
            // Reload milestones
            await loadProjectMilestones(currentProjectId);
            
            // Refresh main timeline
            await loadTimelineData();
        }
    } catch (error) {
        console.error('Error deleting milestone:', error);
        showNotification('Failed to delete milestone. Please try again.', 'error');
    }
}

// Close modal when clicking outside of it
window.onclick = function(event) {
    const milestoneModal = document.getElementById('milestoneEditModal');
    const projectModal = document.getElementById('projectMilestoneModal');
    
    if (event.target === milestoneModal) {
        closeMilestoneEditModal();
    }
    
    if (event.target === projectModal) {
        closeProjectMilestoneModal();
    }
}

// Update milestone priority function
async function updateMilestonePriority(milestoneId, newPriority) {
    try {
        const priorityValue = parseInt(newPriority) || 999;
        
        // Get current milestone data first
        const currentMilestone = timelineData.find(m => m.id === milestoneId);
        if (!currentMilestone) {
            throw new Error('Milestone not found');
        }
        
        const milestoneData = {
            title: currentMilestone.title,
            description: currentMilestone.description,
            date: currentMilestone.date,
            start_date: currentMilestone.start_date,
            due_date: currentMilestone.due_date,
            status: currentMilestone.milestone_status,
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
        
        console.log('Updating milestone priority:', { milestoneId, priorityValue, milestoneData });
        
        const response = await fetch(`/api/milestones/${milestoneId}`, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(milestoneData)
        });
        
        if (response.ok) {
            console.log('Priority update successful');
            showNotification(`Priority updated to ${priorityValue}`, 'success');
            await loadTimelineData(); // Reload timeline to show new order
        } else {
            const errorData = await response.text();
            console.error('Priority update failed:', response.status, errorData);
            throw new Error(`Failed to update priority: ${response.status} ${errorData}`);
        }
    } catch (error) {
        console.error('Error updating milestone priority:', error);
        showNotification('Failed to update priority. Please try again.', 'error');
        // Reload to reset the input value
        await loadTimelineData();
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

.date-badge {
    background: #e3f2fd;
    color: #1565c0;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.priority-badge {
    background: #fff3cd;
    color: #856404;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.milestone-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
}

.milestone-priority-edit {
    flex-shrink: 0;
}

.priority-input {
    width: 50px;
    padding: 0.25rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.75rem;
    text-align: center;
    background: white;
}

.priority-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
}

.clickable-project {
    cursor: pointer;
    color: #4f46e5;
    text-decoration: underline;
    transition: color 0.2s;
}

.clickable-project:hover {
    color: #6366f1;
}

.project-milestone-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-height: 70vh;
    overflow-y: auto;
}

.add-milestone-section {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 1.5rem;
}

.add-milestone-section h4 {
    margin-bottom: 1rem;
    color: #374151;
}

.form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
}

.form-row .form-group {
    flex: 1;
}

.existing-milestones-section h4 {
    margin-bottom: 1rem;
    color: #374151;
}

.project-milestones-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
}

.project-milestone-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    background: #f9fafb;
}

.milestone-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
}

.milestone-item-title {
    font-weight: 500;
    font-size: 1rem;
    color: #111827;
}

.milestone-item-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
}

.btn-edit {
    background: #3b82f6;
    color: white;
}

.btn-edit:hover {
    background: #2563eb;
}

.btn-delete {
    background: #ef4444;
    color: white;
}

.btn-delete:hover {
    background: #dc2626;
}

.milestone-item-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
}

.milestone-item-date {
    color: #6b7280;
}

.milestone-item-status {
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
}

.status-upcoming {
    background: #fef3c7;
    color: #d97706;
}

.status-current {
    background: #dbeafe;
    color: #2563eb;
}

.status-completed {
    background: #d1fae5;
    color: #059669;
}

.milestone-item-priority {
    color: #374151;
    font-weight: 500;
}

.milestone-item-description {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
    line-height: 1.4;
}

.milestone-item-dates {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
}

.date-info {
    color: #6b7280;
    background: #f3f4f6;
    padding: 0.125rem 0.5rem;
    border-radius: 12px;
}

.no-milestones {
    text-align: center;
    color: #6b7280;
    font-style: italic;
    padding: 2rem;
}

.btn-primary {
    background: #4f46e5;
    color: white;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s;
}

.btn-primary:hover {
    background: #4338ca;
}

.no-data {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 2rem;
    font-size: 1.1rem;
}
`;
document.head.appendChild(notificationStyles);