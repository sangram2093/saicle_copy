package com.github.dbsaicledev.dbsaicleintellijextension.services

import com.github.dbsaicledev.dbsaicleintellijextension.constants.getConfigJsonPath
import com.github.dbsaicledev.dbsaicleintellijextension.error.DbSaicleSentryService
import com.google.gson.Gson
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.DumbAware
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.io.HttpRequests
import com.intellij.util.messages.Topic
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import java.io.File
import java.io.IOException
import java.net.URL
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.swing.*

class DbSaicleSettingsComponent : DumbAware {
    val panel: JPanel = JPanel(GridBagLayout())
    val remoteConfigServerUrl: JTextField = JTextField()
    val remoteConfigSyncPeriod: JTextField = JTextField()
    val userToken: JTextField = JTextField()
    val enableTabAutocomplete: JCheckBox = JCheckBox("Enable Tab Autocomplete")
    val displayEditorTooltip: JCheckBox = JCheckBox("Display Editor Tooltip")
    val showIDECompletionSideBySide: JCheckBox = JCheckBox("Show IDE completions side-by-side")

    init {
        val constraints = GridBagConstraints()

        constraints.fill = GridBagConstraints.HORIZONTAL
        constraints.weightx = 1.0
        constraints.weighty = 0.0
        constraints.gridx = 0
        constraints.gridy = GridBagConstraints.RELATIVE

        panel.add(JLabel("Remote Config Server URL:"), constraints)
        constraints.gridy++
        constraints.gridy++
        panel.add(remoteConfigServerUrl, constraints)
        constraints.gridy++
        panel.add(JLabel("Remote Config Sync Period (in minutes):"), constraints)
        constraints.gridy++
        panel.add(remoteConfigSyncPeriod, constraints)
        constraints.gridy++
        panel.add(JLabel("User Token:"), constraints)
        constraints.gridy++
        panel.add(userToken, constraints)
        constraints.gridy++
        panel.add(enableTabAutocomplete, constraints)
        constraints.gridy++
        panel.add(displayEditorTooltip, constraints)
        constraints.gridy++
        panel.add(showIDECompletionSideBySide, constraints)
        constraints.gridy++

        // Add a "filler" component that takes up all remaining vertical space
        constraints.weighty = 1.0
        val filler = JPanel()
        panel.add(filler, constraints)
    }
}

data class DbSaicleRemoteConfigSyncResponse(
    var configJson: String?,
    var configJs: String?
)

@State(
    name = "com.github.dbsaicledev.dbsaicleintellijextension.services.DbSaicleExtensionSettings",
    storages = [Storage("DbSaicleExtensionSettings.xml")]
)
open class DbSaicleExtensionSettings : PersistentStateComponent<DbSaicleExtensionSettings.DbSaicleState> {

    class DbSaicleState {
        var lastSelectedInlineEditModel: String? = null
        var shownWelcomeDialog: Boolean = false
        var remoteConfigServerUrl: String? = null
        var remoteConfigSyncPeriod: Int = 60
        var userToken: String? = null
        var enableTabAutocomplete: Boolean = true
        var displayEditorTooltip: Boolean = true
        var showIDECompletionSideBySide: Boolean = false
        var dbsaicleTestEnvironment: String = "production"
    }

    var dbsaicleState: DbSaicleState = DbSaicleState()

    private var remoteSyncFuture: ScheduledFuture<*>? = null

    override fun getState(): DbSaicleState {
        return dbsaicleState
    }

    override fun loadState(state: DbSaicleState) {
        dbsaicleState = state
    }

    companion object {
        val instance: DbSaicleExtensionSettings
            get() = service<DbSaicleExtensionSettings>()
    }


    // Sync remote config from server
    private fun syncRemoteConfig() {
        val remoteServerUrl = state.remoteConfigServerUrl
        val token = state.userToken
        if (remoteServerUrl != null && remoteServerUrl.isNotEmpty()) {
            val baseUrl = remoteServerUrl.removeSuffix("/")
            try {
                val url = "$baseUrl/sync"
                val responseBody = HttpRequests.request(url)
                    .tuner { connection ->
                        if (token != null)
                            connection.addRequestProperty("Authorization", "Bearer $token")
                    }.readString()
                val response = Gson().fromJson(responseBody, DbSaicleRemoteConfigSyncResponse::class.java)
                val file = File(getConfigJsonPath(URL(url).host))
                response.configJs.let { file.writeText(it!!) }
                response.configJson.let { file.writeText(it!!) }
            } catch (e: IOException) {
                service<DbSaicleSentryService>().report(e, "Unexpected exception during remote config sync")
            }
        }
    }

