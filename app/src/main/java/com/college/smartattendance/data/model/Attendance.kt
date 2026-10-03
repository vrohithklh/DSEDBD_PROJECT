package com.college.smartattendance.data.model

data class Attendance(
    val attendanceId: String = "",
    val userId: String = "",
    val userName: String = "",
    val userType: String = "", // "STUDENT", "EMPLOYEE"
    val date: String = "", // "YYYY-MM-DD"
    val time: String = "", // "HH:MM:SS"
    val status: String = "ABSENT", // "PRESENT", "ABSENT", "LATE"
    val sessionId: String = "",
    val subject: String = "",
    val classroom: String = "",
    val department: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
