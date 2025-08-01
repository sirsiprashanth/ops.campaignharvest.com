// Timeline-specific functionality
let currentProjects = [];
let timelineData = [];
let availableUsers = [];
let currentView = 'gantt'; // 'timeline' or 'gantt' - default to gantt

// Initialize timeline page
document.addEventListener('DOMContentLoaded', async () => {
    await loadTimelineData();
    setupEventListeners();
});

async function loadTimelineData() {
    try {
        // Debug: Check localStorage values
        console.log('User Role:', localStorage.getItem('userRole'));
        console.log('User Name:', localStorage.getItem('userName'));
        
        // Load projects, timeline data, and available users
        const [projects, timeline, users] = await Promise.all([
            APIService.getProjects(),
            APIService.getTimeline(),
            APIService.getUsers()
        ]);
        
        currentProjects = projects;
        timelineData = timeline;
        availableUsers = users;
        
        console.log('Timeline data loaded:', timeline.length, 'milestones');
        console.log('Available users loaded:', users.length, 'users');
        console.log('User list:', users.map(u => u.username));
        
        // Populate project filter and user dropdowns
        populateProjectFilter();
        populateUserDropdowns();
        populateAssigneeFilter();
        
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

function populateUserDropdowns() {
    const editSelect = document.getElementById('editMilestoneAssignee');
    const newSelect = document.getElementById('newMilestoneAssignee');
    
    // Clear existing options (keep "Unassigned")
    editSelect.innerHTML = '<option value="">Unassigned</option>';
    newSelect.innerHTML = '<option value="">Unassigned</option>';
    
    // Add users to both dropdowns
    availableUsers.forEach(user => {
        const displayName = user.type === 'client' ? 
            `${user.username} (${user.company_name || 'Client'})` : 
            `${user.username} (${user.type})`;
        
        const editOption = document.createElement('option');
        editOption.value = user.username;
        editOption.textContent = displayName;
        editSelect.appendChild(editOption);
        
        const newOption = document.createElement('option');
        newOption.value = user.username;
        newOption.textContent = displayName;
        newSelect.appendChild(newOption);
    });
}

function populateAssigneeFilter() {
    const select = document.getElementById('timelineAssigneeFilter');
    // Keep the existing "All Assignees" and "Unassigned" options
    select.innerHTML = '<option value="">All Assignees</option><option value="unassigned">Unassigned</option>';
    
    // Add all available users to the filter
    availableUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        const displayName = user.type === 'client' ? 
            `${user.username} (${user.company_name || 'Client'})` : 
            `${user.username} (${user.type})`;
        option.textContent = displayName;
        select.appendChild(option);
    });
}

function setupEventListeners() {
    // Filter event listeners
    ['timelineProjectFilter', 'timelinePriorityFilter', 'timelineStatusFilter', 'timelineAssigneeFilter'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyTimelineFilters);
    });
}

function applyTimelineFilters() {
    const projectFilter = document.getElementById('timelineProjectFilter').value;
    const priorityFilter = document.getElementById('timelinePriorityFilter').value;
    const statusFilter = document.getElementById('timelineStatusFilter').value;
    const assigneeFilter = document.getElementById('timelineAssigneeFilter').value;
    
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
    
    if (assigneeFilter) {
        if (assigneeFilter === 'unassigned') {
            filteredTimeline = filteredTimeline.filter(item => !item.assigned_to || item.assigned_to === '');
        } else {
            filteredTimeline = filteredTimeline.filter(item => item.assigned_to === assigneeFilter);
        }
    }
    
    renderTimeline(filteredTimeline);
}

function renderTimeline(timeline) {
    const container = document.getElementById('consolidatedTimeline');
    
    if (timeline.length === 0) {
        container.innerHTML = '<p class="no-data">No milestones found matching the current filters.</p>';
        return;
    }
    
    // Sort timeline by start date (earliest first)
    const sortedTimeline = [...timeline].sort((a, b) => {
        const dateA = new Date(a.start_date || a.date);
        const dateB = new Date(b.start_date || b.date);
        return dateA - dateB;
    });
    
    // Render based on current view mode
    if (currentView === 'gantt') {
        renderGanttChart(sortedTimeline);
    } else {
        renderTraditionalTimeline(sortedTimeline);
    }
}

