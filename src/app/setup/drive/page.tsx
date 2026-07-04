import { Suspense } from "react";
import { GoogleDriveSetupPage } from "@/components/GoogleDriveSetup";
import { Loader2 } from "lucide-react";

export default function SetupDrivePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <GoogleDriveSetupPage />
    </Suspense>
  );
}
