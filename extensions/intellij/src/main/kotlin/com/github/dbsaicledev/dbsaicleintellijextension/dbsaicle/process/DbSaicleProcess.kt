package com.github.dbsaicledev.dbsaicleintellijextension.dbsaicle.process

import java.io.InputStream
import java.io.OutputStream

interface DbSaicleProcess {

    val input: InputStream
    val output: OutputStream

    fun close()

}
