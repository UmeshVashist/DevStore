import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth/google/callback(.*)",
]);

const isAuthPage = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  // Already signed in → go to dashboard
  if (userId && isAuthPage(request)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!isPublicRoute(request) && !isApiRoute) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|xls|pptx?|pdf|zip|webmanifest)).*)",
    "/api/((?!files).*)",
    "/trpc(.*)",
  ],
};
