package com.college.smartattendance.ui.users

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.college.smartattendance.R
import com.college.smartattendance.data.model.User
import com.college.smartattendance.databinding.ItemUserBinding

class UserAdapter(
    private var users: List<User> = emptyList(),
    private val onItemClick: (User) -> Unit
) : RecyclerView.Adapter<UserAdapter.UserViewHolder>() {

    fun updateData(newUsers: List<User>) {
        users = newUsers
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): UserViewHolder {
        val binding = ItemUserBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return UserViewHolder(binding)
    }

    override fun onBindViewHolder(holder: UserViewHolder, position: Int) {
        holder.bind(users[position])
    }

    override fun getItemCount(): Int = users.size

    inner class UserViewHolder(private val binding: ItemUserBinding) : RecyclerView.ViewHolder(binding.root) {
        
        fun bind(user: User) {
            binding.tvUserName.text = user.name
            
            val subtitle = when (user.role.uppercase()) {
                "STUDENT" -> "Student | Dept: ${user.department} | USN: ${user.studentId ?: ""}"
                "EMPLOYEE" -> "Staff | Dept: ${user.department} | ${user.designation ?: ""}"
                else -> "Admin"
            }
            binding.tvUserSubtitle.text = subtitle
            
            binding.tvRoleBadge.text = user.role.uppercase()
            binding.tvStatusBadge.text = user.status.uppercase()
            
            val initials = user.name.split(" ")
                .filter { it.isNotEmpty() }
                .take(2)
                .map { it[0] }
                .joinToString("")
                .uppercase()
            binding.tvInitials.text = if (initials.isNotEmpty()) initials else "UR"
            
            val context = binding.root.context
            if (user.status.uppercase() == "ACTIVE") {
                binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.success))
            } else {
                binding.tvStatusBadge.setTextColor(ContextCompat.getColor(context, R.color.error))
            }

            binding.root.setOnClickListener {
                onItemClick(user)
            }
        }
    }
}
