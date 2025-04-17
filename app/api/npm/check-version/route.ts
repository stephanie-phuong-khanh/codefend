// app/api/npm/check-version/route.ts
import { NextResponse } from "next/server";

// Function to fetch the latest version of a package from npm
async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    
    if (!response.ok) {
      console.error(`Failed to fetch package info for ${packageName}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    return data['dist-tags']?.latest || null;
  } catch (error) {
    console.error(`Error fetching latest version for ${packageName}:`, error);
    return null;
  }
}

// Function to compare versions
function isNewerVersion(current: string, latest: string): boolean {
  // Handle special cases like "^1.0.0", "~2.0.0", etc.
  const normalizedCurrent = current.replace(/^[~^]/, '');
  
  // Simple version comparison for semver
  const currentParts = normalizedCurrent.split('.').map(part => parseInt(part, 10) || 0);
  const latestParts = latest.split('.').map(part => parseInt(part, 10) || 0);
  
  // Compare major, minor, patch
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const currentPart = currentParts[i] || 0;
    const latestPart = latestParts[i] || 0;
    
    if (latestPart > currentPart) {
      return true;
    } else if (latestPart < currentPart) {
      return false;
    }
  }
  
  // Versions are equal
  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageName = searchParams.get("package");
    const currentVersion = searchParams.get("version");
    
    if (!packageName || !currentVersion) {
      return NextResponse.json(
        { error: "Package name and current version are required" },
        { status: 400 }
      );
    }
    
    const latestVersion = await getLatestVersion(packageName);
    
    if (!latestVersion) {
      return NextResponse.json(
        { error: "Failed to fetch latest version" },
        { status: 500 }
      );
    }
    
    const hasUpdate = isNewerVersion(currentVersion, latestVersion);
    
    return NextResponse.json({
      package: packageName,
      currentVersion,
      latestVersion,
      hasUpdate
    });
  } catch (error) {
    console.error("Error checking package version:", error);
    return NextResponse.json(
      { error: "Failed to check package version" },
      { status: 500 }
    );
  }
}

// Batch endpoint to check multiple packages at once
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { packages } = body;
    
    if (!packages || !Array.isArray(packages)) {
      return NextResponse.json(
        { error: "Invalid request format. Expected an array of packages." },
        { status: 400 }
      );
    }
    
    const results = await Promise.all(
      packages.map(async (pkg) => {
        const { name, version } = pkg;
        
        if (!name || !version) {
          return {
            package: name || "unknown",
            error: "Package name and version are required"
          };
        }
        
        const latestVersion = await getLatestVersion(name);
        
        if (!latestVersion) {
          return {
            package: name,
            currentVersion: version,
            error: "Failed to fetch latest version"
          };
        }
        
        const hasUpdate = isNewerVersion(version, latestVersion);
        
        return {
          package: name,
          currentVersion: version,
          latestVersion,
          hasUpdate
        };
      })
    );
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error checking package versions:", error);
    return NextResponse.json(
      { error: "Failed to check package versions" },
      { status: 500 }
    );
  }
}
