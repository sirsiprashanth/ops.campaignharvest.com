// API Service for handling all backend communication
const API_BASE_URL = '/api';

class APIService {
    // Helper method to get auth headers
    static getAuthHeaders() {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    // Projects
    static async getProjects() {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch projects');
            return await response.json();
        } catch (error) {
            console.error('Error fetching projects:', error);
            return [];
        }
    }

    static async getProject(projectId) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch project');
            return await response.json();
        } catch (error) {
            console.error('Error fetching project:', error);
            return null;
        }
    }

    static async createProject(projectData) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(projectData),
            });
            if (!response.ok) throw new Error('Failed to create project');
            return await response.json();
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    }

    static async updateProject(projectId, projectData) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(projectData),
            });
            if (!response.ok) throw new Error('Failed to update project');
            return await response.json();
        } catch (error) {
            console.error('Error updating project:', error);
            throw error;
        }
    }

    static async deleteProject(projectId) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to delete project');
            return await response.json();
        } catch (error) {
            console.error('Error deleting project:', error);
            throw error;
        }
    }

    // Milestones
    static async createMilestone(projectId, milestoneData) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}/milestones`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(milestoneData),
            });
            if (!response.ok) throw new Error('Failed to create milestone');
            return await response.json();
        } catch (error) {
            console.error('Error creating milestone:', error);
            throw error;
        }
    }

    static async updateMilestone(milestoneId, milestoneData) {
        try {
            const response = await fetch(`${API_BASE_URL}/milestones/${milestoneId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(milestoneData),
            });
            if (!response.ok) throw new Error('Failed to update milestone');
            return await response.json();
        } catch (error) {
            console.error('Error updating milestone:', error);
            throw error;
        }
    }

    static async deleteMilestone(milestoneId) {
        try {
            const response = await fetch(`${API_BASE_URL}/milestones/${milestoneId}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders(),
            });
            if (!response.ok) throw new Error('Failed to delete milestone');
            return await response.json();
        } catch (error) {
            console.error('Error deleting milestone:', error);
            throw error;
        }
    }

    // Messages
    static async getMessages() {
        try {
            const response = await fetch(`${API_BASE_URL}/messages`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch messages');
            return await response.json();
        } catch (error) {
            console.error('Error fetching messages:', error);
            return [];
        }
    }

    static async createMessage(projectId, messageData) {
        try {
            const response = await fetch(`${API_BASE_URL}/projects/${projectId}/messages`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(messageData),
            });
            if (!response.ok) throw new Error('Failed to create message');
            return await response.json();
        } catch (error) {
            console.error('Error creating message:', error);
            throw error;
        }
    }

    // Analytics
    static async getAnalytics() {
        try {
            const response = await fetch(`${API_BASE_URL}/analytics`, {
                headers: this.getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch analytics');
            return await response.json();
        } catch (error) {
            console.error('Error fetching analytics:', error);
            return {
                total_projects: 0,
                active_projects: 0,
                completed_projects: 0,
                total_messages: 0
            };
        }
    }
}