import { createClient } from "@trivo/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import type { syncPcoEmails } from "@/jobs/sync-pco-emails";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("PCO OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=${error}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=no_code`
      );
    }

    // Exchange the code for tokens
    const tokenResponse = await fetch(
      "https://api.planningcenteronline.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          client_id: process.env.NEXT_PUBLIC_PCO_CLIENT_ID,
          client_secret: process.env.PCO_SECRET,
          redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/pco-callback`,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("PCO token error:", tokenData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=token_error`
      );
    }

    // Get current user's PCO info
    const pcoUserResponse = await fetch(
      "https://api.planningcenteronline.com/people/v2/me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const pcoUserData = await pcoUserResponse.json();

    const pcoOrganizationResponse = await fetch(
      `https://api.planningcenteronline.com/people/v2/people/${pcoUserData.data.id}/organization`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const pcoOrganizationData = await pcoOrganizationResponse.json();

    if (
      pcoUserData.data.attributes.can_email_lists !== true ||
      pcoUserData.data.attributes.people_permissions !== "Manager"
    ) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding/permissions-error`
      );
    }

    // Store the connection in Supabase
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=auth_error`
      );
    }

    const { data: organization, error: upsertOrganizationError } =
      await supabase
        .from("organizations")
        .insert({
          name: pcoOrganizationData.data.attributes.name,
          created_by: user.id,
        })
        .select("id");

    if (upsertOrganizationError) {
      console.error("Supabase error:", upsertOrganizationError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=organization_db_error`
      );
    }

    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        organization_id: organization[0].id,
        first_name: pcoUserData.data.attributes.first_name,
        last_name: pcoUserData.data.attributes.last_name,
        avatar_url: pcoUserData.data.attributes.avatar,
      })
      .eq("id", user.id);

    if (updateUserError) {
      console.error("Supabase error:", updateUserError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=user_db_error`
      );
    }

    const { error: upsertError } = await supabase
      .from("pco_connections")
      .insert({
        connected_by: user.id,
        pco_user_id: pcoUserData.data.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        organization_id: organization[0].id,
        last_refreshed: new Date().toISOString(),
      })
      .select("id");

    if (upsertError) {
      console.error("Supabase error:", upsertError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=pco_connection_db_error`
      );
    }

    const createPcoListCategory = await fetch(
      `https://api.planningcenteronline.com/people/v2/list_categories`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            type: "ListCategory",
            attributes: {
              name: "Trivo (DO NOT DELETE)",
            },
          },
        }),
      }
    );

    // Check if the category was created successfully
    if (!createPcoListCategory.ok) {
      console.error("Failed to create PCO list category");
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=pco_category_error`
      );
    }

    const pcoListCategoryData = await createPcoListCategory.json();

    const { error: pcoListError } = await supabase
      .from("pco_list_categories")
      .insert({
        category_id: pcoListCategoryData.data.id,
        organization_id: organization[0].id,
        pco_organization_id: pcoOrganizationData.data.id,
      })
      .select("id");

    if (pcoListError) {
      console.error("Supabase error:", pcoListError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL}?error=pco_list_db_error`
      );
    }

    // First create webhook entries in Supabase
    const webhookEvents = [
      "people.v2.events.list.created",
      "people.v2.events.list.destroyed",
      "people.v2.events.list.updated",
      "people.v2.events.list_result.created",
      "people.v2.events.list_result.destroyed",
      "people.v2.events.email.created",
      "people.v2.events.email.destroyed",
      "people.v2.events.email.updated",
    ];

    for (const event of webhookEvents) {
      // First create the webhook in PCO
      const createWebhookResponse = await fetch(
        "https://api.planningcenteronline.com/webhooks/v2/subscriptions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              type: "Subscription",
              attributes: {
                name: event,
                url: `https://trivo.app/api/pco/webhook/${organization[0].id}`,
                active: true,
              },
            },
          }),
        }
      );

      if (!createWebhookResponse.ok) {
        console.error(`Failed to create PCO webhook for ${event}`);
        continue;
      }

      const webhookData = await createWebhookResponse.json();

      // Then create the webhook record in our database
      const { error: webhookError } = await supabase
        .from("pco_webhooks")
        .insert({
          organization_id: organization[0].id,
          name: event,
          webhook_id: webhookData.data.id,
          authenticity_secret: webhookData.data.attributes.authenticity_secret,
        })
        .select("id")
        .single();

      if (webhookError) {
        console.error(
          `Failed to create webhook record for ${event}:`,
          webhookError
        );
        // If Supabase webhook creation fails, delete the PCO record
        await fetch(
          `https://api.planningcenteronline.com/webhooks/v2/subscriptions/${webhookData.data.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
            },
          }
        );
        continue;
      }
    }

    // Trigger the syncPcoEmails task
    await tasks.trigger<typeof syncPcoEmails>("sync-pco-emails", {
      organization_id: organization[0].id,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/home?pco_connection_success=true`
    );
  } catch (error) {
    console.error("PCO callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?pco_connection_error=unknown`
    );
  }
}
