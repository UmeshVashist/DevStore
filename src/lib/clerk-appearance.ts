import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#6366f1",
    colorBackground: "transparent",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "shadow-none border-0 w-full",
    card: "bg-transparent shadow-none border-0 w-full p-0",
    headerTitle: "text-slate-800 dark:text-white font-bold text-xl",
    headerSubtitle: "text-slate-500 dark:text-slate-400 text-sm",
    socialButtonsBlockButton:
      "bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm transition-all",
    socialButtonsBlockButtonText: "text-slate-700 dark:text-slate-200 font-semibold",
    alternativeMethodsBlockButton:
      "bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm transition-all",
    alternativeMethodsBlockButtonText: "text-slate-700 dark:text-slate-200 font-semibold",
    formFieldLabel: "text-slate-700 dark:text-slate-300 font-bold text-xs",
    formFieldInput:
      "bg-slate-100/50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 font-semibold px-4 py-2.5 rounded-xl shadow-inner",
    formButtonPrimary:
      "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-md font-bold transition-all py-2.5 rounded-xl cursor-pointer",
    footerActionText: "text-slate-500 dark:text-slate-400 text-xs",
    footerActionLink:
      "text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold text-xs",
    identityPreviewText: "text-slate-800 dark:text-slate-200",
    identityPreviewEditButton: "text-indigo-600 dark:text-indigo-400",
    formFieldInputShowPasswordButton: "text-slate-400 dark:text-slate-500",
    dividerLine: "bg-slate-200 dark:bg-white/10",
    dividerText: "text-slate-400 dark:text-slate-500 text-xs",
    alertText: "text-slate-600 dark:text-slate-400",
    otpCodeFieldInput: "bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white",
  },
};
