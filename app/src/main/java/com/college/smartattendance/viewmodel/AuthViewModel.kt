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

class AuthViewModel(
    private val userRepository: UserRepository = UserRepositoryImpl()
) : BaseViewModel() {

    private val _loginState = MutableStateFlow<Resource<User>?>(null)
    val loginState: StateFlow<Resource<User>?> = _loginState

    private val _resetPasswordState = MutableStateFlow<Resource<Unit>?>(null)
    val resetPasswordState: StateFlow<Resource<Unit>?> = _resetPasswordState

    private val _sessionState = MutableStateFlow<Resource<User?>>(Resource.Loading)
    val sessionState: StateFlow<Resource<User?>> = _sessionState

    fun checkSession() {
        viewModelScope.launch {
            userRepository.getCurrentUser().collectLatest { resource ->
                _sessionState.value = resource
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            userRepository.loginUser(email, password).collectLatest { resource ->
                _loginState.value = resource
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            userRepository.logoutUser().collectLatest { resource ->
                if (resource is Resource.Success) {
                    _sessionState.value = Resource.Success(null)
                    _loginState.value = null
                }
            }
        }
    }

    fun resetPassword(email: String) {
        viewModelScope.launch {
            userRepository.sendPasswordResetEmail(email).collectLatest { resource ->
                _resetPasswordState.value = resource
            }
        }
    }

    fun clearResetPasswordState() {
        _resetPasswordState.value = null
    }

    fun clearLoginState() {
        _loginState.value = null
    }
}
