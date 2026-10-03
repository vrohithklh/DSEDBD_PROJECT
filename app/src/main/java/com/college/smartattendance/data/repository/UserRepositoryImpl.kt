package com.college.smartattendance.data.repository

import com.college.smartattendance.data.model.User
import com.college.smartattendance.firebase.FirestoreConstants
import com.college.smartattendance.utils.Resource
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.tasks.await

class UserRepositoryImpl : UserRepository {

    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()
    private val firestore: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    override fun getCurrentUser(): Flow<Resource<User?>> = flow {
        emit(Resource.Loading)
        try {
            val firebaseUser = auth.currentUser
            if (firebaseUser == null) {
                emit(Resource.Success(null))
            } else {
                val document = firestore.collection(FirestoreConstants.COLLECTION_USERS)
                    .document(firebaseUser.uid)
                    .get()
                    .await()
                val user = document.toObject(User::class.java)
                if (user != null) {
                    emit(Resource.Success(user))
                } else {
                    emit(Resource.Error(Exception("User profile not found in database")))
                }
            }
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun getUserById(userId: String): Flow<Resource<User>> = flow {
        emit(Resource.Loading)
        try {
            val document = firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(userId)
                .get()
                .await()
            val user = document.toObject(User::class.java)
            if (user != null) {
                emit(Resource.Success(user))
            } else {
                emit(Resource.Error(Exception("User not found")))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun registerUser(user: User): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(user.userId)
                .set(user)
                .await()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun getAllUsers(): Flow<Resource<List<User>>> = flow {
        emit(Resource.Loading)
        try {
            val snapshot = firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .get()
                .await()
            val users = snapshot.toObjects(User::class.java)
            emit(Resource.Success(users))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun loginUser(email: String, password: String): Flow<Resource<User>> = flow {
        emit(Resource.Loading)
        try {
            val result = auth.signInWithEmailAndPassword(email, password).await()
            val firebaseUser = result.user
            if (firebaseUser != null) {
                val document = firestore.collection(FirestoreConstants.COLLECTION_USERS)
                    .document(firebaseUser.uid)
                    .get()
                    .await()
                val user = document.toObject(User::class.java)
                if (user != null) {
                    emit(Resource.Success(user))
                } else {
                    emit(Resource.Error(Exception("User record does not exist in database")))
                }
            } else {
                emit(Resource.Error(Exception("Firebase authentication failed")))
            }
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun logoutUser(): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            auth.signOut()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun sendPasswordResetEmail(email: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            auth.sendPasswordResetEmail(email).await()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    // CRUD & Validation additions for Phase 3
    override fun registerUserWithAuth(user: User, context: android.content.Context): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        var secondaryApp: FirebaseApp? = null
        try {
            val options = FirebaseApp.getInstance().options
            secondaryApp = try {
                FirebaseApp.initializeApp(context, options, "SecondaryUserApp")
            } catch (e: Exception) {
                FirebaseApp.getInstance("SecondaryUserApp")
            }
            
            val secondaryAuth = FirebaseAuth.getInstance(secondaryApp)
            // Generate a default temporary password
            val result = secondaryAuth.createUserWithEmailAndPassword(user.email, "Welcome123").await()
            val uid = result.user?.uid ?: throw Exception("Auth creation failed")
            
            secondaryAuth.signOut()
            secondaryApp.delete()
            secondaryApp = null

            val userWithUid = user.copy(userId = uid)
            firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(uid)
                .set(userWithUid)
                .await()
                
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            try {
                secondaryApp?.delete()
            } catch (ex: Exception) { /* Ignore clean up error */ }
            emit(Resource.Error(e))
        }
    }

    override fun updateUser(user: User): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(user.userId)
                .set(user)
                .await()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun deleteUser(userId: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(userId)
                .delete()
                .await()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun toggleUserStatus(userId: String, currentStatus: String): Flow<Resource<Unit>> = flow {
        emit(Resource.Loading)
        try {
            val newStatus = if (currentStatus.uppercase() == "ACTIVE") "INACTIVE" else "ACTIVE"
            firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .document(userId)
                .update("status", newStatus)
                .await()
            emit(Resource.Success(Unit))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }

    override fun checkDuplicateId(idField: String, idValue: String): Flow<Resource<Boolean>> = flow {
        emit(Resource.Loading)
        try {
            val snapshot = firestore.collection(FirestoreConstants.COLLECTION_USERS)
                .whereEqualTo(idField, idValue)
                .get()
                .await()
            emit(Resource.Success(!snapshot.isEmpty))
        } catch (e: Exception) {
            emit(Resource.Error(e))
        }
    }
}