function renderTraditionalTimeline(timeline) {
    const container = document.getElementById('consolidatedTimeline');
    
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

function renderGanttChart(timeline) {
    const container = document.getElementById('consolidatedTimeline');
    
    // Calculate date range for the chart
    const dateRange = calculateDateRange(timeline);
    const totalDays = Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24));
    
    // Group milestones by project for better organization
    const projectGroups = groupByProject(timeline);
    
    let ganttHTML = `
        <div class="gantt-container">
            <div class="gantt-header">
                <div class="gantt-timeline-header">
                    ${createDateHeaders(dateRange, totalDays)}
                </div>
            </div>
            <div class="gantt-body">
    `;
    
    // Create rows for each project
    Object.entries(projectGroups).forEach(([projectName, milestones]) => {
        ganttHTML += `
            <div class="gantt-project-group">
                <div class="gantt-project-header">
                    <h4>${projectName}</h4>
                </div>
                <div class="gantt-project-rows">
        `;
        
        milestones.forEach(milestone => {
            ganttHTML += createGanttRow(milestone, dateRange, totalDays);
        });
        
        ganttHTML += `
                </div>
            </div>
        `;
    });
    
    ganttHTML += `
            </div>
        </div>
    `;
    
    container.innerHTML = ganttHTML;
    
    // Auto-scroll to current week
    requestAnimationFrame(() => {
        const timelineHeader = document.querySelector('.gantt-timeline-header');
        const ganttBody = document.querySelector('.gantt-body');
        
        if (timelineHeader && ganttBody) {
            // Calculate scroll position to show current week (default view)
            const dayWidth = 100;
            const daysToCurrentWeek = Math.floor((dateRange.defaultViewStart - dateRange.start) / (1000 * 60 * 60 * 24));
            const scrollPosition = Math.max(0, daysToCurrentWeek * dayWidth - 200); // Offset for better view
            
            timelineHeader.scrollLeft = scrollPosition;
            ganttBody.scrollLeft = scrollPosition;
            
            // Sync scroll between header and body
            timelineHeader.addEventListener('scroll', () => {
                ganttBody.scrollLeft = timelineHeader.scrollLeft;
            });
            
            ganttBody.addEventListener('scroll', () => {
                timelineHeader.scrollLeft = ganttBody.scrollLeft;
            });
        }
    });
    
    // Animate gantt chart
    gsap.from('.gantt-row', {
        x: -50,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power3.out"
    });
}

function calculateDateRange(timeline) {
    // Show 1 week by default, starting from today
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End on Saturday
    
    // However, we'll create a wider range for scrolling purposes
    // but only show 1 week in the viewport initially
    const dates = [];
    
    timeline.forEach(milestone => {
        if (milestone.start_date) dates.push(new Date(milestone.start_date));
        if (milestone.due_date) dates.push(new Date(milestone.due_date));
        if (!milestone.start_date && !milestone.due_date && milestone.date) {
            dates.push(new Date(milestone.date));
        }
    });
    
    let rangeStart, rangeEnd;
    
    if (dates.length === 0) {
        // Default to 3 months range centered on current week
        rangeStart = new Date(startOfWeek);
        rangeStart.setDate(rangeStart.getDate() - 30); // 30 days before
        rangeEnd = new Date(endOfWeek);
        rangeEnd.setDate(rangeEnd.getDate() + 60); // 60 days after
    } else {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // Extend range to include all data plus padding
        const startPadding = 30 * 24 * 60 * 60 * 1000; // 30 days
        const endPadding = 30 * 24 * 60 * 60 * 1000; // 30 days
        
        rangeStart = new Date(Math.min(minDate.getTime() - startPadding, startOfWeek.getTime() - 30 * 24 * 60 * 60 * 1000));
        rangeEnd = new Date(Math.max(maxDate.getTime() + endPadding, endOfWeek.getTime() + 60 * 24 * 60 * 60 * 1000));
    }
    
    return {
        start: rangeStart,
        end: rangeEnd,
        defaultViewStart: startOfWeek,
        defaultViewEnd: endOfWeek
    };
}

