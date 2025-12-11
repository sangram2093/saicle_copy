package com.github.dbsaicledev.dbsaicleintellijextension.utils

import com.github.dbsaicledev.dbsaicleintellijextension.FimResult
import com.intellij.openapi.vfs.VirtualFile
import java.net.NetworkInterface
import java.util.*
import java.awt.event.KeyEvent.*
import com.intellij.openapi.application.ApplicationInfo
import com.intellij.openapi.util.BuildNumber
import java.net.InetAddress
import org.json.JSONObject

enum class OS {
    MAC, WINDOWS, LINUX
}

fun getMetaKey(): Int {
    return when (getOS()) {
        OS.MAC -> VK_META
        OS.WINDOWS -> VK_CONTROL
        OS.LINUX -> VK_CONTROL
    }
}

fun getOS(): OS {
    val osName = System.getProperty("os.name").lowercase()
    val os = when {
        osName.contains("mac") || osName.contains("darwin") -> OS.MAC
        osName.contains("win") -> OS.WINDOWS
        osName.contains("nix") || osName.contains("nux") || osName.contains("aix") -> OS.LINUX
        else -> OS.LINUX
    }
    return os
}

fun getMetaKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "âŒ˜"
        OS.WINDOWS -> "^"
        OS.LINUX -> "^"
    }
}

fun getAltKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "âŒ¥"
        OS.WINDOWS -> "Alt"
        OS.LINUX -> "Alt"
    }
}

fun getShiftKeyLabel(): String {
    return when (getOS()) {
        OS.MAC -> "â‡§"
        OS.WINDOWS, OS.LINUX -> "â†‘"
    }
}

fun getMachineUniqueID(): String {
    val sb = StringBuilder()
    val networkInterfaces = NetworkInterface.getNetworkInterfaces()

    while (networkInterfaces.hasMoreElements()) {
        val networkInterface = networkInterfaces.nextElement()
        val mac = networkInterface.hardwareAddress

        if (mac != null) {
            for (i in mac.indices) {
                sb.append(
                    String.format(
                        "%02X%s",
                        mac[i],
                        if (i < mac.size - 1) "-" else ""
                    )
                )
            }
            return sb.toString()
        }
    }

    return "No MAC Address Found"
}

fun uuid(): String {
    return UUID.randomUUID().toString()
}

fun VirtualFile.toUriOrNull(): String? = fileSystem.getNioPath(this)?.toUri()?.toString()?.removeSuffix("/")

inline fun <reified T> Any?.castNestedOrNull(vararg keys: String): T? {
    return getNestedOrNull(*keys) as? T
}

fun Any?.getNestedOrNull(vararg keys: String): Any? {
    var result = this
    for (key in keys) {
        result = (result as? Map<*, *>)?.get(key) ?: return null
    }
    return result
}

/**
 * Get the target string for DbSaicle binary.
 * The format is "$os-$arch" where:
 * - os is one of: darwin, win32, or linux
 * - arch is one of: arm64 or x64
 *
 * @return Target string in format "$os-$arch"
 */
fun getOsAndArchTarget(): String {
    val os = getOS()
    val osStr = when (os) {
        OS.MAC -> "darwin"
        OS.WINDOWS -> "win32"
        OS.LINUX -> "linux"
    }

    val osArch = System.getProperty("os.arch").lowercase()
    val arch = when {
        osArch.contains("aarch64") || (osArch.contains("arm") && osArch.contains("64")) -> "arm64"
        osArch.contains("amd64") || osArch.contains("x86_64") -> "x64"
        else -> "x64"
    }

    return "$osStr-$arch"
}

fun getUsername(): String {
    return System.getProperty("user.name") ?: "Unknown User"
}

fun getHostname(): String {
    return try {
        InetAddress.getLocalHost().hostName
    } catch (e: Exception) {
        "Unknown Host"
    }
}

fun getPluginVersion(): String {
    val pluginId = "com.github.dbsaicledev.dbsaicleintellijextension" // Replace with actual plugin ID
    val pluginDescriptor = com.intellij.ide.plugins.PluginManagerCore.getPlugin(com.intellij.openapi.extensions.PluginId.getId(pluginId))
    return pluginDescriptor?.version ?: "Unknown Version"
}

fun getIdeType(): String {
    return ApplicationInfo.getInstance().versionName
}

fun getIdeVersion(): String {
    val build: BuildNumber = ApplicationInfo.getInstance().build
    return build.asString()
}

fun dbSaiclePluginInfo(): String {
    val json = JSONObject()
    json.put("username", getUsername())
    json.put("hostname", getHostname())
    json.put("pluginVersion", getPluginVersion())
    json.put("ideType", getIdeType())
    json.put("ideVersion", getIdeVersion())

    return json.toString()
}