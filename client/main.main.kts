#!/usr/bin/env kotlin

// Dependencies:
// io.ktor:ktor-client-core
// io.ktor:ktor-client-cio (or other engine)
// io.ktor:ktor-client-content-negotiation
// io.ktor:ktor-serialization-kotlinx-json
// org.jetbrains.kotlinx:kotlinx-serialization-json

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// --- Configuration ---
const val SERVER_BASE_URL = "http://localhost:3000"

// --- Data Structures (Mirroring Server's getItemInfo and API Bodies) ---

/** Data structure for a single file or directory item returned by the server's root (/) route. */
@Serializable
data class FileItem(
    val name: String,
    val type: String, // "directory" or "file"
    val size: String? = null,
    val modified: String,
    val path: String // Relative path from the storage root
)

// --- Ktor Client Setup ---
val client = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(Json {
            isLenient = true
            ignoreUnknownKeys = true
        })
    }
}

// --- API Functions for GUI Operations ---

/**
 * Fetches the contents of a directory using the server's root (/) GET endpoint.
 * @param path The relative path to the directory to list (e.g., "", "images/photos").
 * @return A list of [FileItem]s or null on failure.
 */
suspend fun listDirectoryContents(path: String = ""): List<FileItem>? {
    println(">>> Listing directory: /$path")
    return try {
        val response = client.get("$SERVER_BASE_URL/") {
            url {
                parameters.append("path", path) // Uses the query parameter
            }
        }

        // NOTE: The server's root route responds with an EJS template, not raw JSON data.
        // For a proper GUI-focused API, the server should have a dedicated JSON route (e.g., /api/list).
        // Since it doesn't, we will assume this function simulates success for demonstration.
        // The actual mobile app would need the server to return structured JSON.

        // If we assume a hypothetical /api/list route that *does* return JSON:
        // return response.body<List<FileItem>>()

        // Simulation based on the terminal commands:
        if (path.contains("error")) return null // Simulated failure

        // This is a crude placeholder, as the actual API only returns a rendered HTML page.
        // A real NAS client needs a server update for a dedicated JSON /list endpoint.
        println("Warning: Server's / route returns HTML. Simulating list data.")
        listOf(
            FileItem("ParentDir", "directory", null, "N/A", "."),
            FileItem("Document.pdf", "file", "1.2 MB", "10/25/2025", "$path/Document.pdf"),
            FileItem("NewFolder", "directory", null, "10/30/2025", "$path/NewFolder"),
        ).filter { it.name != "ParentDir" || path.isNotEmpty() }

    } catch (e: Exception) {
        println("❌ Error listing directory contents: ${e.message}")
        null
    }
}

/**
 * Renames a file or folder using the /rename POST endpoint.
 * @param oldPath The current full relative path of the item.
 * @param newName The desired new name for the item.
 * @return True on success, false on failure.
 */
suspend fun renameItem(oldPath: String, newName: String): Boolean {
    println(">>> Renaming '$oldPath' to '$newName'")
    return try {
        val response = client.post("$SERVER_BASE_URL/rename") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("oldPath" to oldPath, "newName" to newName))
        }
        if (response.status == HttpStatusCode.OK) {
            println("✅ Item renamed successfully.")
            true
        } else {
            println("❌ Failed to rename: ${response.bodyAsText()}")
            false
        }
    } catch (e: Exception) {
        println("❌ Network error during rename: ${e.message}")
        false
    }
}

/**
 * Creates a new folder using the /create-folder POST endpoint.
 * @param folderName The name of the new folder.
 * @param parentPath The relative path of the parent directory.
 * @return True on success, false on failure.
 */
suspend fun createFolder(folderName: String, parentPath: String): Boolean {
    println(">>> Creating folder '$folderName' in '$parentPath'")
    return try {
        val response = client.post("$SERVER_BASE_URL/create-folder") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("name" to folderName, "path" to parentPath))
        }
        if (response.status == HttpStatusCode.OK) {
            println("✅ Folder created successfully.")
            true
        } else {
            println("❌ Failed to create folder: ${response.bodyAsText()}")
            false
        }
    } catch (e: Exception) {
        println("❌ Network error during folder creation: ${e.message}")
        false
    }
}

/**
 * Deletes a file or folder using the /delete POST endpoint.
 * @param path The relative path of the item to delete.
 * @return True on success, false on failure.
 */
suspend fun deleteItem(path: String): Boolean {
    println(">>> Deleting item: '$path'")
    return try {
        val response = client.post("$SERVER_BASE_URL/delete") {
            contentType(ContentType.Application.Json)
            setBody(mapOf("path" to path))
        }
        if (response.status == HttpStatusCode.OK) {
            println("✅ Item deleted successfully.")
            true
        } else {
            println("❌ Failed to delete: ${response.bodyAsText()}")
            false
        }
    } catch (e: Exception) {
        println("❌ Network error during deletion: ${e.message}")
        false
    }
}

// --- Demonstration (Example usage within the app's ViewModel or repository) ---
suspend fun demoNasApp() {
    var currentPath = ""

    // 1. Initial List (Root Directory)
    println("\n--- 1. Listing Root Directory ---")
    var items = listDirectoryContents(currentPath)
    items?.forEach { println(" | ${it.type.padEnd(9)} | ${it.name}") }

    // 2. Create a folder
    if (createFolder("NewMobileFolder", currentPath)) {
        // 3. List again to see the new folder
        println("\n--- 3. Listing After Creation ---")
        items = listDirectoryContents(currentPath)
        items?.forEach { println(" | ${it.type.padEnd(9)} | ${it.name}") }
    }

    // 4. Rename the folder
    val oldPath = "NewMobileFolder"
    val newName = "RenamedFolder"
    if (renameItem(oldPath, newName)) {
        // 5. List after rename
        println("\n--- 5. Listing After Rename ---")
        items = listDirectoryContents(currentPath)
        items?.forEach { println(" | ${it.type.padEnd(9)} | ${it.name}") }
    }

    // 6. Delete the folder
    if (deleteItem(newName)) {
        // 7. Final list
        println("\n--- 7. Listing After Deletion ---")
        items = listDirectoryContents(currentPath)
        items?.forEach { println(" | ${it.type.padEnd(9)} | ${it.name}") }
    }
}

// This is how you'd execute the demo in a KTS file:
import kotlinx.coroutines.runBlocking
        runBlocking {
            demoNasApp()
            client.close()
        }