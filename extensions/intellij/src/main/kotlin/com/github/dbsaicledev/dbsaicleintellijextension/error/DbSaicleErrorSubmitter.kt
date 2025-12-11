package com.github.dbsaicledev.dbsaicleintellijextension.error

import com.intellij.diagnostic.IdeaReportingEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.ErrorReportSubmitter
import com.intellij.openapi.diagnostic.IdeaLoggingEvent
import com.intellij.openapi.diagnostic.SubmittedReportInfo
import com.intellij.openapi.diagnostic.SubmittedReportInfo.SubmissionStatus
import com.intellij.util.Consumer
import java.awt.Component

class DbSaicleErrorSubmitter : ErrorReportSubmitter() {

    override fun getReportActionText() =
        "Report to DbSaicle"

    override fun submit(
        events: Array<out IdeaLoggingEvent?>,
        additionalInfo: String?,
        parentComponent: Component,
        consumer: Consumer<in SubmittedReportInfo>
    ): Boolean {
        try {
            // todo: IdeaReportingEvent is deprecated; migrate to IdeaLoggingEvent + figure out how to read attachments
            val event = events.filterIsInstance<IdeaReportingEvent>()
                .firstOrNull() ?: return false
            service<DbSaicleSentryService>().report(
                throwable = event.data.throwable,
                message = additionalInfo ?: event.data.message,
                attachments = event.data.allAttachments,
                ignoreTelemetrySettings = true
            )
        } catch (_: Exception) {
            consumer.consume(SubmittedReportInfo(SubmissionStatus.FAILED))
            return false
        }
        consumer.consume(SubmittedReportInfo(SubmissionStatus.NEW_ISSUE))
        return true
    }

}
