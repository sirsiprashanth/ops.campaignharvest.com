const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret';

// User credentials
const users = {
    admin: {
        username: process.env.ADMIN_USERNAME || 'admin',
        passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10),
        role: 'admin'
    },
    manager: {
        username: process.env.MANAGER_USERNAME || 'manager',
        passwordHash: bcrypt.hashSync(process.env.MANAGER_PASSWORD || 'manager123', 10),
        role: 'manager'
    }
};

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(bodyParser.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files
app.use(express.static('.'));

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token.' });
        }
        req.user = user;
        next();
    });
}

// Middleware for admin-only endpoints
function adminOnly(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }
        next();
    });
}

// Middleware for admin and manager endpoints
function adminOrManager(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ error: 'Access denied. Admin or Manager only.' });
        }
        next();
    });
}

// Optional auth middleware (for endpoints that work with or without auth)
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (!err) {
                req.user = user;
            }
        });
    }
    next();
}

// Middleware for client access - checks if client has access to the requested project
function clientProjectAccess(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            // Admin and manager have access to all projects
            next();
            return;
        }
        
        if (req.user.role === 'client') {
            const projectId = req.params.id || req.params.projectId || req.query.projectId;
            if (!projectId) {
                return res.status(400).json({ error: 'Project ID required' });
            }
            
            // Check if client has access to this project
            db.get(
                `SELECT * FROM project_assignments WHERE client_username = ? AND project_id = ?`,
                [req.user.username, projectId],
                (err, assignment) => {
                    if (err || !assignment) {
                        return res.status(403).json({ error: 'Access denied to this project' });
                    }
                    next();
                }
            );
        } else {
            res.status(403).json({ error: 'Invalid role' });
        }
    });
}

// Initialize SQLite database
const db = new sqlite3.Database('./campaign_harvest.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    db.serialize(() => {
        // Projects table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            budget INTEGER NOT NULL,
            team_size INTEGER NOT NULL,
            status TEXT NOT NULL,
            project_type TEXT DEFAULT 'fixed',
            priority TEXT DEFAULT 'pipeline',
            urgency INTEGER DEFAULT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Add project_type column to existing tables
        db.run(`ALTER TABLE projects ADD COLUMN project_type TEXT DEFAULT 'fixed'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding project_type column:', err.message);
            }
        });
        
        // Add priority column to existing tables
        db.run(`ALTER TABLE projects ADD COLUMN priority TEXT DEFAULT 'pipeline'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding priority column:', err.message);
            }
        });
        
        // Add urgency column to existing tables
        db.run(`ALTER TABLE projects ADD COLUMN urgency INTEGER DEFAULT NULL`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding urgency column:', err.message);
            }
        });
        
        // Check if we need to migrate the table to allow NULL end_date
        db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'", (err, row) => {
            if (!err && row && row.sql.includes('end_date TEXT NOT NULL')) {
                console.log('Migrating projects table to allow NULL end_date...');
                
                // Create a new temporary table with the updated schema
                db.run(`CREATE TABLE IF NOT EXISTS projects_temp (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT,
                    budget INTEGER NOT NULL,
                    team_size INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    project_type TEXT DEFAULT 'fixed',
                    priority TEXT DEFAULT 'pipeline',
                    urgency INTEGER DEFAULT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        console.error('Error creating temp table:', err.message);
                        return;
                    }
                    
                    // Copy data from old table to new table
                    db.run(`INSERT INTO projects_temp 
                            SELECT id, name, start_date, end_date, budget, team_size, status, 
                                   COALESCE(project_type, 'fixed'), 
                                   COALESCE(priority, 'pipeline'), 
                                   COALESCE(urgency, NULL), created_at
                            FROM projects`, (err) => {
                        if (err) {
                            console.error('Error copying data:', err.message);
                            return;
                        }
                        
                        // Drop old table
                        db.run(`DROP TABLE projects`, (err) => {
                            if (err) {
                                console.error('Error dropping old table:', err.message);
                                return;
                            }
                            
                            // Rename new table
                            db.run(`ALTER TABLE projects_temp RENAME TO projects`, (err) => {
                                if (err) {
                                    console.error('Error renaming table:', err.message);
                                    return;
                                }
                                console.log('Successfully migrated projects table to allow NULL end_date');
                            });
                        });
                    });
                });
            }
        });

        // Milestones table
        db.run(`CREATE TABLE IF NOT EXISTS milestones (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            status TEXT NOT NULL,
            milestone_type TEXT DEFAULT 'general',
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`);
        
        // Add milestone_type column to existing tables
        db.run(`ALTER TABLE milestones ADD COLUMN milestone_type TEXT DEFAULT 'general'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding milestone_type column:', err.message);
            }
        });

        // Messages table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            author TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`);

        // Audit log table
        db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            action TEXT NOT NULL,
            old_values TEXT,
            new_values TEXT,
            user_name TEXT NOT NULL,
            user_role TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
        )`);
        
        // Project assignments table for client access
        db.run(`CREATE TABLE IF NOT EXISTS project_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_username TEXT NOT NULL,
            project_id TEXT NOT NULL,
            assigned_by TEXT NOT NULL,
            assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
            UNIQUE(client_username, project_id)
        )`);
        
        // Client users table
        db.run(`CREATE TABLE IF NOT EXISTS client_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            email TEXT,
            company_name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Add default client user for testing
        const defaultClientPassword = bcrypt.hashSync(process.env.CLIENT_DEFAULT_PASSWORD || 'client123', 10);
        db.run(
            `INSERT OR IGNORE INTO client_users (username, password_hash, email) VALUES (?, ?, ?)`,
            [process.env.CLIENT_DEFAULT_USERNAME || 'client', defaultClientPassword, 'client@example.com'],
            (err) => {
                if (err) {
                    console.error('Error creating default client user:', err);
                } else {
                    console.log('Default client user ready');
                }
            }
        );

        console.log('Database tables initialized.');
    });
}

