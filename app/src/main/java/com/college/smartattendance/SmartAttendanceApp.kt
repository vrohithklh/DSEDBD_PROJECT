package com.college.smartattendance

import android.app.Application

class SmartAttendanceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Firebase initialization is automatically handled by the ContentProvider.
        // We can place app-wide setups here.
    }
}
