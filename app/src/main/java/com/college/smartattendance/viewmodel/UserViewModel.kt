package com.college.smartattendance.viewmodel

import androidx.lifecycle.viewModelScope
import com.college.smartattendance.data.model.User
import com.college.smartattendance.data.repository.UserRepository
import com.college.smartattendance.data.repository.UserRepositoryImpl
import com.college.smartattendance.utils.Resource
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UserViewModel(
    private val userRepository: UserRepository = UserRepositoryImpl()
) : BaseViewModel() {

    private val _usersState = MutableStateFlow<Resource<List<User>>>(Resource.Loading)
    val usersState: StateFlow<Resource<List<User>>> = _usersState

    private val _crudState = MutableStateFlow<Resource<Unit>?>(null)
    val crudState: StateFlow<Resource<Unit>?> = _crudState

    private val _duplicateCheckState = MutableStateFlow<Resource<Boolean>?>(null)
    val duplicateCheckState: StateFlow<Resource<Boolean>?> = _duplicateCheckState

    fun loadAllUsers() {
        viewModelScope.launch {
            userRepository.getAllUsers().collectLatest { resource ->
                _usersState.value = resource
            }
        }
    }

    fun registerUser(user: User, context: android.content.Context) {
        viewModelScope.launch {
            userRepository.registerUserWithAuth(user, context).collectLatest { resource ->
                _crudState.value = resource
            }
        }
    }

    fun updateUser(user: User) {
        viewModelScope.launch {
            userRepository.updateUser(user).collectLatest { resource ->
                _crudState.value = resource
            }
        }
    }

    fun deleteUser(userId: String) {
        viewModelScope.launch {
            userRepository.deleteUser(userId).collectLatest { resource ->
                _crudState.value = resource
            }
        }
    }

    fun toggleUserStatus(userId: String, currentStatus: String) {
        viewModelScope.launch {
            userRepository.toggleUserStatus(userId, currentStatus).collectLatest { resource ->
                _crudState.value = resource
            }
        }
    }

    fun checkIdAvailability(idField: String, idValue: String) {
        viewModelScope.launch {
            userRepository.checkDuplicateId(idField, idValue).collectLatest { resource ->
                _duplicateCheckState.value = resource
            }
        }
    }

    fun clearCrudState() {
        _crudState.value = null
    }

    fun clearDuplicateCheckState() {
        _duplicateCheckState.value = null
    }
}
