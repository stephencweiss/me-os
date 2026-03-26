import type { Metadata } from "next";
import { LegalDocument, LegalSection } from "@/app/components/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy · MeOS",
  description: "How MeOS handles your data and Google account access.",
};

const LAST_UPDATED = "March 26, 2026";

export default function PrivacyPage() {
  return (
    <LegalDocument title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        MeOS (“the application”) is a personal productivity tool. This policy
        describes how information is handled when you use a deployment of MeOS
        operated by its owner (“operator”). If you use someone else’s instance,
        that operator is responsible for how the app is run and may layer
        additional terms.
      </p>

      <LegalSection title="Information we access">
        <p>
          When you sign in with Google, MeOS may access profile information
          (such as name and email) and Google Calendar data as authorized by the
          OAuth scopes you approve. Calendar access is used for scheduling,
          reporting, and related features shown in the app.
        </p>
      </LegalSection>

      <LegalSection title="How information is stored">
        <p>
          The operator’s deployment may store account and session data (for
          example via a database such as Supabase) to keep you signed in and to
          persist preferences, goals, and app-generated content. What is stored
          depends on how the operator configured the deployment.
        </p>
      </LegalSection>

      <LegalSection title="Use of data">
        <p>
          Data is used to provide the service: authentication, calendar views,
          time insights, goals, and other in-app features. MeOS is not intended
          to sell your personal information. Third parties (such as Google or
          your hosting provider) process data under their own policies when you
          use their services.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          Retention depends on operator configuration and provider tooling. You
          can revoke MeOS’s access to your Google account in your Google
          Account permissions. For data held by the operator, contact them to
          request deletion where applicable.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Reasonable measures such as HTTPS, secure cookies for sign-in, and
          access controls on backend services are expected in a typical
          deployment. No method of transmission or storage is completely
          secure.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          MeOS is not directed at children under 13 (or the minimum age required
          in your jurisdiction). Do not use the service if you do not meet that
          age requirement.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          This policy may be updated from time to time. The “Last updated” date
          at the top reflects the latest revision for this deployment’s
          published page.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For questions about this policy or this deployment, contact the
          operator of the site where you are using MeOS (for example via the
          contact information they publish on their main website).
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
