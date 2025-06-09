-- Drop the employee_details table if it exists
DROP TABLE IF EXISTS employee_details;

-- Create employee_details table
CREATE TABLE employee_details (
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

-- Create indexes for faster queries
CREATE INDEX idx_employee_details_reference_id ON employee_details(reference_id);
CREATE INDEX idx_employee_details_email ON employee_details(email);
CREATE INDEX idx_employee_details_status ON employee_details(status);

-- Insert sample data for testing (optional)
INSERT INTO employee_details (
    reference_id, department, job_role, branch_location, expected_salary,
    employment_type, interview_date, joining_date, full_name, email,
    dob, mobile_number, father_name, permanent_address, ssc_year,
    ssc_percentage, ssc_doc_path, intermediate_year, intermediate_percentage,
    intermediate_doc_path, college_name, register_number, graduation_year,
    graduation_percentage, graduation_doc_path, additional_certifications,
    additional_files_path, experience_status, years_of_experience,
    previous_company, previous_job_role, status, offer_letter_path
) VALUES (
    'REF-TEST1234', 'Engineering', 'Software Engineer', 'Bangalore', 500000,
    'Full-time', '2025-06-01', '2025-06-15', 'John Doe', 'john.doe@gmail.com',
    '1995-01-01', '9876543210', 'James Doe', '123 Main St, Bangalore', 2010,
    85.5, 'ssc_doc-TEST1234.pdf', 2012, 88.0, 'intermediate_doc-TEST1234.pdf',
    'XYZ University', 'REG12345', 2016, 90.0, 'graduation_doc-TEST1234.pdf',
    'AWS Certified Developer', 'additional_doc-TEST1234.pdf', 'experienced', 3,
    'ABC Corp', 'Junior Developer', 'Approved', 'offer-TEST1234.pdf'
);
