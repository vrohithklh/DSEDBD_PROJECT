package com.college.smartattendance.ui.settings

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
import com.college.smartattendance.databinding.FragmentSettingsBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.rlLogoutOption.setOnClickListener {
            viewModel.logout()
        }

        binding.switchDarkTheme.setOnCheckedChangeListener { _, isChecked ->
            val mode = if (isChecked) "Enabled" else "Disabled"
            Toast.makeText(requireContext(), "Dark theme: $mode", Toast.LENGTH_SHORT).show()
        }

        binding.switchNotifications.setOnCheckedChangeListener { _, isChecked ->
            val mode = if (isChecked) "Enabled" else "Disabled"
            Toast.makeText(requireContext(), "Notifications: $mode", Toast.LENGTH_SHORT).show()
        }

        observeViewModel()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.sessionState.collectLatest { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        // Active verification
                    }
                    is Resource.Success -> {
                        if (resource.data == null) {
                            findNavController().navigate(R.id.action_settingsFragment_to_loginFragment)
                        }
                    }
                    is Resource.Error -> {
                        findNavController().navigate(R.id.action_settingsFragment_to_loginFragment)
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