// Authentication Routes

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // First check admin and manager users
        let user = null;
        let userRole = null;
        
        for (const [key, userData] of Object.entries(users)) {
            if (userData.username === username) {
                user = userData;
                userRole = userData.role;
                break;
            }
        }

        // If not found in static users, check client_users table
        if (!user) {
            const clientUser = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT * FROM client_users WHERE username = ?`,
                    [username],
                    (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    }
                );
            });
            
            if (clientUser) {
                user = clientUser;
                userRole = 'client';
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.passwordHash || user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { username: username, role: userRole },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Set session
        req.session.user = { username, role: userRole };

        res.json({ 
            success: true, 
            token,
            user: { username, role: userRole }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An error occurred during login' });
    }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({ 
        valid: true, 
        user: req.user 
    });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// API Routes

// Get all projects (with optional auth)
app.get('/api/projects', optionalAuth, async (req, res) => {
    try {
        let query = `SELECT * FROM projects ORDER BY urgency ASC NULLS LAST, created_at DESC`;
        let params = [];
        
        // If user is a client, filter projects by assignment
        if (req.user && req.user.role === 'client') {
            query = `SELECT p.* FROM projects p 
                     INNER JOIN project_assignments pa ON p.id = pa.project_id 
                     WHERE pa.client_username = ? 
                     ORDER BY p.urgency ASC NULLS LAST, p.created_at DESC`;
            params = [req.user.username];
        }
        
        db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Filter budget information for non-admin users
        const isAdmin = req.user && req.user.role === 'admin';
        if (!isAdmin) {
            rows = rows.map(project => {
                const { budget, ...projectWithoutBudget } = project;
                return projectWithoutBudget;
            });
        }
        
        // Get milestones and messages count for each project
        const projectPromises = rows.map(project => {
            return new Promise((resolve) => {
                // Filter finance milestones if user is not admin
                const isAdmin = req.user && req.user.role === 'admin';
                const milestoneQuery = isAdmin 
                    ? `SELECT * FROM milestones WHERE project_id = ?`
                    : `SELECT * FROM milestones WHERE project_id = ? AND milestone_type != 'finance'`;
                
                db.all(milestoneQuery, [project.id], (err, milestones) => {
                    db.get(`SELECT COUNT(*) as message_count FROM messages WHERE project_id = ?`, [project.id], (err, messageCount) => {
                        resolve({
                            ...project,
                            milestones: milestones || [],
                            milestones_count: milestones ? milestones.length : 0,
                            messages_count: messageCount ? messageCount.message_count : 0
                        });
                    });
                });
            });
        });
        
        Promise.all(projectPromises).then(projects => {
            res.json(projects);
        });
    });
    } catch (error) {
        console.error('Error loading projects:', error);
        res.status(500).json({ error: 'Failed to load projects' });
    }
});

// Get single project with all details (with client access check)
app.get('/api/projects/:id', clientProjectAccess, (req, res) => {
    const projectId = req.params.id;
    
    db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, project) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        
        // Filter budget information for non-admin users
        const isAdmin = req.user && req.user.role === 'admin';
        if (!isAdmin && project.budget !== undefined) {
            delete project.budget;
        }
        
        // Get milestones (filter finance if not admin)
        const milestoneQuery = isAdmin 
            ? `SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC`
            : `SELECT * FROM milestones WHERE project_id = ? AND milestone_type != 'finance' ORDER BY date ASC`;
        
        db.all(milestoneQuery, [projectId], (err, milestones) => {
            // Get messages
            db.all(`SELECT * FROM messages WHERE project_id = ? ORDER BY timestamp ASC`, [projectId], (err, messages) => {
                res.json({
                    ...project,
                    milestones: milestones || [],
                    messages: messages || []
                });
            });
        });
    });
});

// Create new project (admin or manager)
app.post('/api/projects', adminOrManager, (req, res) => {
    const { id, name, start_date, end_date, budget, team_size, status, project_type, priority, urgency } = req.body;
    
    // For pipeline projects, set defaults for optional fields
    const projectData = {
        id,
        name,
        start_date: start_date || (priority === 'pipeline' ? new Date().toISOString().split('T')[0] : start_date),
        end_date: end_date || null,
        budget: budget || (priority === 'pipeline' ? 0 : budget),
        team_size: team_size || (priority === 'pipeline' ? 2 : team_size),
        status,
        project_type: project_type || (priority === 'pipeline' ? null : 'fixed'),
        priority: priority || 'pipeline',
        urgency: urgency || null
    };
    
    db.run(`INSERT INTO projects (id, name, start_date, end_date, budget, team_size, status, project_type, priority, urgency) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectData.id, projectData.name, projectData.start_date, projectData.end_date, 
         projectData.budget, projectData.team_size, projectData.status, projectData.project_type, 
         projectData.priority, projectData.urgency],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id, message: 'Project created successfully' });
        }
    );
});

