package com.example.nasclient.data

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

// --- Configuration ---
// IMPORTANT: Use your computer's local IP or 10.0.2.2 for emulator to access host machine
const val SERVER_BASE_URL = "http://10.0.2.2:3000"

class NasRepository {

    private val client = HttpClient(Android) {
        install(ContentNegotiation) {
            json(Json {
                isLenient = true
                ignoreUnknownKeys = true
            })
        }
    }

    /**
     * Fetches the contents of a directory using the server's root (/) GET endpoint.
     * NOTE: The server currently returns HTML. We are *assuming* a future JSON API
     * or parsing the HTML response (which is complex). Here, we simulate/assume JSON response.
     */
    suspend fun listDirectoryContents(path: String = ""): Result<List<FileItem>> {
        return try {
            val response = client.get("$SERVER_BASE_URL/") {
                url {
                    parameters.append("path", path)
                }
            }

            // The Node.js server returns an EJS template (HTML) for the '/' route.
            // For a production mobile app, the server MUST be updated to provide a dedicated
            // JSON endpoint (e.g., '/api/list') that returns a List<FileItem>.

            // Assuming the server was modified to return JSON for our client:
            if (response.status == HttpStatusCode.OK) {
                // Since the server currently returns HTML, this line will fail.
                // A successful setup requires a server change to return a JSON list:
                // return Result.success(response.body<List<FileItem>>())

                // For demonstration, we'll return a simulated success:
                return Result.success(listOf(
                    FileItem("TestDir", "directory", null, "N/A", "TestDir"),
                    FileItem("SampleFile.txt", "file", "5 KB", "N/A", "SampleFile.txt"),
                ))
            } else {
                Result.failure(Exception("Server returned status ${response.status.value}: ${response.bodyAsText()}"))
            }

        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Creates a new folder using the /create-folder POST endpoint. */
    suspend fun createFolder(folderName: String, parentPath: String): Result<Unit> {
        return try {
            val response = client.post("$SERVER_BASE_URL/create-folder") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("name" to folderName, "path" to parentPath))
            }
            if (response.status == HttpStatusCode.OK) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.bodyAsText()))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Deletes a file or folder using the /delete POST endpoint. */
    suspend fun deleteItem(path: String): Result<Unit> {
        return try {
            val response = client.post("$SERVER_BASE_URL/delete") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("path" to path))
            }
            if (response.status == HttpStatusCode.OK) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.bodyAsText()))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // You would add renameItem, moveItem, etc., here following the same pattern.
}