function groupByProject(timeline) {
    const groups = {};
    timeline.forEach(milestone => {
        const projectName = milestone.project_name;
        if (!groups[projectName]) {
            groups[projectName] = [];
        }
        groups[projectName].push(milestone);
    });
    
    // Sort milestones within each project by start date (earliest first)
    Object.keys(groups).forEach(projectName => {
        groups[projectName].sort((a, b) => {
            const dateA = new Date(a.start_date || a.date);
            const dateB = new Date(b.start_date || b.date);
            return dateA - dateB;
        });
    });
    
    return groups;
}

function createDateHeaders(dateRange, totalDays) {
    let headersHTML = '<div class="gantt-date-headers">';
    
    const current = new Date(dateRange.start);
    const dayWidth = 100; // Fixed width per day for scrolling
    
    while (current <= dateRange.end) {
        const isToday = current.toDateString() === new Date().toDateString();
        const isWeekend = current.getDay() === 0 || current.getDay() === 6;
        const isDefaultWeek = current >= dateRange.defaultViewStart && current <= dateRange.defaultViewEnd;
        
        headersHTML += `
            <div class="gantt-date-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${isDefaultWeek ? 'default-week' : ''}" 
                 style="min-width: ${dayWidth}px; width: ${dayWidth}px;">
                <div class="date-day">${current.getDate()}</div>
                <div class="date-month">${current.toLocaleDateString('en', {month: 'short'})}</div>
            </div>
        `;
        
        current.setDate(current.getDate() + 1);
    }
    
    headersHTML += '</div>';
    return headersHTML;
}

