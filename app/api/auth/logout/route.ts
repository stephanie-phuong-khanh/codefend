// app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  
  // Clear the session cookie with explicit options to ensure proper deletion
  cookieStore.delete({
    name: 'session_token',
    path: '/',
    // Setting these options helps ensure the cookie is properly removed
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  });
  
  // Return success response
  return NextResponse.json({ 
    success: true, 
    message: 'Logged out successfully' 
  }, {
    headers: {
      // Add cache control headers to prevent caching of this response
      'Cache-Control': 'no-store, max-age=0, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}
