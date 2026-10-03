import mongoose from 'mongoose';

const faceProfileSchema = new mongoose.Schema({
  faceProfileId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: String,
    required: true,
    unique: true
  },
  faceFeatures: {
    type: [Number],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const FaceProfile = mongoose.model('FaceProfile', faceProfileSchema);

export default FaceProfile;