// Update project (admin or manager)
app.put('/api/projects/:id', adminOrManager, (req, res) => {
    const { name, start_date, end_date, budget, team_size, status, project_type, priority, urgency } = req.body;
    const projectId = req.params.id;
    
    db.run(`UPDATE projects SET name = ?, start_date = ?, end_date = ?, budget = ?, team_size = ?, status = ?, project_type = ?, priority = ?, urgency = ?
            WHERE id = ?`,
        [name, start_date, end_date, budget, team_size, status, project_type || null, priority || 'pipeline', urgency, projectId],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Project updated successfully' });
        }
    );
});

// Update project urgency with automatic reordering (admin or manager)
app.put('/api/projects/:id/urgency', adminOrManager, (req, res) => {
    const projectId = req.params.id;
    const newUrgency = req.body.urgency;
    
    if (newUrgency === null || newUrgency === undefined) {
        // If urgency is cleared, just update it
        db.run(`UPDATE projects SET urgency = NULL WHERE id = ?`, [projectId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ message: 'Project urgency cleared successfully' });
        });
        return;
    }
    
    // Convert to integer
    const urgencyValue = parseInt(newUrgency);
    
    if (isNaN(urgencyValue) || urgencyValue < 1) {
        res.status(400).json({ error: 'Invalid urgency value' });
        return;
    }
    
    db.serialize(() => {
        // Start transaction
        db.run('BEGIN TRANSACTION');
        
        // Check if another project already has this urgency
        db.get(`SELECT id FROM projects WHERE urgency = ? AND id != ?`, [urgencyValue, projectId], (err, existingProject) => {
            if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (existingProject) {
                // Shift all projects with urgency >= newUrgency up by 1
                db.run(`UPDATE projects SET urgency = urgency + 1 WHERE urgency >= ? AND id != ?`, 
                    [urgencyValue, projectId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    // Update the target project
                    db.run(`UPDATE projects SET urgency = ? WHERE id = ?`, [urgencyValue, projectId], (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            res.status(500).json({ error: err.message });
                            return;
                        }
                        
                        db.run('COMMIT');
                        res.json({ message: 'Project urgency updated successfully with reordering' });
                    });
                });
            } else {
                // No conflict, just update
                db.run(`UPDATE projects SET urgency = ? WHERE id = ?`, [urgencyValue, projectId], (err) => {
                    if (err) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: err.message });
                        return;
                    }
                    
                    db.run('COMMIT');
                    res.json({ message: 'Project urgency updated successfully' });
                });
            }
        });
    });
});

