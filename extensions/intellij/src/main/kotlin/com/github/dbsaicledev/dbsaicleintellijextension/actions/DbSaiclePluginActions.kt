package com.github.dbsaicledev.dbsaicleintellijextension.actions

import com.github.dbsaicledev.dbsaicleintellijextension.HighlightedCodePayload
import com.github.dbsaicledev.dbsaicleintellijextension.RangeInFileWithContents
import com.github.dbsaicledev.dbsaicleintellijextension.browser.DbSaicleBrowserService.Companion.getBrowser
import com.github.dbsaicledev.dbsaicleintellijextension.editor.DiffStreamService
import com.github.dbsaicledev.dbsaicleintellijextension.editor.EditorUtils
import com.github.dbsaicledev.dbsaicleintellijextension.services.DbSaiclePluginService
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.PlatformDataKeys
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManager
import com.intellij.openapi.project.Project
import java.io.File

class RestartDbSaicleProcess : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        e.project?.service<DbSaiclePluginService>()?.coreMessenger?.restart()
    }
}

class AcceptDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        acceptHorizontalDiff(e)
        acceptVerticalDiff(e)
    }

    private fun acceptHorizontalDiff(e: AnActionEvent) {
        val dbsaiclePluginService = e.project?.service<DbSaiclePluginService>() ?: return
        dbsaiclePluginService.diffManager?.acceptDiff(null)
    }

    private fun acceptVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.accept(editor)
    }
}

class RejectDiffAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        rejectHorizontalDiff(e)
        rejectVerticalDiff(e)
    }

    private fun rejectHorizontalDiff(e: AnActionEvent) {
        e.project?.service<DbSaiclePluginService>()?.diffManager?.rejectDiff(null)
    }

    private fun rejectVerticalDiff(e: AnActionEvent) {
        val project = e.project ?: return
        val editor =
            e.getData(PlatformDataKeys.EDITOR) ?: FileEditorManager.getInstance(project).selectedTextEditor ?: return
        val diffStreamService = project.service<DiffStreamService>()
        diffStreamService.reject(editor)
    }
}

class FocusDbSaicleInputWithoutClearAction : DbSaicleToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("focusDbSaicleInputWithoutClear")
        project.getBrowser()?.focusOnInput()
    }
}

class FocusDbSaicleInputAction : DbSaicleToolbarAction() {
    override fun toolbarActionPerformed(project: Project) =
        focusDbSaicleInput(project)

    companion object {
        fun focusDbSaicleInput(project: Project?) {
            val browser = project?.getBrowser()
                ?: return
            browser.sendToWebview("focusDbSaicleInputWithNewSession")
            browser.focusOnInput()
            val rif = EditorUtils.getEditor(project)?.getHighlightedRIF()
                ?: return
            val code = HighlightedCodePayload(RangeInFileWithContents(rif.filepath, rif.range, rif.contents))
            browser.sendToWebview("highlightedCode", code)
        }
    }
}

class NewDbSaicleSessionAction : DbSaicleToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("focusDbSaicleInputWithNewSession")
    }
}

class ViewHistoryAction : DbSaicleToolbarAction() {
    override fun toolbarActionPerformed(project: Project) {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/history", "toggle" to true))
    }
}

class OpenConfigAction : DbSaicleToolbarAction() {
    override fun toolbarActionPerformed(project: Project)  {
        project.getBrowser()?.sendToWebview("navigateTo", mapOf("path" to "/config", "toggle" to true))
    }
}

class OpenLogsAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        val logFile = File(System.getProperty("user.home") + "/.dbsaicle/logs/core.log")
        if (logFile.exists()) {
            val virtualFile = com.intellij.openapi.vfs.LocalFileSystem.getInstance().findFileByIoFile(logFile)
            if (virtualFile != null) {
                FileEditorManager.getInstance(project).openFile(virtualFile, true)
            }
        }
    }
}



