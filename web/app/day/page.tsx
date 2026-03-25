import { permanentRedirect } from "next/navigation";

export default function LegacyDayPage() {
  permanentRedirect("/today");
}
