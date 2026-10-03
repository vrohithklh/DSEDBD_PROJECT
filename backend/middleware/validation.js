export const validateUser = (req, res, next) => {
  const { name, email, role, department, status, password } = req.body;

  // 1. Enforce generic required fields
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || email.trim() === '') {
    return res.status(400).json({ error: 'Email address is required.' });
  }
  if (!password || password.trim() === '') {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }
  if (!role) {
    return res.status(400).json({ error: 'User role must be specified.' });
  }
  if (!department || department.trim() === '') {
    return res.status(400).json({ error: 'Department is required.' });
  }

  // 2. Validate email structure
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // 3. Enforce role-specific fields
  if (role === 'STUDENT') {
    const { studentId } = req.body;
    if (!studentId || studentId.trim() === '') {
      return res.status(400).json({ error: 'Student ID is required for student accounts.' });
    }
  } else if (role === 'EMPLOYEE') {
    const { employeeId } = req.body;
    if (!employeeId || employeeId.trim() === '') {
      return res.status(400).json({ error: 'Employee ID is required for employee accounts.' });
    }
  } else if (role !== 'ADMIN') {
    return res.status(400).json({ error: 'Invalid account role configuration.' });
  }

  // 4. Validate status values if provided
  if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value. Must be ACTIVE or INACTIVE.' });
  }

  next();
};
