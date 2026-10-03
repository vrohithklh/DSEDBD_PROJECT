import { dbService } from '../services/dbService.js';

export const getSummaryStats = async (req, res) => {
  try {
    const users = await dbService.getAllUsers();
    const activeUsers = users.filter(u => u.role !== 'ADMIN' && u.status === 'ACTIVE');
    const studentCount = users.filter(u => u.role === 'STUDENT').length;
    const employeeCount = users.filter(u => u.role === 'EMPLOYEE').length;
    
    const activeSessions = await dbService.getActiveSessions();
    const allRecords = await dbService.getAttendanceRecords();

    const todayStr = new Date().toISOString().split('T')[0];
    const todayRecords = allRecords.filter(r => r.date === todayStr);

    const presentToday = todayRecords.filter(r => r.status === 'PRESENT').length;
    const lateToday = todayRecords.filter(r => r.status === 'LATE').length;
    const absentToday = todayRecords.filter(r => r.status === 'ABSENT').length;

    // 1. Daily Trend (last 7 days)
    const dailyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayRecords = allRecords.filter(r => r.date === dateStr);
      const present = dayRecords.filter(r => r.status === 'PRESENT').length;
      const late = dayRecords.filter(r => r.status === 'LATE').length;
      const absent = dayRecords.filter(r => r.status === 'ABSENT').length;

      dailyTrend.push({
        date: dateStr,
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' }),
        present,
        late,
        absent
      });
    }

    // 2. Weekly Trend (last 4 weeks)
    const weeklyTrend = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - (i * 7 + 6));
      start.setHours(0, 0, 0, 0);
      
      const end = new Date();
      end.setDate(end.getDate() - (i * 7));
      end.setHours(23, 59, 59, 999);

      const weekRecords = allRecords.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= start && rDate <= end;
      });

      const present = weekRecords.filter(r => r.status === 'PRESENT').length;
      const late = weekRecords.filter(r => r.status === 'LATE').length;
      
      weeklyTrend.push({
        label: `Week -${i}`,
        present,
        late
      });
    }

    // 3. Monthly Trend (last 6 months)
    const monthlyTrend = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthIdx = d.getMonth();
      const year = d.getFullYear();

      const monthRecords = allRecords.filter(r => {
        const rDate = new Date(r.date);
        return rDate.getMonth() === monthIdx && rDate.getFullYear() === year;
      });

      const present = monthRecords.filter(r => r.status === 'PRESENT').length;
      const late = monthRecords.filter(r => r.status === 'LATE').length;

      monthlyTrend.push({
        label: `${months[monthIdx]} ${year}`,
        present,
        late
      });
    }

    // 4. Department Attendance Stats
    const departments = [...new Set(activeUsers.map(u => u.department || 'General'))];
    const departmentStats = departments.map(dept => {
      const deptUsers = activeUsers.filter(u => u.department === dept);
      const deptRecords = todayRecords.filter(r => r.department === dept);
      
      const present = deptRecords.filter(r => r.status === 'PRESENT').length;
      const late = deptRecords.filter(r => r.status === 'LATE').length;
      const absent = deptRecords.filter(r => r.status === 'ABSENT').length;

      return {
        department: dept,
        total: deptUsers.length,
        present,
        late,
        absent
      };
    });

    // 5. Recent Attendance Logs (latest 8)
    const recentLogs = [...allRecords]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);

    res.json({
      totalStudents: studentCount,
      totalEmployees: employeeCount,
      todayPresent: presentToday,
      todayAbsent: absentToday,
      todayLate: lateToday,
      activeSessionsCount: activeSessions.length,
      dailyTrend,
      weeklyTrend,
      monthlyTrend,
      departmentStats,
      recentLogs
    });
  } catch (error) {
    console.error('getSummaryStats error:', error);
    res.status(500).json({ error: 'Failed to retrieve reports statistics' });
  }
};

export const getDetailedReport = async (req, res) => {
  try {
    const records = await dbService.getAttendanceRecords();
    res.json({
      generatedAt: Date.now(),
      records
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate detailed report' });
  }
};
