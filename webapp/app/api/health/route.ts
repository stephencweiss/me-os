import { NextResponse } from "next/server";
import { createServerClient, isSupabaseConfigured } from "@/lib/supabase-server";

/**
 * GET /api/health
 *
 * Health check endpoint - no auth required.
 * Tests Supabase connectivity.
 */
export async function GET() {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        status: "degraded",
        db: "not_configured",
        message: "Supabase is not configured",
        timestamp: new Date().toISOString(),
      });
    }

    const supabase = createServerClient();

    // Simple query to test connectivity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("user_preferences") as any)
      .select("id")
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
