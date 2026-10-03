package com.college.smartattendance.ui.users

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.college.smartattendance.R
import com.college.smartattendance.data.model.User
import com.college.smartattendance.databinding.FragmentUserDetailsBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.UserViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UserDetailsFragment : Fragment() {

    private var _binding: FragmentUserDetailsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: UserViewModel by viewModels()
    private var userId: String = ""
    private var currentUser: User? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserDetailsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        userId = arguments?.getString("userId") ?: ""
        if (userId.isEmpty()) {
            Toast.makeText(requireContext(), "User ID not found", Toast.LENGTH_SHORT).show()
            findNavController().popBackStack()
            return
        }

        setupListeners()
        observeViewModel()

        viewModel.loadAllUsers()
    }

    private fun setupListeners() {
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.btnEdit.setOnClickListener {
            val bundle = Bundle().apply {
                putString("userId", userId)
            }
            findNavController().navigate(R.id.action_userDetailsFragment_to_addUserFragment, bundle)
        }

        binding.btnDisable.setOnClickListener {
            currentUser?.let { user ->
                viewModel.toggleUserStatus(user.userId, user.status)
            }
        }

        binding.btnDelete.setOnClickListener {
            showDeleteConfirmationDialog()
        }
    }

    private fun showDeleteConfirmationDialog() {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete User Profile")
            .setMessage("Are you sure you want to delete this user? This action is permanent and cannot be undone.")
            .setPositiveButton("Delete") { dialog, _ ->
                viewModel.deleteUser(userId)
                dialog.dismiss()
            }
            .setNegativeButton("Cancel") { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.usersState.collectLatest { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        binding.loadingLayout.root.visibility = View.VISIBLE
                    }
                    is Resource.Success -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        val user = resource.data.find { it.userId == userId }
                        if (user != null) {
                            currentUser = user
                            populateDetails(user)
                        } else {
                            findNavController().popBackStack()
                        }
                    }
                    is Resource.Error -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), resource.message ?: "Failed to load user details", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.crudState.collectLatest { resource ->
                if (resource == null) return@collectLatest
                when (resource) {
                    is Resource.Loading -> {
                        binding.loadingLayout.root.visibility = View.VISIBLE
                    }
                    is Resource.Success -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), "Action completed successfully", Toast.LENGTH_SHORT).show()
                        viewModel.clearCrudState()
                        viewModel.loadAllUsers()
                    }
                    is Resource.Error -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), resource.message ?: "Action failed", Toast.LENGTH_LONG).show()
                        viewModel.clearCrudState()
                    }
                }
            }
        }
    }

    private fun populateDetails(user: User) {
        val context = requireContext()
        binding.tvDetailName.text = user.name
        binding.tvDetailRole.text = user.role.uppercase()
        binding.tvDetailEmail.text = user.email
        binding.tvDetailPhone.text = user.phone
        binding.tvDetailDept.text = user.department
        
        binding.tvDetailStatus.text = user.status.uppercase()
        if (user.status.uppercase() == "ACTIVE") {
            binding.tvDetailStatus.setTextColor(ContextCompat.getColor(context, R.color.success))
            binding.btnDisable.text = "Disable"
        } else {
            binding.tvDetailStatus.setTextColor(ContextCompat.getColor(context, R.color.error))
            binding.btnDisable.text = "Enable"
        }

        if (user.role.uppercase() == "STUDENT") {
            binding.llStudentDetails.visibility = View.VISIBLE
            binding.llEmployeeDetails.visibility = View.GONE
            
            binding.tvDetailIdLabel.text = "Student ID (USN)"
            binding.tvDetailId.text = user.studentId ?: ""
            binding.tvDetailCourse.text = user.course ?: ""
            binding.tvDetailYearBatch.text = "${user.year ?: ""} Year (Batch ${user.batch ?: ""})"
        } else {
            binding.llStudentDetails.visibility = View.GONE
            binding.llEmployeeDetails.visibility = View.VISIBLE
            
            binding.tvDetailIdLabel.text = "Employee ID"
            binding.tvDetailId.text = user.employeeId ?: ""
            binding.tvDetailDesignation.text = user.designation ?: ""
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
