package com.github.dbsaicledev.dbsaicleintellijextension.browser

import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.JBCefApp

@Service(Service.Level.PROJECT)
class DbSaicleBrowserService(project: Project): Disposable {

    private val browser: DbSaicleBrowser? =
        if (JBCefApp.isSupported())
            DbSaicleBrowser(project)
        else null

    override fun dispose() {
        if (browser != null)
            Disposer.dispose(browser)
    }

    companion object {

        fun Project.getBrowser(): DbSaicleBrowser? {
            if (isDisposed)
                return null
            return service<DbSaicleBrowserService>().browser
        }

    }
}
