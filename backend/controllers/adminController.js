import { dbService } from '../services/dbService.js';

export const getMetadata = async (req, res) => {
  try {
    const departments = await dbService.getDepartments();
    const classrooms = await dbService.getClassrooms();
    const subjects = await dbService.getSubjects();

    res.json({
      departments,
      classrooms,
      subjects
    });
  } catch (error) {
    console.error('getMetadata error:', error);
    res.status(500).json({ error: 'Failed to retrieve administrative metadata' });
  }
};

export const addDepartment = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required' });
  try {
    const dept = await dbService.createDepartment(name);
    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department' });
  }
};

export const addClassroom = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Classroom name is required' });
  try {
    const room = await dbService.createClassroom(name);
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create classroom' });
  }
};

export const addSubject = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Subject name is required' });
  try {
    const subj = await dbService.createSubject(name);
    res.status(201).json(subj);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create subject' });
  }
};
