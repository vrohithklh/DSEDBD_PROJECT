package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.Attendance
import com.college.smartattendance.data.model.AttendanceSession
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class AttendanceRepositoryImpl : AttendanceRepository {
    override fun startSession(session: AttendanceSession): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(Unit))
    }

    override fun stopSession(sessionId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(Unit))
    }

    override fun getActiveSession(): Flow<Resource<AttendanceSession?>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(null))
    }

    override fun markAttendance(attendance: Attendance): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(Unit))
    }

    override fun checkDuplicateAttendance(userId: String, sessionId: String): Flow<Resource<Boolean>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(false))
    }

    override fun getAttendanceHistoryForUser(userId: String): Flow<Resource<List<Attendance>>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(emptyList()))
    }

    override fun getAllAttendanceForSession(sessionId: String): Flow<Resource<List<Attendance>>> = flow {
        emit(Resource.Loading)
        emit(Resource.Success(emptyList()))
    }
}
