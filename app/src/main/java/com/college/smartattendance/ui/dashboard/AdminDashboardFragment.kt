package com.college.smartattendance.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.college.smartattendance.R
import com.college.smartattendance.databinding.FragmentAdminDashboardBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class AdminDashboardFragment : Fragment() {

    private var _binding: FragmentAdminDashboardBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAdminDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Check active session and role security on screen enter
        viewModel.checkSession()

        binding.btnToProfile.setOnClickListener {
            findNavController().navigate(R.id.action_adminDashboardFragment_to_profileFragment)
        }

        binding.btnToSettings.setOnClickListener {
            findNavController().navigate(R.id.action_adminDashboardFragment_to_settingsFragment)
        }

        binding.cvStudents.setOnClickListener {
            findNavController().navigate(R.id.action_adminDashboardFragment_to_userListFragment)
        }

        binding.cvEmployees.setOnClickListener {
            findNavController().navigate(R.id.action_adminDashboardFragment_to_userListFragment)
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
                        // Active check in progress
                    }
                    is Resource.Success -> {
                        val user = resource.data
                        if (user == null) {
                            findNavController().navigate(R.id.loginFragment)
                        } else if (!user.role.equals("ADMIN", ignoreCase = true)) {
                            Toast.makeText(requireContext(), "Access Denied: Admin privileges required", Toast.LENGTH_LONG).show()
                            viewModel.logout()
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
