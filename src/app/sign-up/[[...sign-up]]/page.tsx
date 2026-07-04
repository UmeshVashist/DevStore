"use client";

import { SignUp } from "@clerk/nextjs";
import { Database } from "lucide-react";
import { AuthRedirect } from "@/components/AuthRedirect";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-xl animate-float">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-white/60">Start storing your files in the cloud</p>
        </div> */}
        <div className="glass rounded-2xl p-6">
          <AuthRedirect>
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
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
