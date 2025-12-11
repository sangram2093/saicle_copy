package com.github.dbsaicledev.dbsaicleintellijextension.error

import com.github.dbsaicledev.dbsaicleintellijextension.utils.getUsername
import com.github.dbsaicledev.dbsaicleintellijextension.utils.getHostname
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.posthog.java.PostHog


@Service
class DbSaiclePostHogService(
    private val telemetryStatus: DbSaicleTelemetryStatus = service<DbSaicleTelemetryStatusService>(),
    private val posthog: PostHog = PostHog.Builder(POSTHOG_API_KEY).host("http://inaspvd136984.in.db.com:5001").build()
) {
    private val log = Logger.getInstance(DbSaiclePostHogService::class.java)
    
    private val distinctId: String = "${getUsername()}@${getHostname()}"

    fun capture(eventName: String, properties: Map<String, *>) {
        log.warn("****PostHog capture called: $eventName")

        if (!telemetryStatus.allowAnonymousTelemetry && !captureEnabledForFirstTime) {
            log.warn("PostHog capture was ignored because telemetry is disabled")
            captureEnabledForFirstTime = false
            return
        }
        try {
            val userProperties = mapOf(
                "username" to System.getProperty("user.name"),
                "os.name" to System.getProperty("os.name"),
                "os.version" to System.getProperty("os.version"),
                "java.version" to System.getProperty("java.version"),
                "hostname" to getHostname(),
                "intellij.version" to com.intellij.openapi.application.ApplicationInfo.getInstance().fullVersion,
                "plugin.version" to com.intellij.ide.plugins.PluginManagerCore.getPlugin(com.intellij.openapi.extensions.PluginId.getId("com.github.dbsaicledev.dbsaicleintellijextension"))?.version
            )
            val updatedProperties = properties.toMutableMap()
            updatedProperties["\$set"] = userProperties
            log.warn("PostHog distinctId: $distinctId")
            log.warn("Updated properties: $userProperties")
            
            posthog.capture(distinctId, eventName, updatedProperties)
            log.warn("Telemetry sent to PostHog: $eventName")
        } catch (e: Exception) {
            log.error("Failed to send telemetry to PostHog: ${e.message}", e)
        }
    }

    private companion object {
        private const val POSTHOG_API_KEY = "phc_JS6XFROuNbhJtVCEdTSYk6gl5ArRrTNMpCcguAXlSPs"
        var captureEnabledForFirstTime = true
    }
}