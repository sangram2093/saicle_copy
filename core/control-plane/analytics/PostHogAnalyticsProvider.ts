import { Analytics } from "@dbsaicledev/config-types";
import os from "os";

import {
  ControlPlaneProxyInfo,
  IAnalyticsProvider,
} from "./IAnalyticsProvider.js";

export default class PostHogAnalyticsProvider implements IAnalyticsProvider {
  client?: any;
  uniqueId?: string;

  async capture(
    event: string,
    properties: { [key: string]: any },
  ): Promise<void> {
    const usernameWithFqdn = `${os.userInfo().username}@${os.hostname()}`;
    this.client?.capture({
      distinctId: usernameWithFqdn,
      event,
      properties,
    });
  }

  async setup(
    config: Analytics,
    uniqueId: string,
    controlPlaneProxyInfo?: ControlPlaneProxyInfo,
  ): Promise<void> {
    if (!config || !config.clientKey || !config.url) {
      this.client = undefined;
    } else {
      try {
        this.uniqueId = uniqueId;

        const { PostHog } = await import("posthog-node");
        this.client = new PostHog(config.clientKey, {
          host: config.url,
        });
      } catch (e) {
        console.error(`Failed to setup telemetry: ${e}`);
      }
    }
  }

  async shutdown(): Promise<void> {}
}