    // Create a scheduled task to sync remote config every `remoteConfigSyncPeriod` minutes
    fun addRemoteSyncJob() {

        if (remoteSyncFuture != null) {
            remoteSyncFuture?.cancel(false)
        }

        instance.remoteSyncFuture = AppExecutorUtil.getAppScheduledExecutorService()
            .scheduleWithFixedDelay(
                ::syncRemoteConfig,
                0,
                dbsaicleState.remoteConfigSyncPeriod.toLong(),
                TimeUnit.MINUTES
            )
    }
}

interface SettingsListener {
    fun settingsUpdated(settings: DbSaicleExtensionSettings.DbSaicleState)

    companion object {
        val TOPIC = Topic.create("SettingsUpdate", SettingsListener::class.java)
    }
}

class DbSaicleExtensionConfigurable : Configurable {
    private var mySettingsComponent: DbSaicleSettingsComponent? = null

    override fun createComponent(): JComponent {
        mySettingsComponent = DbSaicleSettingsComponent()
        return mySettingsComponent!!.panel
    }

    override fun isModified(): Boolean {
        val settings = DbSaicleExtensionSettings.instance
        val modified =
            mySettingsComponent?.remoteConfigServerUrl?.text != settings.dbsaicleState.remoteConfigServerUrl ||
                    mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() != settings.dbsaicleState.remoteConfigSyncPeriod ||
                    mySettingsComponent?.userToken?.text != settings.dbsaicleState.userToken ||
                    mySettingsComponent?.enableTabAutocomplete?.isSelected != settings.dbsaicleState.enableTabAutocomplete ||
                    mySettingsComponent?.displayEditorTooltip?.isSelected != settings.dbsaicleState.displayEditorTooltip ||
                    mySettingsComponent?.showIDECompletionSideBySide?.isSelected != settings.dbsaicleState.showIDECompletionSideBySide
        return modified
    }

    override fun apply() {
        val settings = DbSaicleExtensionSettings.instance
        settings.dbsaicleState.remoteConfigServerUrl = mySettingsComponent?.remoteConfigServerUrl?.text
        settings.dbsaicleState.remoteConfigSyncPeriod = mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() ?: 60
        settings.dbsaicleState.userToken = mySettingsComponent?.userToken?.text
        settings.dbsaicleState.enableTabAutocomplete = mySettingsComponent?.enableTabAutocomplete?.isSelected ?: false
        settings.dbsaicleState.displayEditorTooltip = mySettingsComponent?.displayEditorTooltip?.isSelected ?: true
        settings.dbsaicleState.showIDECompletionSideBySide =
            mySettingsComponent?.showIDECompletionSideBySide?.isSelected ?: false

        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsListener.TOPIC)
            .settingsUpdated(settings.dbsaicleState)
        DbSaicleExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun reset() {
        val settings = DbSaicleExtensionSettings.instance
        mySettingsComponent?.remoteConfigServerUrl?.text = settings.dbsaicleState.remoteConfigServerUrl
        mySettingsComponent?.remoteConfigSyncPeriod?.text = settings.dbsaicleState.remoteConfigSyncPeriod.toString()
        mySettingsComponent?.userToken?.text = settings.dbsaicleState.userToken
        mySettingsComponent?.enableTabAutocomplete?.isSelected = settings.dbsaicleState.enableTabAutocomplete
        mySettingsComponent?.displayEditorTooltip?.isSelected = settings.dbsaicleState.displayEditorTooltip
        mySettingsComponent?.showIDECompletionSideBySide?.isSelected =
            settings.dbsaicleState.showIDECompletionSideBySide

        DbSaicleExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String =
        "DbSaicle Extension Settings"
}
