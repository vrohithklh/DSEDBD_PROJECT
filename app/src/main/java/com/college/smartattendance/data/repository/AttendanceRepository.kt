package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.Attendance
import com.college.smartattendance.data.model.AttendanceSession
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.Flow

interface AttendanceRepository {
    fun startSession(session: AttendanceSession): Flow<Resource<Unit>>
    fun stopSession(sessionId: String): Flow<Resource<Unit>>
    fun getActiveSession(): Flow<Resource<AttendanceSession?>>
    fun markAttendance(attendance: Attendance): Flow<Resource<Unit>>
    fun checkDuplicateAttendance(userId: String, sessionId: String): Flow<Resource<Boolean>>
    fun getAttendanceHistoryForUser(userId: String): Flow<Resource<List<Attendance>>>
    fun getAllAttendanceForSession(sessionId: String): Flow<Resource<List<Attendance>>>
}
