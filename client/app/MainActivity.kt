package com.example.nasclient

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.nasclient.ui.FileListScreen
import com.example.nasclient.ui.theme.NasMobileClientTheme // Use your app's generated theme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // IMPORTANT: Add this permission to your AndroidManifest.xml manually
        // <uses-permission android:name="android.permission.INTERNET"/>

        setContent {
            NasMobileClientTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    FileListScreen()
                }
            }
        }
    }
}