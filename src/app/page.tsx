import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs";
import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return (
    <>
      <SignedIn>
        <Dashboard />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
