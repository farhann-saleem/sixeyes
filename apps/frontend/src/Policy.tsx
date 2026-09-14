type PolicySection = { title: string; body: string[] };

const TERMS: PolicySection[] = [
  {
    title: "1. Agreement",
    body: [
      "By using Marketing Studio (marketingstudioie.site) you agree to these Terms and Conditions. If you do not agree, do not use the service.",
    ],
  },
  {
    title: "2. The service",
    body: [
      "Marketing Studio is a generative-media workspace: create avatars, recreate images, generate video clips, and build documentary films from a topic. Generation is asynchronous — you submit a job and the studio works on it in the background.",
    ],
  },
  {
    title: "3. Accounts",
    body: [
      "You sign in with Google. You are responsible for what happens under your account. You must be at least 13 years old to use the service.",
    ],
  },
  {
    title: "4. Plans and quotas",
    body: [
      "Free, Pro, and Premium plans each carry a monthly allowance of avatars, image recreations, videos, and documentaries, plus a per-minute request rate. Allowances reset each calendar month. Paid plans are granted for 30 days per successful payment.",
    ],
  },
  {
    title: "5. Acceptable use",
    body: [
      "Do not generate content that is unlawful, infringing, abusive, or that impersonates a real person without their consent. Do not scrape, resell, or mirror the service. We may suspend accounts that abuse the platform or attempt to bypass limits.",
    ],
  },
  {
    title: "6. Your content",
    body: [
      "You keep rights to the content you create. You grant us the limited license needed to run, store, and deliver it back to you.",
    ],
  },
  {
    title: "7. Availability",
    body: [
      "The service is provided as-is. We do not guarantee uninterrupted availability, and generation quality depends on the underlying models and providers.",
    ],
  },
  {
    title: "8. Changes and termination",
    body: [
      "We may update these terms and will post the new version on this page. We may suspend or terminate accounts that violate these terms without notice.",
    ],
  },
  {
    title: "9. Contact",
    body: ["Questions about these terms: contact us at the address and number in the footer below."],
  },
];

const REFUND: PolicySection[] = [
  {
    title: "1. Nature of digital goods",
    body: [
      "Marketing Studio provides immediate access to digital generation credits and features. Because our products are digital, all purchases are generally non-refundable once access has been granted to the user account.",
    ],
  },
  {
    title: "2. Refund eligibility",
    body: [
      "Refunds may be considered on a case-by-case basis under the following circumstances:",
      "A technical defect prevents you from accessing the content, and our support team is unable to resolve the issue within 72 hours.",
      "Duplicate payments made due to a processing error by the payment gateway.",
    ],
  },
  {
    title: "3. Refund process",
    body: [
      "To request a refund, please contact us within 7 days of your purchase. You must provide proof of purchase and a detailed description of the issue.",
    ],
  },
  {
    title: "4. Non-refundable items",
    body: [
      "Refunds will not be issued for “change of mind” or if the user has already completed a significant portion of the available generation allowances or features.",
    ],
  },
];

const DELIVERY: PolicySection[] = [
  {
    title: "1. Digital delivery",
    body: [
      "Marketing Studio does not ship physical goods. All features and content are delivered electronically via our website.",
    ],
  },
  {
    title: "2. Delivery timeline",
    body: [
      "Access to premium features is typically granted immediately upon successful payment confirmation. You will receive an automated email notification once your transaction is processed.",
    ],
  },
  {
    title: "3. Access requirements",
    body: [
      "To access the service, you must have a compatible device and a stable internet connection. Marketing Studio is not responsible for delivery failures resulting from user-side technical issues.",
    ],
  },
  {
    title: "4. International access",
    body: [
      "As a digital service, Marketing Studio is available to users globally, provided they comply with our Terms of Service and local regulations.",
    ],
  },
];

const CANCELLATION: PolicySection[] = [
  {
    title: "1. Subscription cancellation",
    body: [
      "If you are on a recurring subscription plan, you may cancel your membership at any time through your account settings. To avoid the next billing cycle, cancellations must be made at least 24 hours before the renewal date.",
    ],
  },
  {
    title: "2. Access after cancellation",
    body: [
      "Upon cancellation, you will retain access to premium features until the end of your current paid billing period. No further charges will be applied once the cancellation is confirmed.",
    ],
  },
  {
    title: "3. Service termination",
    body: [
      "We reserve the right to suspend or terminate your account without notice if you violate our Terms of Service, including engaging in unauthorized content sharing or scraping.",
    ],
  },
  {
    title: "4. No partial refunds",
    body: [
      "We do not provide prorated refunds for mid-month cancellations or unused portions of a subscription term.",
    ],
  },
];

const PAGES = {
  terms: {
    kicker: "Legal",
    title: "Terms and Conditions",
    updated: "Last updated: March 2026",
    sections: TERMS,
  },
  refund: {
    kicker: "Legal",
    title: "Return / Refund Policy",
    updated: "Last updated: March 2026",
    sections: REFUND,
  },
  delivery: {
    kicker: "Legal",
    title: "Delivery Policy",
    updated: "Last updated: March 2026",
    sections: DELIVERY,
  },
  cancellation: {
    kicker: "Legal",
    title: "Cancellation Policy",
    updated: "Last updated: March 2026",
    sections: CANCELLATION,
  },
} as const;

export type PolicyPage = keyof typeof PAGES;

export function Policy({ page }: { page: PolicyPage }) {
  const doc = PAGES[page];
  return (
    <div className="policy-page">
      <header className="page-head">
        <div>
          <p className="kicker">{doc.kicker}</p>
          <h1>{doc.title}</h1>
          <p className="lede">{doc.updated}</p>
        </div>
      </header>
      <article className="policy-body">
        {doc.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </section>
        ))}
      </article>
      <footer className="policy-foot">
        <p>Marketing Studio · marketingstudioie.site</p>
        <p>+92-300-4084760</p>
      </footer>
    </div>
  );
}
