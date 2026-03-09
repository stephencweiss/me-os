import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getLinkedGoogleAccounts,
  deleteLinkedGoogleAccount,
  updateLinkedGoogleAccountLabel,
} from "@/lib/db-supabase";

/**
 * GET /api/google/accounts
 *
 * List all linked Google Calendar accounts for the current user.
 * Returns account info without decrypted tokens (for security).
 */
export async function GET() {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const accounts = await getLinkedGoogleAccounts(userId);

    // Return accounts without sensitive token data
    const safeAccounts = accounts.map((account) => ({
      id: account.id,
      googleEmail: account.google_email,
      displayName: account.display_name,
      accountLabel: account.account_label,
      // Show token status without exposing actual tokens
      hasRefreshToken: !!account.refresh_token,
      tokenExpiry: account.token_expiry,
      scopes: account.scopes,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    }));

    return NextResponse.json({
      accounts: safeAccounts,
      count: safeAccounts.length,
    });
  } catch (error) {
    console.error("Error fetching linked accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch linked accounts" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/google/accounts
 *
 * Update a linked Google account (e.g., change label).
 *
 * Body:
 *   - accountId: string - Account ID to update
 *   - label: string - New account label
 */
export async function PATCH(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { accountId, label } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    if (!label || typeof label !== "string") {
      return NextResponse.json(
        { error: "label is required and must be a string" },
        { status: 400 }
      );
    }

    await updateLinkedGoogleAccountLabel(userId, accountId, label);

    return NextResponse.json({
      success: true,
      message: `Account label updated to "${label}"`,
    });
  } catch (error) {
    console.error("Error updating linked account:", error);
    return NextResponse.json(
      { error: "Failed to update linked account" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/google/accounts
 *
 * Unlink a Google Calendar account.
 *
 * Body:
 *   - accountId: string - Account ID to delete
 */
export async function DELETE(request: NextRequest) {
  // Require authentication
  const authResult = await requireAuth();
  if (!authResult.authorized) {
    return authResult.response;
  }
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId is required" },
        { status: 400 }
      );
    }

    await deleteLinkedGoogleAccount(userId, accountId);

    return NextResponse.json({
      success: true,
      message: "Account unlinked successfully",
    });
  } catch (error) {
    console.error("Error unlinking account:", error);
    return NextResponse.json(
      { error: "Failed to unlink account" },
      { status: 500 }
    );
  }
}
