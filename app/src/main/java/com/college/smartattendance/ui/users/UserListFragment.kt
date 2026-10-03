package com.college.smartattendance.ui.users

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import com.college.smartattendance.R
import com.college.smartattendance.data.model.User
import com.college.smartattendance.databinding.FragmentUserListBinding
import com.college.smartattendance.utils.Resource
import com.college.smartattendance.viewmodel.UserViewModel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class UserListFragment : Fragment() {

    private var _binding: FragmentUserListBinding? = null
    private val binding get() = _binding!!

    private val viewModel: UserViewModel by viewModels()
    private lateinit var userAdapter: UserAdapter
    
    private var allUsersList: List<User> = emptyList()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentUserListBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupRecyclerView()
        setupListeners()
        observeViewModel()

        viewModel.loadAllUsers()
    }

    private fun setupRecyclerView() {
        userAdapter = UserAdapter(emptyList()) { user ->
            val bundle = Bundle().apply {
                putString("userId", user.userId)
            }
            findNavController().navigate(R.id.action_userListFragment_to_userDetailsFragment, bundle)
        }
        binding.rvUsers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvUsers.adapter = userAdapter
    }

    private fun setupListeners() {
        binding.btnBack.setOnClickListener {
            findNavController().popBackStack()
        }

        binding.fabAddUser.setOnClickListener {
            findNavController().navigate(R.id.action_userListFragment_to_addUserFragment)
        }

        binding.etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                applyFilters()
            }
        })

        binding.cgFilters.setOnCheckedStateChangeListener { _, _ ->
            applyFilters()
        }
    }

    private fun applyFilters() {
        val query = binding.etSearch.text.toString().trim().lowercase()
        val checkedChipId = binding.cgFilters.checkedChipId

        var filteredList = allUsersList

        filteredList = when (checkedChipId) {
            R.id.chip_students -> filteredList.filter { it.role.uppercase() == "STUDENT" }
            R.id.chip_employees -> filteredList.filter { it.role.uppercase() == "EMPLOYEE" }
            R.id.chip_active -> filteredList.filter { it.status.uppercase() == "ACTIVE" }
            R.id.chip_inactive -> filteredList.filter { it.status.uppercase() == "INACTIVE" }
            else -> filteredList
        }

        if (query.isNotEmpty()) {
            filteredList = filteredList.filter { user ->
                user.name.lowercase().contains(query) ||
                        (user.studentId?.lowercase()?.contains(query) ?: false) ||
                        (user.employeeId?.lowercase()?.contains(query) ?: false) ||
                        user.department.lowercase().contains(query)
            }
        }

        userAdapter.updateData(filteredList)

        if (filteredList.isEmpty()) {
            binding.emptyLayout.root.visibility = View.VISIBLE
        } else {
            binding.emptyLayout.root.visibility = View.GONE
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.usersState.collectLatest { resource ->
                when (resource) {
                    is Resource.Loading -> {
                        binding.loadingLayout.root.visibility = View.VISIBLE
                        binding.emptyLayout.root.visibility = View.GONE
                    }
                    is Resource.Success -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        allUsersList = resource.data
                        applyFilters()
                    }
                    is Resource.Error -> {
                        binding.loadingLayout.root.visibility = View.GONE
                        Toast.makeText(requireContext(), resource.message ?: "Failed to load users", Toast.LENGTH_LONG).show()
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
