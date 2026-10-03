package com.college.smartattendance.ui.users

import android.os.Bundle
import android.util.Patterns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.college.smartattendance.R
import com.college.smartattendance.data.model.User
import com.college.smartattendance.databinding.FragmentAddUserBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.UserViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class AddUserFragment : Fragment() {

    private var _binding: FragmentAddUserBinding? = null
    private val binding get() = _binding!!

    private val viewModel: UserViewModel by viewModels()

    private var editUserId: String? = null
    private var isEditMode = false
    private var existingUser: User? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAddUserBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        editUserId = arguments?.getString("userId")
        isEditMode = editUserId != null

        if (isEditMode) {
            setupEditMode()
        }

        setupListeners()
        observeViewModel()
    }

    private fun setupEditMode() {
        binding.tvTitle.text = "Edit User Profile"
        binding.tilEmail.isEnabled = false 
        binding.rgAddRole.visibility = View.GONE 
    }

    private fun setupListeners() {
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.rgAddRole.setOnCheckedChangeListener { _, checkedId ->
            if (checkedId == R.id.rb_student) {
                binding.llStudentSection.visibility = View.VISIBLE
                binding.llEmployeeSection.visibility = View.GONE
            } else {
                binding.llStudentSection.visibility = View.GONE
                binding.llEmployeeSection.visibility = View.VISIBLE
            }
        }

        binding.btnSave.setOnClickListener {
            validateAndSave()
        }
    }

    private fun validateAndSave() {
        val name = binding.etName.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val phone = binding.etPhone.text.toString().trim()
        val isStudent = binding.rbStudent.isChecked

        if (name.isEmpty()) {
            binding.tilName.error = "Name is required"
            return
        } else {
            binding.tilName.error = null
        }

        if (email.isEmpty() || !Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tilEmail.error = "Enter a valid email address"
            return
        } else {
            binding.tilEmail.error = null
        }

        if (phone.isEmpty()) {
            binding.tilPhone.error = "Phone number is required"
            return
        } else {
            binding.tilPhone.error = null
        }

        val role = if (isStudent) "STUDENT" else "EMPLOYEE"

        var studentId: String? = null
        var employeeId: String? = null
        var department = ""
        var course: String? = null
        var designation: String? = null
        var year: String? = null
        var batch: String? = null

        if (isStudent) {
            studentId = binding.etStudentId.text.toString().trim()
            department = binding.etStudentDept.text.toString().trim()
            course = binding.etStudentCourse.text.toString().trim()
            year = binding.etStudentYear.text.toString().trim()
            batch = binding.etStudentBatch.text.toString().trim()

            if (studentId.isEmpty()) {
                binding.tilStudentId.error = "Student ID is required"
                return
            } else {
                binding.tilStudentId.error = null
            }
            if (department.isEmpty()) {
                binding.tilStudentDept.error = "Department is required"
                return
            } else {
                binding.tilStudentDept.error = null
            }
        } else {
            employeeId = binding.etEmployeeId.text.toString().trim()
            department = binding.etEmployeeDept.text.toString().trim()
            designation = binding.etEmployeeDesg.text.toString().trim()

            if (employeeId.isEmpty()) {
                binding.tilEmployeeId.error = "Employee ID is required"
                return
            } else {
                binding.tilEmployeeId.error = null
            }
            if (department.isEmpty()) {
                binding.tilEmployeeDept.error = "Department is required"
                return
            } else {
                binding.tilEmployeeDept.error = null
            }
        }

        val idField = if (isStudent) "studentId" else "employeeId"
        val idValue = if (isStudent) studentId!! else employeeId!!

        if (isEditMode) {
            val updatedUser = User(
                userId = editUserId!!,
                name = name,
                email = email,
                phone = phone,
                studentId = studentId,
                employeeId = employeeId,
                department = department,
                course = course,
                designation = designation,
                year = year,
                batch = batch,
                role = role,
                status = existingUser?.status ?: "ACTIVE",
                createdAt = existingUser?.createdAt ?: System.currentTimeMillis()
            )
            viewModel.updateUser(updatedUser)
        } else {
            viewModel.checkIdAvailability(idField, idValue)
            
            val pendingUser = User(
                name = name,
                email = email,
                phone = phone,
                studentId = studentId,
                employeeId = employeeId,
                department = department,
                course = course,
                designation = designation,
                year = year,
                batch = batch,
                role = role
            )
            
            viewLifecycleOwner.lifecycleScope.launch {
                viewModel.duplicateCheckState.collectLatest { resource ->
                    if (resource is Resource.Success) {
                        val isDuplicate = resource.data
                        if (isDuplicate) {
                            Toast.makeText(requireContext(), "Registration failed: This ID is already registered!", Toast.LENGTH_LONG).show()
                            viewModel.clearDuplicateCheckState()
                        } else {
                            viewModel.clearDuplicateCheckState()
                            viewModel.registerUser(pendingUser, requireContext().applicationContext)
                        }
                    }
                }
            }
        }
    }

    private fun observeViewModel() {
        if (isEditMode && editUserId != null) {
            viewModel.loadAllUsers()
            viewLifecycleOwner.lifecycleScope.launch {
                viewModel.usersState.collectLatest { resource ->
                    if (resource is Resource.Success) {
                        val user = resource.data.find { it.userId == editUserId }
                        if (user != null) {
                            existingUser = user
                            prefillFields(user)
                        }
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
                        val message = if (isEditMode) "Profile updated successfully" else "User registered successfully"
                        Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
                        viewModel.clearCrudState()
                        findNavController().popBackStack()
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

    private fun prefillFields(user: User) {
        binding.etName.setText(user.name)
        binding.etEmail.setText(user.email)
        binding.etPhone.setText(user.phone)
        
        if (user.role.uppercase() == "STUDENT") {
            binding.rbStudent.isChecked = true
            binding.llStudentSection.visibility = View.VISIBLE
            binding.llEmployeeSection.visibility = View.GONE

            binding.etStudentId.setText(user.studentId)
            binding.etStudentDept.setText(user.department)
            binding.etStudentCourse.setText(user.course)
            binding.etStudentYear.setText(user.year)
            binding.etStudentBatch.setText(user.batch)
        } else {
            binding.rbEmployee.isChecked = true
            binding.llStudentSection.visibility = View.GONE
            binding.llEmployeeSection.visibility = View.VISIBLE

            binding.etEmployeeId.setText(user.employeeId)
            binding.etEmployeeDept.setText(user.department)
            binding.etEmployeeDesg.setText(user.designation)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
