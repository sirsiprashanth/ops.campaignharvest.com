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
        <div class="milestone ${milestone.milestone_status} ${priorityClass}" style="cursor: pointer;" onclick="openMilestoneEditModal(${JSON.stringify(milestone).replace(/"/g, '&quot;')})">
            <div class="milestone-dot"></div>
            <div class="milestone-content">
                <div class="milestone-header">
                    <h4>${milestone.title}</h4>
                    <div class="milestone-meta">
                        <span class="project-name">${milestone.project_name}</span>
                        <span class="milestone-date">${formatDate(milestone.date)}</span>
                    </div>
                </div>
                <div class="milestone-body">
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
        status: status
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

.date-badge {
    background: #e3f2fd;
    color: #1565c0;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
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