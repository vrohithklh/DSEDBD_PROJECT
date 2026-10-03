package com.college.smartattendance.ui

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
import com.college.smartattendance.databinding.FragmentSplashBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class SplashFragment : Fragment() {

    private var _binding: FragmentSplashBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSplashBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        // Start session check
        viewModel.checkSession()
        
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.sessionState.collectLatest { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        // Wait for session status check to complete
                    }
                    is Resource.Success -> {
                        val user = resource.data
                        if (user != null) {
                            // Route based on retrieved user role
                            when (user.role.uppercase()) {
                                "ADMIN" -> {
                                    findNavController().navigate(R.id.action_splashFragment_to_adminDashboardFragment)
                                }
                                "STUDENT", "EMPLOYEE" -> {
                                    findNavController().navigate(R.id.action_splashFragment_to_userDashboardFragment)
                                }
                                else -> {
                                    findNavController().navigate(R.id.action_splashFragment_to_loginFragment)
                                }
                            }
                        } else {
                            findNavController().navigate(R.id.action_splashFragment_to_loginFragment)
                        }
                    }
                    is Resource.Error -> {
                        findNavController().navigate(R.id.action_splashFragment_to_loginFragment)
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
