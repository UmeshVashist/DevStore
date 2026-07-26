import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/google/callback(.*)",
  "/__clerk/(.*)",
]);

const isAuthPage = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(
  async (auth, request) => {
    const { userId } = await auth();
    const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

    // Already signed in → go to dashboard
    if (userId && isAuthPage(request)) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!isPublicRoute(request) && !isApiRoute) {
      await auth.protect();
    }
  },
  (req) => {
    const host = req.nextUrl.host;
    const isLocalhost = host.includes("localhost");
    const rawDomain = isLocalhost ? host : process.env.NEXT_PUBLIC_CLERK_DOMAIN;
    const domain = rawDomain ? rawDomain.replace(/^https?:\/\//, "") : undefined;
    return {
      isSatellite: process.env.NEXT_PUBLIC_CLERK_IS_SATELLITE === "true",
      domain,
      satelliteAutoSync: true,
      signInUrl: isLocalhost 
        ? "http://localhost:3000/auth/login" 
        : process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    };
  }
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|xls|pptx?|pdf|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
