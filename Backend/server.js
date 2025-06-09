require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3221;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.chmodSync(uploadsDir, 0o755); // Changed to 0o755 for better security
}

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('dev'));

// CORS configuration
const allowedOrigins = [
  'http://3.88.203.125:7771',
  'http://3.88.203.125:7772',
  'http://3.88.203.125:7773',
  'http://3.88.203.125:3221',
  'http://localhost:7771',
  'http://localhost:7772',
  'http://localhost:7773',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5502',
  'null', // Added temporarily for file:// testing
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`CORS error: Origin ${origin} not allowed`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.PG_HOST || 'postgres',
  database: process.env.DB_NAME || 'new_employee_db',
  password: process.env.DB_PASSWORD || 'admin123',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Test database connection and create table
async function initializeDatabase() {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS employee_details (
        id SERIAL PRIMARY KEY,
        reference_id VARCHAR(255) UNIQUE NOT NULL,
        department VARCHAR(255) NOT NULL,
        job_role VARCHAR(255) NOT NULL,
        branch_location VARCHAR(255) NOT NULL,
        expected_salary INTEGER NOT NULL CHECK (expected_salary >= 100000),
        employment_type VARCHAR(255) NOT NULL,
        interview_date DATE NOT NULL,
        joining_date DATE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        dob DATE NOT NULL,
        mobile_number VARCHAR(10) UNIQUE NOT NULL,
        father_name VARCHAR(255) NOT NULL,
        permanent_address TEXT NOT NULL,
        ssc_year INTEGER NOT NULL CHECK (ssc_year >= 1985),
        ssc_percentage FLOAT NOT NULL CHECK (ssc_percentage >= 0 AND ssc_percentage <= 100),
        ssc_doc_path VARCHAR(255) NOT NULL,
        intermediate_year INTEGER NOT NULL CHECK (intermediate_year >= 1985),
        intermediate_percentage FLOAT NOT NULL CHECK (intermediate_percentage >= 0 AND intermediate_percentage <= 100),
        intermediate_doc_path VARCHAR(255) NOT NULL,
        college_name VARCHAR(255) NOT NULL,
        register_number VARCHAR(255) NOT NULL,
        graduation_year INTEGER NOT NULL CHECK (graduation_year >= 1985),
        graduation_percentage FLOAT NOT NULL CHECK (graduation_percentage >= 0 AND graduation_percentage <= 100),
        graduation_doc_path VARCHAR(255) NOT NULL,
        additional_certifications VARCHAR(255),
        additional_files_path VARCHAR(255),
        experience_status VARCHAR(255) NOT NULL CHECK (experience_status IN ('fresher', 'experienced')),
        years_of_experience INTEGER CHECK (years_of_experience IS NULL OR years_of_experience >= 1 AND years_of_experience <= 40),
        previous_company VARCHAR(255),
        previous_job_role VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
        offer_letter_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_employee_details_reference_id ON employee_details(reference_id);
      CREATE INDEX IF NOT EXISTS idx_employee_details_email ON employee_details(email);
      CREATE INDEX IF NOT EXISTS idx_employee_details_status ON employee_details(status);
    `;

    await pool.query(createTableQuery);
    console.log('employee_details table and indexes created or verified successfully');
  } catch (error) {
    console.error('Error initializing database:', error.stack);
    process.exit(1);
  }
}

initializeDatabase();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// File upload fields
const uploadFields = [
  { name: 'ssc_doc', maxCount: 1 },
  { name: 'intermediate_doc', maxCount: 1 },
  { name: 'graduation_doc', maxCount: 1 },
  { name: 'additional_files', maxCount: 1 },
];

// Input validation function
function validateInput(data) {
  const errors = [];

  if (!data.department) errors.push('Department is required');
  if (!data.job_role) errors.push('Job role is required');
  if (!data.branch_location) errors.push('Branch location is required');
  if (!data.expected_salary || isNaN(data.expected_salary) || data.expected_salary < 100000) {
    errors.push('Expected salary must be at least ₹1,00,000');
  }
  if (!data.employment_type) errors.push('Employment type is required');
  if (!data.interview_date) errors.push('Interview date is required');
  if (!data.joining_date) errors.push('Joining date is required');
  if (!data.full_name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(data.full_name)) {
    errors.push('Invalid full name format');
  }
  if (!data.email || !/^[a-zA-Z0-9]{3,}@(gmail|outlook)\.(com|in|org|co)(\.[a-z]{2})?$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  if (!data.dob) errors.push('Date of birth is required');
  if (!data.mobile_number || !/^[6-9]\d{9}$/.test(data.mobile_number)) {
    errors.push('Invalid mobile number');
  }
  if (!data.father_name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(data.father_name)) {
    errors.push('Invalid father name format');
  }
  if (!data.permanent_address || data.permanent_address.length < 5) {
    errors.push('Permanent address is required and must be at least 5 characters');
  }
  if (!data.ssc_year || isNaN(data.ssc_year) || data.ssc_year < 1985) {
    errors.push('Invalid SSC year');
  }
  if (!data.ssc_percentage || !/^([1-9][0-9]?|100)(\.[0-9]{1,2})?$/.test(data.ssc_percentage)) {
    errors.push('Invalid SSC percentage');
  }
  if (!data.intermediate_year || isNaN(data.intermediate_year) || data.intermediate_year < 1985) {
    errors.push('Invalid Intermediate year');
  }
  if (!data.intermediate_percentage || !/^([1-9][0-9]?|100)(\.[0-9]{1,2})?$/.test(data.intermediate_percentage)) {
    errors.push('Invalid Intermediate percentage');
  }
  if (!data.college_name || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(data.college_name)) {
    errors.push('Invalid college name');
  }
  if (!data.register_number || !/^[A-Za-z0-9]+$/.test(data.register_number)) {
    errors.push('Invalid registration number');
  }
  if (!data.graduation_year || isNaN(data.graduation_year) || data.graduation_year < 1985) {
    errors.push('Invalid graduation year');
  }
  if (!data.graduation_percentage || !/^([1-9][0-9]?|100)(\.[0-9]{1,2})?$/.test(data.graduation_percentage)) {
    errors.push('Invalid graduation percentage');
  }
  if (!data.experience_status) {
    errors.push('Experience status is required');
  } else if (data.experience_status === 'experienced') {
    if (!data.years_of_experience || isNaN(data.years_of_experience) || data.years_of_experience < 1 || data.years_of_experience > 40) {
      errors.push('Years of experience must be between 1 and 40');
    }
    if (!data.previous_company || !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(data.previous_company)) {
      errors.push('Invalid previous company name');
    }
    if (!data.previous_job_role) {
      errors.push('Previous job role is required');
    }
  }

  return errors;
}

// File serving endpoint
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/pdf');
  fs.createReadStream(filePath).pipe(res);
});

// Offer letter retrieval endpoint
app.get('/api/offer-letter', async (req, res) => {
  try {
    const { reference_id, email } = req.query;
    if (!reference_id || !email) {
      return res.status(400).json({ success: false, message: 'Reference ID and Email are required' });
    }

    const result = await pool.query(
      'SELECT offer_letter_path FROM employee_details WHERE reference_id = $1 AND email = $2 AND status = $3',
      [reference_id, email, 'Approved']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found or not approved' });
    }

    const offerLetterPath = result.rows[0].offer_letter_path;
    if (!offerLetterPath) {
      return res.status(404).json({ success: false, message: 'Offer letter not found' });
    }

    res.json({
      success: true,
      data: { offer_letter_path: offerLetterPath }, // Return only the filename
    });
  } catch (error) {
    console.error('Error retrieving offer letter:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Application submission endpoint
app.post('/api/applications', upload.fields(uploadFields), async (req, res) => {
  try {
    const formData = req.body;
    const files = req.files;

    // Prepare data
    const data = {
      department: formData.department,
      job_role: formData.job_role,
      branch_location: formData.branch_location,
      expected_salary: parseInt(formData.expected_salary),
      employment_type: formData.employment_type,
      interview_date: formData.interview_date,
      joining_date: formData.joining_date,
      full_name: formData.full_name,
      email: formData.email,
      dob: formData.dob,
      mobile_number: formData.mobile_number,
      father_name: formData.father_name,
      permanent_address: formData.permanent_address,
      ssc_year: parseInt(formData.ssc_year),
      ssc_percentage: parseFloat(formData.ssc_percentage),
      intermediate_year: parseInt(formData.intermediate_year),
      intermediate_percentage: parseFloat(formData.intermediate_percentage),
      college_name: formData.college_name,
      register_number: formData.register_number,
      graduation_year: parseInt(formData.graduation_year),
      graduation_percentage: parseFloat(formData.graduation_percentage),
      additional_certifications: formData.additional_certifications || null,
      experience_status: formData.experience_status,
      years_of_experience: formData.experience_status === 'experienced' ? parseInt(formData.years_of_experience) : null,
      previous_company: formData.experience_status === 'experienced' ? formData.previous_company : null,
      previous_job_role: formData.experience_status === 'experienced' ? formData.previous_job_role : null,
    };

    // Validate input
    const validationErrors = validateInput(data);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors.join(', ') });
    }

    // Validate file uploads
    if (!files.ssc_doc || !files.intermediate_doc || !files.graduation_doc) {
      return res.status(400).json({ success: false, message: 'Required documents missing' });
    }

    // Store only filenames
    data.ssc_doc_path = files.ssc_doc ? files.ssc_doc[0].filename : null;
    data.intermediate_doc_path = files.intermediate_doc ? files.intermediate_doc[0].filename : null;
    data.graduation_doc_path = files.graduation_doc ? files.graduation_doc[0].filename : null;
    data.additional_files_path = files.additional_files ? files.additional_files[0].filename : null;

    // Check for duplicate email or mobile number
    const duplicateCheck = await pool.query(
      'SELECT email, mobile_number FROM employee_details WHERE email = $1 OR mobile_number = $2',
      [data.email, data.mobile_number]
    );

    if (duplicateCheck.rows.length > 0) {
      const existing = duplicateCheck.rows[0];
      if (existing.email === data.email) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
      }
      if (existing.mobile_number === data.mobile_number) {
        return res.status(400).json({ success: false, message: 'Mobile number already exists' });
      }
    }

    // Generate reference ID
    const referenceId = `REF-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Insert into database
    const query = `
      INSERT INTO employee_details (
        reference_id, department, job_role, branch_location, expected_salary,
        employment_type, interview_date, joining_date, full_name, email,
        dob, mobile_number, father_name, permanent_address, ssc_year,
        ssc_percentage, ssc_doc_path, intermediate_year, intermediate_percentage,
        intermediate_doc_path, college_name, register_number, graduation_year,
        graduation_percentage, graduation_doc_path, additional_certifications,
        additional_files_path, experience_status, years_of_experience,
        previous_company, previous_job_role
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31
      ) RETURNING id
    `;

    const values = [
      referenceId,
      data.department,
      data.job_role,
      data.branch_location,
      data.expected_salary,
      data.employment_type,
      data.interview_date,
      data.joining_date,
      data.full_name,
      data.email,
      data.dob,
      data.mobile_number,
      data.father_name,
      data.permanent_address,
      data.ssc_year,
      data.ssc_percentage,
      data.ssc_doc_path,
      data.intermediate_year,
      data.intermediate_percentage,
      data.intermediate_doc_path,
      data.college_name,
      data.register_number,
      data.graduation_year,
      data.graduation_percentage,
      data.graduation_doc_path,
      data.additional_certifications,
      data.additional_files_path,
      data.experience_status,
      data.years_of_experience,
      data.previous_company,
      data.previous_job_role,
    ];

    const result = await pool.query(query, values);

    res.status(201).json({
      success: true,
      referenceId: referenceId,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    console.error('Error processing application:', {
      message: error.message,
      stack: error.stack,
      body: req.body,
      files: Object.keys(req.files || {}),
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

// Fetch all applications
app.get('/api/applications', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employee_details ORDER BY created_at DESC');
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Fetch single application by ID
app.get('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM employee_details WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Update application status
app.put('/api/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE employee_details SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Status updated successfully',
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Upload offer letter
app.post('/api/applications/:id/offer-letter', upload.single('offerLetter'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const filename = req.file.filename; // Store only the filename
    const result = await pool.query(
      'UPDATE employee_details SET offer_letter_path = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [filename, id]
    );
    if (result.rows.length === 0) {
      fs.unlinkSync(path.join(uploadsDir, filename));
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    res.json({
      success: true,
      message: 'Offer letter uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading offer letter:', error);
    if (req.file && fs.existsSync(path.join(uploadsDir, req.file.filename))) {
      fs.unlinkSync(path.join(UploadsDir, req.file.filename));
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    origin: req.get('origin'),
    body: req.body,
    files: Object.keys(req.files || {}),
  });
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://3.88.203.125:${port}`);
});