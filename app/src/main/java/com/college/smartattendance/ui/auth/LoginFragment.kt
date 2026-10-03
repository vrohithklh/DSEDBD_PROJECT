package com.college.smartattendance.ui.auth

import android.app.AlertDialog
import android.os.Bundle
import android.util.Patterns
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.college.smartattendance.R
import com.college.smartattendance.databinding.FragmentLoginBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    private val viewModel: AuthViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        binding.btnLogin.setOnClickListener {
            val email = binding.etEmail.text.toString().trim()
            val password = binding.etPassword.text.toString()

            if (email.isEmpty()) {
                binding.tilEmail.error = "Email address is required"
                return@setOnClickListener
            } else if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                binding.tilEmail.error = "Please enter a valid email address"
                return@setOnClickListener
            } else {
                binding.tilEmail.error = null
            }

            if (password.isEmpty()) {
                binding.tilPassword.error = "Password is required"
                return@setOnClickListener
            } else {
                binding.tilPassword.error = null
            }

            viewModel.login(email, password)
        }

        binding.tvForgotPassword.setOnClickListener {
            showForgotPasswordDialog()
        }

        observeViewModel()
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.loginState.collectLatest { resource ->
                if (resource == null) return@collectLatest
                when (resource) {
                    is Resource.Loading -> {
                        binding.loadingLayout.root.visibility = View.VISIBLE
                    }
                    is Resource.Success -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        val user = resource.data
                        Toast.makeText(requireContext(), "Welcome ${user.name}!", Toast.LENGTH_SHORT).show()
                        
                        when (user.role.uppercase()) {
                            "ADMIN" -> {
                                findNavController().navigate(R.id.action_loginFragment_to_adminDashboardFragment)
                            }
                            "STUDENT", "EMPLOYEE" -> {
                                findNavController().navigate(R.id.action_loginFragment_to_userDashboardFragment)
                            }
                            else -> {
                                Toast.makeText(requireContext(), "Unknown user role: ${user.role}", Toast.LENGTH_LONG).show()
                            }
                        }
                        viewModel.clearLoginState()
                    }
                    is Resource.Error -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        val msg = resource.message ?: "Authentication failed"
                        Toast.makeText(requireContext(), msg, Toast.LENGTH_LONG).show()
                        viewModel.clearLoginState()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.resetPasswordState.collectLatest { resource ->
                if (resource == null) return@collectLatest
                when (resource) {
                    is Resource.Loading -> {
                        binding.loadingLayout.root.visibility = View.VISIBLE
                    }
                    is Resource.Success -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), "Password reset instructions sent to your email", Toast.LENGTH_LONG).show()
                        viewModel.clearResetPasswordState()
                    }
                    is Resource.Error -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), resource.message ?: "Error sending reset email", Toast.LENGTH_LONG).show()
                        viewModel.clearResetPasswordState()
                    }
                }
            }
        }
    }

    private fun showForgotPasswordDialog() {
        val context = requireContext()
        val builder = AlertDialog.Builder(context)
        builder.setTitle("Reset Password")
        builder.setMessage("Enter the registered email address to receive password reset instructions.")

        val input = EditText(context)
        input.hint = "Email address"
        input.inputType = android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        
        val container = FrameLayout(context)
        val density = context.resources.displayMetrics.density
        val padding = (16 * density).toInt()
        container.setPadding(padding, padding / 2, padding, 0)
        container.addView(input)
        builder.setView(container)

        builder.setPositiveButton("Reset") { dialog, _ ->
            val email = input.text.toString().trim()
            if (email.isEmpty() || !Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                Toast.makeText(context, "Invalid email address", Toast.LENGTH_SHORT).show()
            } else {
                viewModel.resetPassword(email)
            }
            dialog.dismiss()
        }
        builder.setNegativeButton("Cancel") { dialog, _ ->
            dialog.cancel()
        }
        builder.show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