// Delete project
app.delete('/api/projects/:id', adminOrManager, (req, res) => {
    const projectId = req.params.id;
    
    db.run(`DELETE FROM projects WHERE id = ?`, [projectId], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Project deleted successfully' });
    });
});

// Milestone endpoints with audit logging (admin or manager)
app.post('/api/projects/:projectId/milestones', adminOrManager, (req, res) => {
    const { id, title, date, description, status, milestone_type } = req.body;
    const projectId = req.params.projectId;
    const type = milestone_type || 'general';
    
    db.run(`INSERT INTO milestones (id, project_id, title, date, description, status, milestone_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, title, date, description, status, type],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Create audit log
            const auditData = {
                project_id: projectId,
                entity_type: 'milestone',
                entity_id: id,
                action: 'create',
                old_values: null,
                new_values: { title, date, description, status },
                user_name: req.headers['x-user-name'] || 'Admin',
                user_role: req.headers['x-user-role'] || 'admin'
            };
            
            const auditId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const timestamp = new Date().toISOString();
            const ip_address = req.ip || req.connection.remoteAddress;
            const user_agent = req.headers['user-agent'];
            
            db.run(`INSERT INTO audit_logs (id, project_id, entity_type, entity_id, action, old_values, new_values, user_name, user_role, timestamp, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [auditId, auditData.project_id, auditData.entity_type, auditData.entity_id, auditData.action,
                 JSON.stringify(auditData.old_values), JSON.stringify(auditData.new_values),
                 auditData.user_name, auditData.user_role, timestamp, ip_address, user_agent],
                (auditErr) => {
                    if (auditErr) {
                        console.error('Failed to create audit log:', auditErr);
                    }
                }
            );
            
            res.json({ id, message: 'Milestone created successfully' });
        }
    );
});

app.put('/api/milestones/:id', adminOrManager, (req, res) => {
    const { title, date, description, status } = req.body;
    const milestoneId = req.params.id;
    
    // First get the old values
    db.get(`SELECT * FROM milestones WHERE id = ?`, [milestoneId], (err, oldMilestone) => {
        if (err || !oldMilestone) {
            res.status(404).json({ error: 'Milestone not found' });
            return;
        }
        
        db.run(`UPDATE milestones SET title = ?, date = ?, description = ?, status = ?
                WHERE id = ?`,
            [title, date, description, status, milestoneId],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                
                // Create audit log
                const auditData = {
                    project_id: oldMilestone.project_id,
                    entity_type: 'milestone',
                    entity_id: milestoneId,
                    action: 'update',
                    old_values: {
                        title: oldMilestone.title,
                        date: oldMilestone.date,
                        description: oldMilestone.description,
                        status: oldMilestone.status
                    },
                    new_values: { title, date, description, status },
                    user_name: req.headers['x-user-name'] || 'Admin',
                    user_role: req.headers['x-user-role'] || 'admin'
                };
                
                const auditId = Date.now().toString(36) + Math.random().toString(36).substr(2);
                const timestamp = new Date().toISOString();
                const ip_address = req.ip || req.connection.remoteAddress;
                const user_agent = req.headers['user-agent'];
                
                db.run(`INSERT INTO audit_logs (id, project_id, entity_type, entity_id, action, old_values, new_values, user_name, user_role, timestamp, ip_address, user_agent)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [auditId, auditData.project_id, auditData.entity_type, auditData.entity_id, auditData.action,
                     JSON.stringify(auditData.old_values), JSON.stringify(auditData.new_values),
                     auditData.user_name, auditData.user_role, timestamp, ip_address, user_agent],
                    (auditErr) => {
                        if (auditErr) {
                            console.error('Failed to create audit log:', auditErr);
                        }
                    }
                );
                
                res.json({ message: 'Milestone updated successfully' });
            }
        );
    });
});

app.delete('/api/milestones/:id', adminOrManager, (req, res) => {
    const milestoneId = req.params.id;
    
    // First get the milestone details for audit log
    db.get(`SELECT * FROM milestones WHERE id = ?`, [milestoneId], (err, milestone) => {
        if (err || !milestone) {
            res.status(404).json({ error: 'Milestone not found' });
            return;
        }
        
        db.run(`DELETE FROM milestones WHERE id = ?`, [milestoneId], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Create audit log
            const auditData = {
                project_id: milestone.project_id,
                entity_type: 'milestone',
                entity_id: milestoneId,
                action: 'delete',
                old_values: {
                    title: milestone.title,
                    date: milestone.date,
                    description: milestone.description,
                    status: milestone.status
                },
                new_values: null,
                user_name: req.headers['x-user-name'] || 'Admin',
                user_role: req.headers['x-user-role'] || 'admin'
            };
            
            const auditId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            const timestamp = new Date().toISOString();
            const ip_address = req.ip || req.connection.remoteAddress;
            const user_agent = req.headers['user-agent'];
            
            db.run(`INSERT INTO audit_logs (id, project_id, entity_type, entity_id, action, old_values, new_values, user_name, user_role, timestamp, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [auditId, auditData.project_id, auditData.entity_type, auditData.entity_id, auditData.action,
                 JSON.stringify(auditData.old_values), JSON.stringify(auditData.new_values),
                 auditData.user_name, auditData.user_role, timestamp, ip_address, user_agent],
                (auditErr) => {
                    if (auditErr) {
                        console.error('Failed to create audit log:', auditErr);
                    }
                }
            );
            
            res.json({ message: 'Milestone deleted successfully' });
        });
    });
});

