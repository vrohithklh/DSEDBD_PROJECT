package com.college.smartattendance.data.model

data class User(
    val userId: String = "",
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val studentId: String? = null,
    val employeeId: String? = null,
    val department: String = "",
    val course: String? = null,
    val designation: String? = null,
    val year: String? = null,
    val batch: String? = null,
    val role: String = "STUDENT", // "ADMIN", "STUDENT", "EMPLOYEE"
    val profilePhoto: String = "",
    val status: String = "ACTIVE", // "ACTIVE", "INACTIVE"
    val createdAt: Long = System.currentTimeMillis()
)
