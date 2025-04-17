import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Define authentication patterns
const AUTH_PATTERNS = {
  // Public paths that don't require authentication
  PUBLIC: ["/api/auth", "/_next", "/favicon.ico"],

  // Protected paths that require authentication
  PROTECTED: ["/dashboard", "/onboarding", "/api"],
};

/**
 * Check if a path matches any pattern in the provided array
 */
function matchesPattern(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Exact match
    if (pattern === path) return true;

    // Path starts with pattern + /
    if (path.startsWith(`${pattern}/`)) return true;

    return false;
  });
}

/**
 * Check if a path is public (doesn't require authentication)
 */
function isPublicPath(path: string): boolean {
  return matchesPattern(path, AUTH_PATTERNS.PUBLIC);
}

/**
 * Check if a path is protected (requires authentication)
 */
function isProtectedPath(path: string): boolean {
  return matchesPattern(path, AUTH_PATTERNS.PROTECTED);
}

/**
 * Middleware function to handle authentication
 */
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Special case for home page (/)
  if (path === '/') {
    const sessionCookie = request.cookies.get('session_token');
    
    if (sessionCookie?.value) {
      try {
        // Verify JWT token
        const secret = new TextEncoder().encode(
          process.env.JWT_SECRET || 'development-secret'
        );
        
        // Attempt to verify the token
        const { payload } = await jwtVerify(sessionCookie.value, secret);
        
        // If token is valid and has a userId, redirect to dashboard
        if (payload.userId) {
          return NextResponse.redirect(new URL('/dashboard', request.url));
        }
      } catch (error) {
        // Invalid token, continue to home page
      }
    }
    
    // If we get here, the user is not authenticated or the token is invalid
    // Allow them to access the home page
    return NextResponse.next();
  }

  // Skip middleware for paths that aren't explicitly protected
  if (!isProtectedPath(path)) {
    return NextResponse.next();
  }

  // Skip middleware for public paths
  if (isPublicPath(path)) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionCookie = request.cookies.get("session_token");

  if (!sessionCookie?.value) {
    // No session token, redirect to login
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("session_token"); // Clear any potential invalid cookies
    return response;
  }

  try {
    // Verify JWT token
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "development-secret"
    );

    // Attempt to verify the token
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    // Check if the token has a userId
    if (!payload.userId) {
      const response = NextResponse.redirect(new URL("/", request.url));
      response.cookies.delete("session_token");
      return response;
    }

    // Token is valid, allow access
    return NextResponse.next();
  } catch (error) {
    // Invalid token, redirect to login
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("session_token");
    return response;
  }
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    // Match the home page
    "/",
    // Match all protected routes
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/api/((?!auth).*)", // Match all API routes except those starting with /api/auth
  ],
};
