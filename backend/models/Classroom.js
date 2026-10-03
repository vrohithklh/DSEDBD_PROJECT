import mongoose from 'mongoose';

const classroomSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true
  }
});

const Classroom = mongoose.model('Classroom', classroomSchema);

export default Classroom;