// Message endpoints
app.get('/api/messages', (req, res) => {
    const query = `
        SELECT m.*, p.name as project_name 
        FROM messages m 
        JOIN projects p ON m.project_id = p.id 
        ORDER BY m.timestamp DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/projects/:projectId/messages', optionalAuth, (req, res) => {
    const { id, author, role, content, timestamp, is_admin } = req.body;
    const projectId = req.params.projectId;
    
    db.run(`INSERT INTO messages (id, project_id, author, role, content, timestamp, is_admin) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, projectId, author, role, content, timestamp, is_admin ? 1 : 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id, message: 'Message created successfully' });
        }
    );
});

// Audit log endpoints
app.post('/api/audit-logs', (req, res) => {
    const { project_id, entity_type, entity_id, action, old_values, new_values, user_name, user_role } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const timestamp = new Date().toISOString();
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.headers['user-agent'];
    
    db.run(`INSERT INTO audit_logs (id, project_id, entity_type, entity_id, action, old_values, new_values, user_name, user_role, timestamp, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, project_id, entity_type, entity_id, action, 
         JSON.stringify(old_values), JSON.stringify(new_values), 
         user_name, user_role, timestamp, ip_address, user_agent],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id, message: 'Audit log created successfully' });
        }
    );
});

app.get('/api/audit-logs', (req, res) => {
    const { project_id, entity_type, limit = 100 } = req.query;
    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];
    
    if (project_id) {
        query += ` AND project_id = ?`;
        params.push(project_id);
    }
    
    if (entity_type) {
        query += ` AND entity_type = ?`;
        params.push(entity_type);
    }
    
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(parseInt(limit));
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Parse JSON values
        const logs = rows.map(log => ({
            ...log,
            old_values: log.old_values ? JSON.parse(log.old_values) : null,
            new_values: log.new_values ? JSON.parse(log.new_values) : null
        }));
        
        res.json(logs);
    });
});

// Consolidated timeline endpoint
app.get('/api/timeline', (req, res) => {
    const query = `
        SELECT 
            m.id,
            m.title,
            m.date,
            m.description,
            m.status as milestone_status,
            m.project_id,
            p.name as project_name,
            p.priority as project_priority,
            p.status as project_status
        FROM milestones m
        JOIN projects p ON m.project_id = p.id
        ORDER BY 
            CASE p.priority 
                WHEN 'converted' THEN 1 
                WHEN 'pipeline' THEN 2 
                ELSE 3 
            END,
            m.date ASC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
    db.get(`SELECT COUNT(*) as total FROM projects`, (err, totalProjects) => {
        db.get(`SELECT COUNT(*) as active FROM projects WHERE status != 'completed'`, (err, activeProjects) => {
            db.get(`SELECT COUNT(*) as completed FROM projects WHERE status = 'completed'`, (err, completedProjects) => {
                db.get(`SELECT COUNT(*) as total FROM messages`, (err, totalMessages) => {
                    res.json({
                        total_projects: totalProjects.total,
                        active_projects: activeProjects.active,
                        completed_projects: completedProjects.completed,
                        total_messages: totalMessages.total
                    });
                });
            });
        });
    });
});

// Export project to CSV (with optional auth)
app.get('/api/projects/:id/export/csv', optionalAuth, (req, res) => {
    const projectId = req.params.id;
    
    db.get(`SELECT * FROM projects WHERE id = ?`, [projectId], (err, project) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        
        db.all(`SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC`, [projectId], (err, milestones) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            // Generate CSV content
            let csvContent = 'PROJECT DETAILS\n';
            csvContent += 'Field,Value\n';
            csvContent += `Project Name,"${project.name}"\n`;
            csvContent += `Status,${project.status}\n`;
            csvContent += `Start Date,${project.start_date}\n`;
            csvContent += `End Date,${project.end_date || 'Ongoing'}\n`;
            
            // Include budget only for admin users
            const isAdmin = req.user && req.user.role === 'admin';
            if (isAdmin) {
                csvContent += `Budget,₹${project.budget}\n`;
            }
            
            csvContent += `Team Size,${project.team_size}\n`;
            csvContent += `Project Type,${project.project_type}\n`;
            csvContent += `Priority,${project.priority}\n`;
            csvContent += `Urgency,${project.urgency || 'Not set'}\n`;
            csvContent += '\n\nMILESTONES\n';
            csvContent += 'Title,Date,Status,Description\n';
            
            milestones.forEach(milestone => {
                // Escape quotes in description
                const description = milestone.description ? milestone.description.replace(/"/g, '""') : '';
                csvContent += `"${milestone.title}",${milestone.date},${milestone.status},"${description}"\n`;
            });
            
            // Set headers for CSV download
            const filename = `${project.name.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvContent);
        });
    });
});

// Export all projects to CSV (with optional auth)
app.get('/api/projects/export/csv', optionalAuth, (req, res) => {
    db.all(`SELECT * FROM projects ORDER BY urgency ASC NULLS LAST, created_at DESC`, [], (err, projects) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Generate CSV content with headers
        const isAdmin = req.user && req.user.role === 'admin';
        let csvContent = isAdmin 
            ? 'Project Name,Status,Start Date,End Date,Budget,Team Size,Project Type,Priority,Urgency,Milestone Title,Milestone Date,Milestone Status,Milestone Description\n'
            : 'Project Name,Status,Start Date,End Date,Team Size,Project Type,Priority,Urgency,Milestone Title,Milestone Date,Milestone Status,Milestone Description\n';
        
        // Get milestones for all projects
        const projectPromises = projects.map(project => {
            return new Promise((resolve) => {
                db.all(`SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC`, [project.id], (err, milestones) => {
                    if (!milestones || milestones.length === 0) {
                        // Project with no milestones
                        if (isAdmin) {
                            csvContent += `"${project.name}",${project.status},${project.start_date},${project.end_date || 'Ongoing'},₹${project.budget},${project.team_size},${project.project_type},${project.priority},${project.urgency || 'Not set'},,,,\n`;
                        } else {
                            csvContent += `"${project.name}",${project.status},${project.start_date},${project.end_date || 'Ongoing'},${project.team_size},${project.project_type},${project.priority},${project.urgency || 'Not set'},,,,\n`;
                        }
                    } else {
                        // Add a row for each milestone
                        milestones.forEach((milestone, index) => {
                            if (index === 0) {
                                // First milestone - include project details
                                const description = milestone.description ? milestone.description.replace(/"/g, '""').replace(/\n/g, ' ') : '';
                                if (isAdmin) {
                                    csvContent += `"${project.name}",${project.status},${project.start_date},${project.end_date || 'Ongoing'},₹${project.budget},${project.team_size},${project.project_type},${project.priority},${project.urgency || 'Not set'},"${milestone.title}",${milestone.date},${milestone.status},"${description}"\n`;
                                } else {
                                    csvContent += `"${project.name}",${project.status},${project.start_date},${project.end_date || 'Ongoing'},${project.team_size},${project.project_type},${project.priority},${project.urgency || 'Not set'},"${milestone.title}",${milestone.date},${milestone.status},"${description}"\n`;
                                }
                            } else {
                                // Subsequent milestones - only milestone details
                                const description = milestone.description ? milestone.description.replace(/"/g, '""').replace(/\n/g, ' ') : '';
                                if (isAdmin) {
                                    csvContent += `,,,,,,,,,,"${milestone.title}",${milestone.date},${milestone.status},"${description}"\n`;
                                } else {
                                    csvContent += `,,,,,,,,,"${milestone.title}",${milestone.date},${milestone.status},"${description}"\n`;
                                }
                            }
                        });
                    }
                    resolve();
                });
            });
        });
        
        Promise.all(projectPromises).then(() => {
            // Set headers for CSV download
            const filename = `all_projects_with_milestones_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvContent);
        });
    });
});

