import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#6366f1",
    colorBackground: "rgba(15, 15, 30, 0.85)",
    colorInputBackground: "rgba(255, 255, 255, 0.1)",
    colorInputText: "#ffffff",
    colorText: "#ffffff",
    colorTextSecondary: "rgba(255, 255, 255, 0.65)",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    card: "bg-transparent shadow-none border-0 w-full",
    headerTitle: "text-white text-xl",
    headerSubtitle: "text-white/60",
    socialButtonsBlockButton:
      "bg-white/10 border border-white/20 text-white hover:bg-white/20",
    formFieldLabel: "text-white/80",
    formFieldInput: "bg-white/10 border border-white/20 text-white placeholder:text-white/40",
    formButtonPrimary:
      "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg",
    footerActionLink: "text-indigo-300 hover:text-indigo-200",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-indigo-300",
    formFieldInputShowPasswordButton: "text-white/60",
    dividerLine: "bg-white/20",
    dividerText: "text-white/50",
    alertText: "text-white/80",
    otpCodeFieldInput: "bg-white/10 border border-white/20 text-white",
  },
};
