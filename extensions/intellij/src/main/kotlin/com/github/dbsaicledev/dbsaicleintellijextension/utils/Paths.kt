package com.github.dbsaicledev.dbsaicleintellijextension.utils

import com.intellij.ide.plugins.PluginManager
import com.intellij.openapi.extensions.PluginId
import com.github.dbsaicledev.dbsaicleintellijextension.constants.DbSaicleConstants
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Gets the path to the DbSaicle plugin directory
 *
 * @return Path to the plugin directory
 * @throws Exception if the plugin is not found
 */
fun getDbSaiclePluginPath(): Path {
    val pluginDescriptor =
        PluginManager.getPlugin(PluginId.getId(DbSaicleConstants.PLUGIN_ID)) ?: throw Exception("Plugin not found")
    return pluginDescriptor.pluginPath
}

/**
 * Gets the path to the DbSaicle core directory with target platform
 *
 * @return Path to the DbSaicle core directory with target platform
 * @throws Exception if the plugin is not found
 */
fun getDbSaicleCorePath(): String {
    val pluginPath = getDbSaiclePluginPath()
    val corePath = Paths.get(pluginPath.toString(), "core").toString()
    val target = getOsAndArchTarget()
    return Paths.get(corePath, target).toString()
}

/**
 * Gets the path to the DbSaicle binary executable
 *
 * @return Path to the DbSaicle binary executable
 * @throws Exception if the plugin is not found
 */
fun getDbSaicleBinaryPath(): String {
    val targetPath = getDbSaicleCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "dbsaicle-binary$exeSuffix").toString()
}

/**
 * Gets the path to the Ripgrep executable
 *
 * @return Path to the Ripgrep executable
 * @throws Exception if the plugin is not found
 */
fun getRipgrepPath(): String {
    val targetPath = getDbSaicleCorePath()
    val os = getOS()
    val exeSuffix = if (os == OS.WINDOWS) ".exe" else ""
    return Paths.get(targetPath, "rg$exeSuffix").toString()
}