// Client Management Routes (Admin only)

// Get all client users
app.get('/api/clients', adminOnly, (req, res) => {
    db.all(`SELECT username, email, created_at FROM client_users ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Create a new client user
app.post('/api/clients', adminOnly, async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        
        db.run(
            `INSERT INTO client_users (username, password_hash, email) VALUES (?, ?, ?)`,
            [username, passwordHash, email || null],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        res.status(400).json({ error: 'Username already exists' });
                    } else {
                        res.status(500).json({ error: err.message });
                    }
                    return;
                }
                res.json({ 
                    success: true, 
                    message: 'Client user created successfully',
                    username: username 
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Error creating client user' });
    }
});

// Delete a client user
app.delete('/api/clients/:username', adminOnly, (req, res) => {
    const username = req.params.username;
    
    db.run(`DELETE FROM client_users WHERE username = ?`, [username], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (this.changes === 0) {
            res.status(404).json({ error: 'Client user not found' });
            return;
        }
        
        // Also delete project assignments for this client
        db.run(`DELETE FROM project_assignments WHERE client_username = ?`, [username], (err) => {
            if (err) {
                console.error('Error deleting project assignments:', err);
            }
        });
        
        res.json({ success: true, message: 'Client user deleted successfully' });
    });
});

// Get project assignments for a client
app.get('/api/clients/:username/projects', adminOnly, (req, res) => {
    const username = req.params.username;
    
    db.all(
        `SELECT p.* FROM projects p 
         INNER JOIN project_assignments pa ON p.id = pa.project_id 
         WHERE pa.client_username = ? 
         ORDER BY p.created_at DESC`,
        [username],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

// Assign project to client
app.post('/api/project-assignments', adminOnly, (req, res) => {
    const { project_id, client_username } = req.body;
    
    if (!project_id || !client_username) {
        return res.status(400).json({ error: 'Project ID and client username are required' });
    }
    
    db.run(
        `INSERT INTO project_assignments (project_id, client_username, assigned_by) VALUES (?, ?, ?)`,
        [project_id, client_username, req.user.username],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    res.status(400).json({ error: 'Project already assigned to this client' });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }
            res.json({ 
                success: true, 
                message: 'Project assigned successfully' 
            });
        }
    );
});

// Remove project assignment
app.delete('/api/project-assignments', adminOnly, (req, res) => {
    const { project_id, client_username } = req.body;
    
    if (!project_id || !client_username) {
        return res.status(400).json({ error: 'Project ID and client username are required' });
    }
    
    db.run(
        `DELETE FROM project_assignments WHERE project_id = ? AND client_username = ?`,
        [project_id, client_username],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.status(404).json({ error: 'Assignment not found' });
                return;
            }
            
            res.json({ 
                success: true, 
                message: 'Project assignment removed successfully' 
            });
        }
    );
});

// Get all project assignments (for admin view)
app.get('/api/project-assignments', adminOnly, (req, res) => {
    db.all(
        `SELECT pa.*, p.name as project_name, cu.email as client_email 
         FROM project_assignments pa
         INNER JOIN projects p ON pa.project_id = p.id
         INNER JOIN client_users cu ON pa.client_username = cu.username
         ORDER BY pa.assigned_at DESC`,
        [],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json(rows);
        }
    );
});

// Serve frontend files
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.get('/project', (req, res) => {
    res.sendFile(path.join(__dirname, 'project.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, 'client-dashboard.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});