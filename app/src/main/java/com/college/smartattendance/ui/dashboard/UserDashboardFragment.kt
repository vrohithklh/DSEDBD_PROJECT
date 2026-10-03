package com.college.smartattendance.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.college.smartattendance.R
import com.college.smartattendance.databinding.FragmentUserDashboardBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UserDashboardFragment : Fragment() {

    private var _binding: FragmentUserDashboardBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Check active session on screen enter
        viewModel.checkSession()

        binding.btnToProfile.setOnClickListener {
            findNavController().navigate(R.id.action_userDashboardFragment_to_profileFragment)
        }

        binding.btnToSettings.setOnClickListener {
            findNavController().navigate(R.id.action_userDashboardFragment_to_settingsFragment)
        }

        binding.btnLogout.setOnClickListener {
            viewModel.logout()
        }

        observeViewModel()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.sessionState.collectLatest { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        // Wait for check
                    }
                    is Resource.Success -> {
                        val user = resource.data
                        if (user == null) {
                            findNavController().navigate(R.id.loginFragment)
                        } else {
                            // Customize layout labels according to role
                            binding.tvDashboardTitle.text = when (user.role.uppercase()) {
                                "STUDENT" -> "Student Dashboard"
                                "EMPLOYEE" -> "Staff Dashboard"
                                else -> "My Attendance"
                            }
                        }
                    }
                    is Resource.Error -> {
                        viewModel.logout()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
