import { dbService } from '../services/dbService.js';

// Simple Euclidean Distance helper to compare float feature arrays
const calculateEuclideanDistance = (arr1, arr2) => {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    const diff = Number(arr1[i]) - Number(arr2[i]);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

export const getProfile = async (req, res) => {
  const userId = req.query.userId || req.user.uid;
  try {
    const profile = await dbService.getFaceProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Face profile not found for this user' });
    }
    // Secure response: do not expose biometric vectors/templates
    const { faceFeatures, ...safeProfile } = profile;
    res.json(safeProfile);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Failed to retrieve face profile' });
  }
};

export const enrollFace = async (req, res) => {
  const { userId, faceFeatures } = req.body;

  if (!userId || !faceFeatures || !Array.isArray(faceFeatures) || faceFeatures.length === 0) {
    return res.status(400).json({ error: 'userId and valid faceFeatures array are required' });
  }

  try {
    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User does not exist' });
    }

    // Check for duplicate face registrations across other users
    const duplicateThreshold = parseFloat(process.env.DUPLICATE_FACE_THRESHOLD) || 0.40;
    const allProfiles = await dbService.getAllFaceProfiles();
    
    if (allProfiles && allProfiles.length > 0) {
      for (const p of allProfiles) {
        // Skip comparing against the current user's profile to allow intentional re-enrollment
        if (p.userId === userId) continue;
        
        const dist = calculateEuclideanDistance(p.faceFeatures, faceFeatures);
        if (dist < duplicateThreshold) {
          console.warn(`[enrollFace] Duplicate face detected! Matches user ${p.userId} with distance: ${dist.toFixed(4)}`);
          return res.status(400).json({ 
            error: 'Face already registered. This face is already linked to another account.' 
          });
        }
      }
    }

    const profile = await dbService.createOrUpdateFaceProfile({
      userId,
      faceFeatures
    });

    console.log(`[enrollFace] Successfully enrolled face template (${faceFeatures.length} dims) for user: ${user.name} (${userId})`);

    // Secure response: do not expose biometric vectors/templates
    const { faceFeatures: _, ...safeProfile } = profile;

    res.status(200).json({
      message: 'Face profile enrolled successfully',
      profile: safeProfile
    });
  } catch (error) {
    console.error('enrollFace error:', error);
    res.status(500).json({ error: 'Failed to enroll face' });
  }
};

export const verifyFace = async (req, res) => {
  const { userId, faceFeatures } = req.body;

  if (!userId || !faceFeatures || !Array.isArray(faceFeatures) || faceFeatures.length === 0) {
    return res.status(400).json({ error: 'userId and faceFeatures array are required' });
  }

  try {
    const profile = await dbService.getFaceProfileByUserId(userId);
    if (!profile) {
      return res.status(404).json({ error: 'No enrolled face profile found for this user' });
    }

    const distance = calculateEuclideanDistance(profile.faceFeatures, faceFeatures);
    const threshold = 0.50;
    const match = distance < threshold;

    console.log(`[verifyFace] User: ${userId}, Distance: ${distance.toFixed(4)}, Threshold: ${threshold}, Match: ${match}`);

    res.json({
      match,
      distance,
      threshold,
      message: match ? 'Face verified successfully' : 'Face match failed'
    });
  } catch (error) {
    console.error('verifyFace error:', error);
    res.status(500).json({ error: 'Face verification failed' });
  }
};

export const deleteProfile = async (req, res) => {
  const userId = req.query.userId || req.body.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    await dbService.deleteFaceProfile(userId);
    console.log(`[deleteProfile] Deleted face profile for user: ${userId}`);
    res.status(200).json({ message: 'Face profile deleted successfully' });
  } catch (error) {
    console.error('deleteProfile error:', error);
    res.status(500).json({ error: 'Failed to delete face profile' });
  }
};

export const recognizeFace = async (req, res) => {
  const { faceFeatures, threshold = 0.50 } = req.body;

  if (!faceFeatures || !Array.isArray(faceFeatures) || faceFeatures.length === 0) {
    return res.status(400).json({ error: 'Valid faceFeatures array is required' });
  }

  try {
    const profiles = await dbService.getAllFaceProfiles();
    const totalProfiles = profiles?.length || 0;

    if (!profiles || totalProfiles === 0) {
      console.log(`[recognizeFace] No face templates registered in system.`);
      return res.json({ match: false, message: 'No enrolled templates in database' });
    }

    let bestMatch = null;
    let minDistance = Infinity;

    for (const profile of profiles) {
      if (!profile.faceFeatures || !Array.isArray(profile.faceFeatures)) continue;
      
      const distance = calculateEuclideanDistance(profile.faceFeatures, faceFeatures);
      if (distance < threshold && distance < minDistance) {
        minDistance = distance;
        bestMatch = profile;
      }
    }

    console.log(`[recognizeFace] Evaluated against ${totalProfiles} templates. Min distance: ${minDistance === Infinity ? 'Infinity' : minDistance.toFixed(4)}, Threshold: ${threshold}`);

    if (bestMatch) {
      const user = await dbService.getUserById(bestMatch.userId);
      if (user) {
        console.log(`[recognizeFace] MATCH: ${user.name} (${user.userId}, ${user.role}) with distance ${minDistance.toFixed(4)}`);
        return res.json({
          match: true,
          userId: user.userId,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          employeeId: user.employeeId,
          department: user.department,
          distance: minDistance,
          threshold
        });
      }
    }

    res.json({
      match: false,
      distance: minDistance === Infinity ? null : minDistance,
      threshold,
      message: 'Unknown face'
    });
  } catch (error) {
    console.error('recognizeFace error:', error);
    res.status(500).json({ error: 'Face recognition processing failed' });
  }
};


