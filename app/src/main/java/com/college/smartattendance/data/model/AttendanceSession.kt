package com.college.smartattendance.data.model

data class AttendanceSession(
    val sessionId: String = "",
    val status: String = "ACTIVE", // "ACTIVE", "COMPLETED"
    val subject: String = "",
    val classroom: String = "",
    val department: String = "",
    val date: String = "", // "YYYY-MM-DD"
    val startTime: Long = System.currentTimeMillis(),
    val endTime: Long? = null,
    val createdBy: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
