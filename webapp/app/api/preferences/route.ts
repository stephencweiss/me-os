import { NextRequest, NextResponse } from "next/server";
import { getPreference, setPreference, getAllPreferences } from "@/lib/db";

/**
 * GET /api/preferences
 *
 * Query params:
 *   - key: Specific preference key (optional, returns all if not specified)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const key = searchParams.get("key");

  try {
    if (key) {
      const value = await getPreference(key);
      return NextResponse.json({
        key,
        value,
        exists: value !== null,
      });
    }

    const preferences = await getAllPreferences();
    return NextResponse.json({
      preferences,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/preferences
 *
 * Body:
 *   - key: Preference key
 *   - value: Preference value (will be JSON stringified if object)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: "key is required" },
        { status: 400 }
      );
    }

    // Stringify objects/arrays, keep strings as-is
    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value);

    await setPreference(key, stringValue);

    return NextResponse.json({
      success: true,
      key,
      value: stringValue,
    });
  } catch (error) {
    console.error("Error setting preference:", error);
    return NextResponse.json(
      { error: "Failed to set preference" },
      { status: 500 }
    );
  }
}