function createGanttRow(milestone, dateRange, totalDays) {
    const startDate = milestone.start_date ? new Date(milestone.start_date) : new Date(milestone.date);
    const endDate = milestone.due_date ? new Date(milestone.due_date) : startDate;
    
    // Calculate position and width in pixels
    const dayWidth = 100; // pixels per day
    const startOffset = Math.max(0, (startDate - dateRange.start) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (endDate - startDate) / (1000 * 60 * 60 * 24));
    
    const leftPixels = startOffset * dayWidth;
    const widthPixels = Math.max(20, duration * dayWidth); // Minimum 20px width
    
    const statusClass = `milestone-${milestone.milestone_status}`;
    const priorityClass = milestone.project_priority === 'converted' ? 'priority-1' : 'priority-2';
    
    // Determine text positioning based on bar width
    const isSmallBar = widthPixels < 80;
    const textPosition = isSmallBar ? 'outside' : 'inside';
    const textStyle = isSmallBar ? 
        `position: absolute; left: ${widthPixels + 8}px; top: 50%; transform: translateY(-50%); color: #374151 !important; background: white !important; padding: 0.25rem 0.5rem !important; border-radius: 0.375rem !important; border: 1px solid #d1d5db !important; box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important; font-weight: 500 !important; z-index: 20 !important; cursor: pointer !important; pointer-events: auto !important;` : 
        '';
    const textOnClick = isSmallBar ? `onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})"` : '';

    return `
        <div class="gantt-row">
            <div class="gantt-task-info">
                <div class="task-title" onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})" 
                     style="cursor: pointer;" title="${milestone.title}">
                    ${milestone.title}
                </div>
                <div class="task-meta">
                    <span class="task-dates">
                        ${formatDate(startDate)} 
                        ${endDate > startDate ? '→ ' + formatDate(endDate) : ''}
                    </span>
                    ${milestone.assigned_to ? `<span class="assignee-mini">👤 ${milestone.assigned_to}</span>` : ''}
                </div>
            </div>
            <div class="gantt-timeline">
                <div class="gantt-timeline-content" style="position: relative; width: ${(dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24) * 100}px; height: 100%;">
                    <div class="gantt-bar ${statusClass} ${priorityClass}" 
                         style="left: ${leftPixels}px; width: ${widthPixels}px; cursor: pointer;"
                         title="${milestone.project_name}: ${milestone.title} (${formatDate(startDate)} - ${formatDate(endDate)})"
                         onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})">
                        <div class="gantt-bar-content">
                            <span class="gantt-bar-text ${textPosition}" style="${textStyle}" ${textOnClick}>
                                <span class="project-prefix">${milestone.project_name}:</span> ${milestone.title}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
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
                        <div class="assignee-click" onclick="openAssignmentModal('${milestone.id}', '${milestone.title.replace(/'/g, "\\'")}'); event.stopPropagation();">
                            ${milestone.assigned_to ? `<span class="assignee-badge clickable">👤 ${milestone.assigned_to}</span>` : '<span class="assignee-badge unassigned clickable">👤 Unassigned</span>'}
                        </div>
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
    document.getElementById('editMilestoneStartDate').value = milestone.start_date || '';
    document.getElementById('editMilestoneDueDate').value = milestone.due_date || '';
    document.getElementById('editMilestoneStatus').value = milestone.milestone_status;
    document.getElementById('editMilestonePriority').value = milestone.priority || 999;
    document.getElementById('editMilestoneAssignee').value = milestone.assigned_to || '';
    
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
    const startDate = document.getElementById('editMilestoneStartDate').value;
    const dueDate = document.getElementById('editMilestoneDueDate').value;
    const status = document.getElementById('editMilestoneStatus').value;
    const assignee = document.getElementById('editMilestoneAssignee').value;
    
    const milestoneData = {
        title: title,
        description: description,
        start_date: startDate || null,
        due_date: dueDate || null,
        status: status,
        priority: parseInt(document.getElementById('editMilestonePriority').value) || 999,
        assigned_to: assignee || null
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
    
    // Sort by start date (earliest first)
    const sortedMilestones = [...projectMilestones].sort((a, b) => {
        const dateA = new Date(a.start_date || a.date);
        const dateB = new Date(b.start_date || b.date);
        return dateA - dateB;
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
            priority: parseInt(document.getElementById('newMilestonePriority').value) || 999,
            assigned_to: document.getElementById('newMilestoneAssignee').value || null
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

// Assignment modal functions
let currentAssignmentMilestoneId = null;

function openAssignmentModal(milestoneId, milestoneTitle) {
    currentAssignmentMilestoneId = milestoneId;
    
    const modal = document.getElementById('assignmentModal');
    const titleElement = document.getElementById('assignmentMilestoneTitle');
    const buttonsContainer = document.getElementById('assignmentButtons');
    
    const userRole = localStorage.getItem('userRole');
    const userName = localStorage.getItem('userName');
    
    titleElement.textContent = milestoneTitle;
    
    // Clear existing buttons
    buttonsContainer.innerHTML = '';
    
    // Add "Unassigned" button
    const unassignedBtn = document.createElement('button');
    unassignedBtn.className = 'assignment-btn unassigned-btn';
    unassignedBtn.textContent = '👤 Unassigned';
    unassignedBtn.onclick = () => updateAssignment(milestoneId, '');
    buttonsContainer.appendChild(unassignedBtn);
    
    if (userRole === 'manager') {
        // Managers can only assign tasks to themselves
        const selfBtn = document.createElement('button');
        selfBtn.className = 'assignment-btn';
        selfBtn.textContent = `👤 ${userName} (me)`;
        selfBtn.onclick = () => updateAssignment(milestoneId, userName);
        buttonsContainer.appendChild(selfBtn);
    } else {
        // Admins and clients can assign to anyone
        availableUsers.forEach(user => {
            const btn = document.createElement('button');
            btn.className = 'assignment-btn';
            const displayName = user.type === 'client' ? 
                `👤 ${user.username} (${user.company_name || 'Client'})` : 
                `👤 ${user.username} (${user.type})`;
            btn.textContent = displayName;
            btn.onclick = () => updateAssignment(milestoneId, user.username);
            buttonsContainer.appendChild(btn);
        });
    }
    
    modal.style.display = 'block';
}

function closeAssignmentModal() {
    const modal = document.getElementById('assignmentModal');
    modal.style.display = 'none';
    currentAssignmentMilestoneId = null;
}

async function updateAssignment(milestoneId, assignedTo) {
    try {
        // Find the current milestone data from timelineData
        const milestone = timelineData.find(m => m.id === milestoneId);
        if (!milestone) {
            throw new Error('Milestone not found');
        }
        
        // Update with all current data plus new assignment
        const response = await fetch(`/api/milestones/${milestoneId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: milestone.title,
                description: milestone.description,
                date: milestone.date,
                start_date: milestone.start_date,
                due_date: milestone.due_date,
                status: milestone.milestone_status,
                priority: milestone.priority || 999,
                assigned_to: assignedTo || null
            })
        });
        
        if (response.ok) {
            showNotification('Assignment updated successfully!', 'success');
            // Close the modal
            closeAssignmentModal();
            // Reload timeline to reflect changes
            await loadTimelineData();
        } else {
            throw new Error('Failed to update assignment');
        }
    } catch (error) {
        console.error('Error updating assignment:', error);
        showNotification('Failed to update assignment. Please try again.', 'error');
    }
}

