package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.FaceProfile
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.Flow

interface FaceProfileRepository {
    fun enrollFace(faceProfile: FaceProfile): Flow<Resource<Unit>>
    fun getFaceProfileByUserId(userId: String): Flow<Resource<FaceProfile?>>
    fun getAllFaceProfiles(): Flow<Resource<List<FaceProfile>>>
}
