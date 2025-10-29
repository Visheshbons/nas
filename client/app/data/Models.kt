package com.example.nasclient.data

import kotlinx.serialization.Serializable

/** Data structure for a single file or directory item returned by the server. */
@Serializable
data class FileItem(
    val name: String,
    val type: String, // "directory" or "file"
    val size: String? = null,
    val modified: String,
    val path: String // Relative path from the storage root
)