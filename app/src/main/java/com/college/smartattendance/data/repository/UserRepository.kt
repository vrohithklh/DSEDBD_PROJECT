package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.User
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.Flow

interface UserRepository {
    fun getCurrentUser(): Flow<Resource<User?>>
    fun getUserById(userId: String): Flow<Resource<User>>
    fun registerUser(user: User): Flow<Resource<Unit>>
    fun getAllUsers(): Flow<Resource<List<User>>>
    fun loginUser(email: String, password: String): Flow<Resource<User>>
    fun logoutUser(): Flow<Resource<Unit>>
    fun sendPasswordResetEmail(email: String): Flow<Resource<Unit>>
    
    // CRUD & Validation additions for Phase 3
    fun registerUserWithAuth(user: User, context: android.content.Context): Flow<Resource<Unit>>
    fun updateUser(user: User): Flow<Resource<Unit>>
    fun deleteUser(userId: String): Flow<Resource<Unit>>
    fun toggleUserStatus(userId: String, currentStatus: String): Flow<Resource<Unit>>
    fun checkDuplicateId(idField: String, idValue: String): Flow<Resource<Boolean>>
}
