"use client";

import { SignIn } from "@clerk/nextjs";
import { AuthRedirect } from "@/components/AuthRedirect";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl animate-float">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to DevData</h1>
          <p className="text-white/60">Sign in to access your cloud storage</p>
        </div> */}
        <div className="glass rounded-2xl p-6">
          <AuthRedirect>
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              forceRedirectUrl="/"
              fallbackRedirectUrl="/"
              appearance={clerkAppearance}
            />
          </AuthRedirect>
        </div>
      </div>
    </div>
  );
}
