package com.college.smartattendance.data.model

data class FaceProfile(
    val faceProfileId: String = "",
    val userId: String = "",
    val faceFeatures: List<Float> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
