const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Temporary setup endpoint - REMOVE AFTER FIRST USE
app.get('/setup-database', async (req, res) => {
  try {
    // Create tables and insert sample data
    const setupSQL = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(100) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'dispatcher', 'driver')),
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Jobs table
      CREATE TABLE IF NOT EXISTS jobs (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          address TEXT NOT NULL,
          due_date DATE NOT NULL,
          due_time TIME,
          driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Job notes table
      CREATE TABLE IF NOT EXISTS job_notes (
          id SERIAL PRIMARY KEY,
          job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
          author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          note TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Driver locations table
      CREATE TABLE IF NOT EXISTS driver_locations (
          driver_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          latitude DECIMAL(10, 8) NOT NULL,
          longitude DECIMAL(11, 8) NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON jobs(due_date);
      CREATE INDEX IF NOT EXISTS idx_jobs_driver_id ON jobs(driver_id);
      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_job_notes_job_id ON job_notes(job_id);
      CREATE INDEX IF NOT EXISTS idx_driver_locations_updated_at ON driver_locations(updated_at);

      -- Trigger to update updated_at column
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      -- Insert default admin user (password: admin123)
      INSERT INTO users (username, password, name, role) VALUES 
      ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Admin', 'admin')
      ON CONFLICT (username) DO NOTHING;

      -- Insert sample data for testing
      INSERT INTO users (username, password, name, role) VALUES 
      ('dispatcher1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John Dispatcher', 'dispatcher'),
      ('driver1', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mike Driver', 'driver'),
      ('driver2', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah Driver', 'driver')
      ON CONFLICT (username) DO NOTHING;
    `;
    
    await pool.query(setupSQL);
    res.json({ success: true, message: 'Database setup complete! You can now remove this endpoint.' });
  } catch (error) {
    console.error('Setup error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT id, username, password, role, name, active FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    if (!user.active) {
      return res.status(401).json({ error: 'Account disabled' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User routes
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await pool.query(
      'SELECT id, username, name, role, active, created_at FROM users ORDER BY name'
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, password, name, role } = req.body;
    
    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role, active, created_at',
      [username, hashedPassword, name, role]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, active, password } = req.body;
    
    // Users can only update their own profile (limited fields)
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let query = 'UPDATE users SET ';
    let params = [];
    let paramCount = 0;
    
    if (name) {
      paramCount++;
      query += `name = $${paramCount}, `;
      params.push(name);
    }
    
    if (req.user.role === 'admin') {
      if (role) {
        paramCount++;
        query += `role = $${paramCount}, `;
        params.push(role);
      }
      
      if (typeof active === 'boolean') {
        paramCount++;
        query += `active = $${paramCount}, `;
        params.push(active);
      }
    }
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      paramCount++;
      query += `password = $${paramCount}, `;
      params.push(hashedPassword);
    }
    
    query = query.slice(0, -2); // Remove trailing comma
    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING id, username, name, role, active`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Job routes
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const { status, driver_id, date } = req.query;
    
    let query = `
      SELECT j.*, u.name as driver_name, u.username as driver_username
      FROM jobs j
      LEFT JOIN users u ON j.driver_id = u.id
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND j.status = $${paramCount}`;
      params.push(status);
    }
    
    if (driver_id) {
      paramCount++;
      query += ` AND j.driver_id = $${paramCount}`;
      params.push(driver_id);
    }
    
    if (date) {
      paramCount++;
      query += ` AND DATE(j.due_date) = $${paramCount}`;
      params.push(date);
    }
    
    // Drivers can only see their own jobs
    if (req.user.role === 'driver') {
      paramCount++;
      query += ` AND j.driver_id = $${paramCount}`;
      params.push(req.user.id);
    }
    
    query += ' ORDER BY j.due_date ASC, j.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/jobs', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'driver') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { title, description, address, due_date, due_time, driver_id } = req.body;
    
    if (!title || !address || !due_date) {
      return res.status(400).json({ error: 'Title, address, and due date are required' });
    }
    
    const result = await pool.query(
      `INSERT INTO jobs (title, description, address, due_date, due_time, driver_id, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [title, description, address, due_date, due_time, driver_id, req.user.id]
    );
    
    // Emit real-time update
    io.emit('job_created', result.rows[0]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, address, due_date, due_time, driver_id, status } = req.body;
    
    // Check if user can update this job
    if (req.user.role === 'driver') {
      const jobResult = await pool.query('SELECT driver_id FROM jobs WHERE id = $1', [id]);
      if (jobResult.rows.length === 0 || jobResult.rows[0].driver_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Drivers can only update status
      if (status) {
        const result = await pool.query(
          'UPDATE jobs SET status = $1 WHERE id = $2 RETURNING *',
          [status, id]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Job not found' });
        }
        
        io.emit('job_updated', result.rows[0]);
        return res.json(result.rows[0]);
      }
    }
    
    // Build update query
    let query = 'UPDATE jobs SET ';
    let params = [];
    let paramCount = 0;
    
    if (title) {
      paramCount++;
      query += `title = $${paramCount}, `;
      params.push(title);
    }
    
    if (description !== undefined) {
      paramCount++;
      query += `description = $${paramCount}, `;
      params.push(description);
    }
    
    if (address) {
      paramCount++;
      query += `address = $${paramCount}, `;
      params.push(address);
    }
    
    if (due_date) {
      paramCount++;
      query += `due_date = $${paramCount}, `;
      params.push(due_date);
    }
    
    if (due_time !== undefined) {
      paramCount++;
      query += `due_time = $${paramCount}, `;
      params.push(due_time);
    }
    
    if (driver_id !== undefined) {
      paramCount++;
      query += `driver_id = $${paramCount}, `;
      params.push(driver_id);
    }
    
    if (status) {
      paramCount++;
      query += `status = $${paramCount}, `;
      params.push(status);
    }
    
    query = query.slice(0, -2); // Remove trailing comma
    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING *`;
    params.push(id);
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    io.emit('job_updated', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'driver') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    io.emit('job_deleted', { id: parseInt(id) });
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Notes routes
app.get('/api/jobs/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT n.*, u.name as author_name 
       FROM job_notes n 
       JOIN users u ON n.author_id = u.id 
       WHERE n.job_id = $1 
       ORDER BY n.created_at ASC`,
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/jobs/:id/notes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    
    if (!note) {
      return res.status(400).json({ error: 'Note content required' });
    }
    
    const result = await pool.query(
      `INSERT INTO job_notes (job_id, author_id, note) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [id, req.user.id, note]
    );
    
    const noteWithAuthor = await pool.query(
      `SELECT n.*, u.name as author_name 
       FROM job_notes n 
       JOIN users u ON n.author_id = u.id 
       WHERE n.id = $1`,
      [result.rows[0].id]
    );
    
    io.emit('note_added', noteWithAuthor.rows[0]);
    res.status(201).json(noteWithAuthor.rows[0]);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Location tracking routes
app.post('/api/location', authenticateToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }
    
    await pool.query(
      `INSERT INTO driver_locations (driver_id, latitude, longitude) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (driver_id) 
       DO UPDATE SET latitude = $2, longitude = $3, updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, latitude, longitude]
    );
    
    io.emit('location_update', {
      driver_id: req.user.id,
      latitude,
      longitude,
      timestamp: new Date()
    });
    
    res.json({ message: 'Location updated' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/locations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'driver') {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const result = await pool.query(
      `SELECT dl.*, u.name as driver_name 
       FROM driver_locations dl 
       JOIN users u ON dl.driver_id = u.id 
       WHERE dl.updated_at > NOW() - INTERVAL '1 hour'`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join_room', (room) => {
    socket.join(room);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});