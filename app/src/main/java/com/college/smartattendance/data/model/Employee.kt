package com.college.smartattendance.data.model

data class Employee(
    val employeeId: String = "",
    val userId: String = "",
    val departmentId: String = "",
    val designation: String = "",
    val joiningDate: Long = System.currentTimeMillis()
)
