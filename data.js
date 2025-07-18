// Sample project data
const projectData = {
    name: "E-Commerce Platform Redesign",
    startDate: "2024-01-15",
    endDate: "2024-04-15",
    currentWeek: 8,
    totalWeeks: 12,
    budget: {
        allocated: 50000,
        spent: 45000
    },
    teamSize: 8,
    status: "on-track", // can be: on-track, at-risk, delayed
    milestones: [
        {
            id: 1,
            title: "Project Kickoff",
            date: "2024-01-15",
            status: "completed",
            description: "Initial project setup and team onboarding"
        },
        {
            id: 2,
            title: "Requirements Analysis",
            date: "2024-01-29",
            status: "completed",
            description: "Gather and document all project requirements"
        },
        {
            id: 3,
            title: "Design Phase",
            date: "2024-02-12",
            status: "completed",
            description: "Complete UI/UX designs and prototypes"
        },
        {
            id: 4,
            title: "Development Sprint 1",
            date: "2024-02-26",
            status: "completed",
            description: "Core functionality implementation"
        },
        {
            id: 5,
            title: "Development Sprint 2",
            date: "2024-03-11",
            status: "current",
            description: "Advanced features and integrations"
        },
        {
            id: 6,
            title: "Testing & QA",
            date: "2024-03-25",
            status: "upcoming",
            description: "Comprehensive testing and bug fixes"
        },
        {
            id: 7,
            title: "Deployment",
            date: "2024-04-08",
            status: "upcoming",
            description: "Production deployment and monitoring"
        },
        {
            id: 8,
            title: "Project Closure",
            date: "2024-04-15",
            status: "upcoming",
            description: "Final documentation and handover"
        }
    ],
    messages: [
        {
            id: 1,
            author: "John Smith",
            role: "client",
            content: "Great progress on the design phase! The mockups look fantastic. When can we expect to see the first working prototype?",
            timestamp: "2024-02-28T10:30:00",
            isAdmin: false
        },
        {
            id: 2,
            author: "Sarah Johnson",
            role: "admin",
            content: "Thank you! We're on track to have the first working prototype ready by end of next week. The development team is making excellent progress on the core functionality.",
            timestamp: "2024-02-28T11:15:00",
            isAdmin: true
        },
        {
            id: 3,
            author: "John Smith",
            role: "client",
            content: "Can we add social media integration to the scope? Our marketing team just requested this feature.",
            timestamp: "2024-03-05T14:20:00",
            isAdmin: false
        },
        {
            id: 4,
            author: "Sarah Johnson",
            role: "admin",
            content: "We can definitely incorporate social media integration. I'll prepare a scope change document with timeline and budget implications for your review.",
            timestamp: "2024-03-05T15:45:00",
            isAdmin: true
        },
        {
            id: 5,
            author: "Emily Davis",
            role: "client",
            content: "How is the mobile responsiveness coming along? This is a critical feature for our user base.",
            timestamp: "2024-03-10T09:00:00",
            isAdmin: false
        },
        {
            id: 6,
            author: "Sarah Johnson",
            role: "admin",
            content: "Mobile responsiveness is a top priority. We're implementing a mobile-first approach, and all components are being tested across various devices. You'll see this in action in the upcoming demo.",
            timestamp: "2024-03-10T09:30:00",
            isAdmin: true
        }
    ]
};

// Calculate derived values
function calculateProjectMetrics() {
    const progress = Math.round((projectData.currentWeek / projectData.totalWeeks) * 100);
    const daysRemaining = dayjs(projectData.endDate).diff(dayjs(), 'day');
    const weeksRemaining = Math.ceil(daysRemaining / 7);
    const budgetPercentage = Math.round((projectData.budget.spent / projectData.budget.allocated) * 100);
    
    return {
        progress,
        daysRemaining,
        weeksRemaining,
        budgetPercentage
    };
}