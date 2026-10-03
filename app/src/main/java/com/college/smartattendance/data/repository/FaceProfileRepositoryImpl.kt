package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.FaceProfile
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class FaceProfileRepositoryImpl : FaceProfileRepository {
    override fun enrollFace(faceProfile: FaceProfile): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(Unit))
    }

    override fun getFaceProfileByUserId(userId: String): Flow<Resource<FaceProfile?>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(null))
    }

    override fun getAllFaceProfiles(): Flow<Resource<List<FaceProfile>>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(emptyList()))
    }
}
