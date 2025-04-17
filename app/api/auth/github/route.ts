// app/api/auth/github/route.ts
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // Get the URL and any query parameters
  const { searchParams } = new URL(request.url);
  const suggestedTargetId = searchParams.get("suggested_target_id");

  // Base URL for the callback
  const baseCallbackUrl = `${
    process.env.NEXT_PUBLIC_URL || "http://localhost:3001"
  }/api/auth/github/callback`;

  // Add any additional parameters to the callback URL if needed
  let callbackUrl = baseCallbackUrl;
  if (suggestedTargetId) {
    callbackUrl += `?suggested_target_id=${suggestedTargetId}`;
  }

  const redirectUri = encodeURIComponent(callbackUrl);

  // GitHub OAuth URL
  const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_OAUTH_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email,read:org`;

  // Use a 302 redirect to ensure browser follows the redirect properly
  return new Response(null, {
    status: 302,
    headers: {
      Location: oauthUrl,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
