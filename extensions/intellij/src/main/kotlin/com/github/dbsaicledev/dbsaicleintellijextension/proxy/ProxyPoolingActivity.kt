package com.github.dbsaicledev.dbsaicleintellijextension.proxy

import com.github.dbsaicledev.dbsaicleintellijextension.services.DbSaiclePluginService
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity

import kotlinx.coroutines.*
import kotlin.time.Duration.Companion.seconds

class ProxyPoolingActivity : ProjectActivity {
    private val scope = CoroutineScope(Dispatchers.Default)
    private var lastSettings = ProxySettings.getSettings()
    private val log = Logger.getInstance(ProxyPoolingActivity::class.java)

    private fun onSettingsChanged(project: Project) {
        log.warn("Proxy settings changed, restarting")
        project.service<DbSaiclePluginService>().coreMessengerManager?.coreMessenger?.restart()
    }

    override suspend fun execute(project: Project) {
        scope.launch {
            while (isActive) {
                val newSettings = ProxySettings.getSettings()
                if (newSettings != lastSettings) {
                    onSettingsChanged(project)
                    lastSettings = newSettings
                }
                delay(2.seconds)
            }
        }
    }
}



