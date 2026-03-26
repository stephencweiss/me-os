import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/app/components/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service · MeOS",
  description: "Terms for using the MeOS application.",
};

const LAST_UPDATED = "March 26, 2026";

export default function TermsPage() {
  return (
    <LegalDocument title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (“Terms”) govern your use of MeOS (“the
        application”), a personal productivity tool. By accessing or using the
        application on an operator’s deployment, you agree to these Terms. If
        you do not agree, do not use the application.
      </p>

      <LegalSection title="The service">
        <p>
          MeOS is provided “as is” and “as available.” Features may change,
          pause, or end without notice. The operator may restrict or terminate
          access at any time.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You may need a third-party account, such as a Google account, to fully 
          benefit from the service. You are responsible for safeguarding your 
          account and for activity under your session. You must provide accurate
          information where requested and comply with Google’s terms when using
          Google sign-in.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          You agree not to misuse the application—for example, by attempting
          to gain unauthorized access, disrupt services, scrape in violation of
          applicable rules, or use the app in violation of law. The operator
          may suspend use that appears harmful or abusive.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          MeOS integrates with Google (and possibly other services the operator
          enables). Your use of those services is subject to the third party’s
          terms and privacy policies. MeOS is not responsible for third-party
          services.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          To the fullest extent permitted by law, the application is provided
          without warranties of any kind, whether express or implied, including
          merchantability, fitness for a particular purpose, and
          non-infringement. The operator does not warrant uninterrupted or
          error-free operation.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, the operator and contributors
          are not liable for any indirect, incidental, special, consequential,
          or punitive damages, or any loss of profits, data, or goodwill,
          arising from your use of the application. Some jurisdictions do not
          allow certain limitations; in those jurisdictions, liability is
          limited to the maximum extent permitted.
        </p>
      </LegalSection>

      <LegalSection title="Indemnity">
        <p>
          To the extent permitted by law, you agree to indemnify and hold
          harmless the operator from claims arising out of your use of the
          application or violation of these Terms, except to the extent caused
          by the operator’s willful misconduct.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          These Terms may be updated. The “Last updated” date at the top
          indicates when this text was last revised for this page. Continued
          use after changes constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For questions about these Terms or this deployment, contact the
          operator of the site where you are using MeOS.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
