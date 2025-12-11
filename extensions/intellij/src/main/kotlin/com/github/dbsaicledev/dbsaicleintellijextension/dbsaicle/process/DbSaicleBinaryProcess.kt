package com.github.dbsaicledev.dbsaicleintellijextension.dbsaicle.process

import com.github.dbsaicledev.dbsaicleintellijextension.error.DbSaiclePostHogService
import com.github.dbsaicledev.dbsaicleintellijextension.error.DbSaicleSentryService
import com.github.dbsaicledev.dbsaicleintellijextension.proxy.ProxySettings
import com.github.dbsaicledev.dbsaicleintellijextension.utils.OS
import com.github.dbsaicledev.dbsaicleintellijextension.utils.getDbSaicleBinaryPath
import com.github.dbsaicledev.dbsaicleintellijextension.utils.getOS
import com.intellij.openapi.components.service
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Files
import java.nio.file.Paths
import java.nio.file.attribute.PosixFilePermission

class DbSaicleBinaryProcess(
    private val onUnexpectedExit: () -> Unit
) : DbSaicleProcess {

    private val process = startBinaryProcess()
    override val input: InputStream = process.inputStream
    override val output: OutputStream = process.outputStream

    override fun close() =
        process.destroy()

    private fun startBinaryProcess(): Process {
        service<DbSaiclePostHogService>().capture("dbsaicle_core_start", mapOf("error" to "none"))
        val path = getDbSaicleBinaryPath()
        runBlocking(Dispatchers.IO) {
            setPermissions()
        }

        val builder = ProcessBuilder(path)
        builder.environment() += ProxySettings.getSettings().toDbSaicleEnvVars()
        return builder
            .directory(File(path).parentFile)
            .start()
            .apply { onExit().thenRun(onUnexpectedExit).thenRun(::reportErrorTelemetry) }
    }

    private fun reportErrorTelemetry() {
        var err = process.errorStream?.bufferedReader()?.readText()?.trim()
        if (err != null) {
            // There are often "⚡️Done in Xms" messages, and we want everything after the last one
            val delimiter = "⚡ Done in"
            val doneIndex = err.lastIndexOf(delimiter)
            if (doneIndex != -1) {
                err = err.substring(doneIndex + delimiter.length)
            }
        }
        service<DbSaicleSentryService>().reportMessage("Core process exited with output: $err")
        service<DbSaiclePostHogService>().capture("jetbrains_core_exit", mapOf("error" to err))
    }

    private companion object {

        private fun setPermissions() {
            val os = getOS()
            when (os) {
                OS.MAC -> setMacOsPermissions()
                OS.WINDOWS -> {}
                OS.LINUX -> elevatePermissions()
            }
        }

        private fun setMacOsPermissions() {
            ProcessBuilder("xattr", "-dr", "com.apple.quarantine", getDbSaicleBinaryPath()).start().waitFor()
            elevatePermissions()
        }

        // todo: consider setting permissions ahead-of-time during build/packaging, not at runtime
        private fun elevatePermissions() {
            val path = getDbSaicleBinaryPath()
            val permissions = setOf(
                PosixFilePermission.OWNER_READ,
                PosixFilePermission.OWNER_WRITE,
                PosixFilePermission.OWNER_EXECUTE
            )
            Files.setPosixFilePermissions(Paths.get(path), permissions)
        }
    }

}
