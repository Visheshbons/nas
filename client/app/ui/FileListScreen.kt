package com.example.nasclient.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.nasclient.data.FileItem

@Composable
fun FileListScreen(viewModel: NasViewModel = viewModel()) {

    val items by viewModel.items.collectAsState()
    val currentPath by viewModel.currentPath.collectAsState()
    val message by viewModel.message.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("NAS: /${currentPath}") },
                navigationIcon = {
                    if (currentPath.isNotEmpty()) {
                        IconButton(onClick = {
                            // Go up one directory: remove last path segment
                            val parentPath = currentPath.substringBeforeLast("/", "")
                            viewModel.loadDirectory(parentPath)
                        }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = {
                // Placeholder for 'Create Folder' dialog logic
                viewModel.createNewFolder("NewFolder_${System.currentTimeMillis()}")
            }) {
                Icon(Icons.Default.CreateNewFolder, contentDescription = "Create Folder")
            }
        }
    ) { padding ->
        Column(modifier = Modifier.padding(padding)) {

            message?.let {
                Snackbar(modifier = Modifier.padding(8.dp)) { Text(it) }
            }

            if (items.isEmpty()) {
                Text("Directory is empty or failed to load.", Modifier.padding(16.dp))
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(items) { item ->
                        FileListItem(item = item, onClick = {
                            if (item.type == "directory") {
                                // Navigate into the directory
                                viewModel.loadDirectory(item.path)
                            } else {
                                // Handle file download/preview
                                viewModel.message.value = "File selected: ${item.name}"
                            }
                        })
                        Divider()
                    }
                }
            }
        }
    }
}

@Composable
fun FileListItem(item: FileItem, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = if (item.type == "directory") Icons.Default.Folder else Icons.Default.FilePresent,
            contentDescription = item.type,
            modifier = Modifier.size(32.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(item.name, style = MaterialTheme.typography.titleMedium)
            if (item.size != null) {
                Text(item.size, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
            }
        }
        Text(item.modified, style = MaterialTheme.typography.bodySmall)
        IconButton(onClick = { /* Handle menu actions like rename/delete */ }) {
            Icon(Icons.Default.MoreVert, contentDescription = "More actions")
        }
    }
}