// Close assignment modal when clicking outside
document.addEventListener('click', (event) => {
    const modal = document.getElementById('assignmentModal');
    if (event.target === modal) {
        closeAssignmentModal();
    }
});

// Close assignment modal on escape key
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeAssignmentModal();
    }
});

// View switching functionality
function switchTimelineView(viewType) {
    currentView = viewType;
    
    // Update button states
    document.getElementById('timelineViewBtn').classList.toggle('active', viewType === 'timeline');
    document.getElementById('ganttViewBtn').classList.toggle('active', viewType === 'gantt');
    
    // Show/hide navigation controls
    const ganttNavigation = document.getElementById('ganttNavigation');
    if (ganttNavigation) {
        ganttNavigation.style.display = viewType === 'gantt' ? 'flex' : 'none';
    }
    
    // Re-render the timeline with the new view
    applyTimelineFilters();
}

// Week navigation functionality
let currentScrollOffset = 0;

function navigateWeek(direction) {
    const timelineHeader = document.querySelector('.gantt-timeline-header');
    const ganttBody = document.querySelector('.gantt-body');
    
    if (timelineHeader && ganttBody) {
        const dayWidth = 100;
        const weekWidth = dayWidth * 7; // 7 days per week
        currentScrollOffset += direction * weekWidth;
        
        // Ensure we don't scroll beyond the content
        const maxScroll = timelineHeader.scrollWidth - timelineHeader.clientWidth;
        currentScrollOffset = Math.max(0, Math.min(currentScrollOffset, maxScroll));
        
        timelineHeader.scrollTo({
            left: currentScrollOffset,
            behavior: 'smooth'
        });
        ganttBody.scrollTo({
            left: currentScrollOffset,
            behavior: 'smooth'
        });
    }
}

function navigateToToday() {
    const timelineHeader = document.querySelector('.gantt-timeline-header');
    const ganttBody = document.querySelector('.gantt-body');
    
    if (timelineHeader && ganttBody) {
        // Find the current week position and scroll to it
        const todayHeader = document.querySelector('.gantt-date-header.today');
        if (todayHeader) {
            const dayWidth = 100;
            const scrollPosition = Math.max(0, todayHeader.offsetLeft - 200); // Center with offset
            currentScrollOffset = scrollPosition;
            
            timelineHeader.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
            ganttBody.scrollTo({
                left: scrollPosition,
                behavior: 'smooth'
            });
        }
    }
}