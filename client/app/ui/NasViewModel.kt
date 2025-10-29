package com.example.nasclient.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.nasclient.data.FileItem
import com.example.nasclient.data.NasRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class NasViewModel(
    private val repository: NasRepository = NasRepository()
) : ViewModel() {

    // StateFlow to hold the list of files/folders
    private val _items = MutableStateFlow<List<FileItem>>(emptyList())
    val items: StateFlow<List<FileItem>> = _items

    // StateFlow to track current directory path
    private val _currentPath = MutableStateFlow("")
    val currentPath: StateFlow<String> = _currentPath

    // StateFlow for user feedback (e.g., success/error messages)
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    init {
        loadDirectory("") // Load root directory on startup
    }

    fun loadDirectory(path: String) {
        viewModelScope.launch {
            val result = repository.listDirectoryContents(path)

            result.onSuccess { newItems ->
                _items.value = newItems
                _currentPath.value = path
                _message.value = "Directory loaded: /${path}"
            }.onFailure { error ->
                _message.value = "Error loading directory: ${error.message}"
            }
        }
    }

    fun createNewFolder(folderName: String) {
        viewModelScope.launch {
            repository.createFolder(folderName, _currentPath.value)
                .onSuccess {
                    _message.value = "Folder '$folderName' created."
                    loadDirectory(_currentPath.value) // Refresh list
                }
                .onFailure { error ->
                    _message.value = "Failed to create folder: ${error.message}"
                }
        }
    }

    fun deleteItem(path: String) {
        viewModelScope.launch {
            repository.deleteItem(path)
                .onSuccess {
                    _message.value = "Item deleted successfully."
                    loadDirectory(_currentPath.value) // Refresh list
                }
                .onFailure { error ->
                    _message.value = "Failed to delete item: ${error.message}"
                }
        }
    }
}