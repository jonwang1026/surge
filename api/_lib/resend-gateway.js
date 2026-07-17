import { Resend } from "resend";

export class ResendGateway {
  /** @param {string} apiKey */
  constructor(apiKey) {
    this.resend = new Resend(apiKey);
  }

  /** @param {string} email @param {string} segmentId @param {string} topicId */
  async getSubscription(email, segmentId, topicId) {
    const contactResponse = await this.resend.contacts.get({ email });
    if (contactResponse.error?.statusCode === 404) {
      return { subscribed: false, inSegment: false, topicOptIn: false };
    }
    const contact = unwrap(contactResponse);
    const [segments, topics] = await Promise.all([
      this.resend.contacts.segments.list({ email }),
      this.resend.contacts.topics.list({ email }),
    ]);
    const segmentData = unwrap(segments).data;
    const topicData = unwrap(topics).data;
    return {
      subscribed: !contact.unsubscribed,
      inSegment: segmentData.some((segment) => segment.id === segmentId),
      topicOptIn: topicData.some(
        (topic) => topic.id === topicId && topic.subscription === "opt_in",
      ),
    };
  }

  /**
   * @param {{to: string, from: string, templateId: string, brandName: string,
   * confirmUrl: string, privacyUrl: string, postalAddress: string, mode: string,
   * idempotencyKey: string}} message
   */
  async sendConfirmation(message) {
    const response = await this.resend.emails.send(
      {
        from: message.from,
        to: message.to,
        subject: `Confirm your ${message.brandName} early access`,
        template: {
          id: message.templateId,
          variables: {
            BRAND_NAME: message.brandName,
            CONFIRM_URL: message.confirmUrl,
            EXPIRY: "24 hours",
            PRIVACY_URL: message.privacyUrl,
            POSTAL_ADDRESS: message.postalAddress,
          },
        },
        tags: [
          { name: "category", value: "confirm_email" },
          { name: "environment", value: message.mode },
        ],
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (
      response.error?.name === "invalid_idempotent_request" ||
      response.error?.name === "concurrent_idempotent_requests"
    ) {
      return;
    }
    unwrap(response);
  }

  /**
   * Idempotently create or update a confirmed subscriber.
   * @param {{email: string, segmentId: string, topicId: string,
   * properties: Record<string, string>}} confirmation
   */
  async confirmContact(confirmation) {
    const existing = await this.resend.contacts.get({ email: confirmation.email });
    if (existing.error?.statusCode === 404) {
      unwrap(
        await this.resend.contacts.create({
          email: confirmation.email,
          unsubscribed: false,
          properties: confirmation.properties,
          segments: [{ id: confirmation.segmentId }],
          topics: [{ id: confirmation.topicId, subscription: "opt_in" }],
        }),
      );
      return;
    }

    unwrap(existing);
    const subscription = await this.getSubscription(
      confirmation.email,
      confirmation.segmentId,
      confirmation.topicId,
    );
    unwrap(
      await this.resend.contacts.update({
        email: confirmation.email,
        unsubscribed: false,
        properties: confirmation.properties,
      }),
    );
    if (!subscription.inSegment) {
      unwrap(
        await this.resend.contacts.segments.add({
          email: confirmation.email,
          segmentId: confirmation.segmentId,
        }),
      );
    }
    if (!subscription.topicOptIn) {
      unwrap(
        await this.resend.contacts.topics.update({
          email: confirmation.email,
          topics: [{ id: confirmation.topicId, subscription: "opt_in" }],
        }),
      );
    }
  }

  /** @param {string} payload @param {{id: string, timestamp: string, signature: string}} headers @param {string} webhookSecret */
  verifyWebhook(payload, headers, webhookSecret) {
    return this.resend.webhooks.verify({ payload, headers, webhookSecret });
  }

  /** @param {{email: string, topicId: string}} suppression */
  async suppressContact(suppression) {
    const existing = await this.resend.contacts.get({ email: suppression.email });
    if (existing.error?.statusCode === 404) return;
    unwrap(existing);
    unwrap(
      await this.resend.contacts.update({
        email: suppression.email,
        unsubscribed: true,
      }),
    );
    unwrap(
      await this.resend.contacts.topics.update({
        email: suppression.email,
        topics: [{ id: suppression.topicId, subscription: "opt_out" }],
      }),
    );
  }
}

/** @template T @param {{data: T | null, error: {message: string} | null}} response @returns {T} */
function unwrap(response) {
  if (response.error || !response.data) throw new Error("Resend request failed");
  return response.data;
}
