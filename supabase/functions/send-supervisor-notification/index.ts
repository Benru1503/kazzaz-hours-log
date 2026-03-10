import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "https://kazzaz-app.vercel.app";

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify the JWT
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { logId, studentName, siteName, description, durationMinutes, date } =
      await req.json();

    if (!logId || !siteName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find supervisor(s) for this site
    const { data: log } = await supabase
      .from("manual_logs")
      .select("site_id")
      .eq("id", logId)
      .single();

    if (!log?.site_id) {
      return new Response(
        JSON.stringify({ error: "Log has no site_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: supervisorLinks } = await supabase
      .from("site_supervisors")
      .select("supervisor_id, profiles!site_supervisors_supervisor_id_fkey(email, full_name)")
      .eq("site_id", log.site_id);

    if (!supervisorLinks || supervisorLinks.length === 0) {
      // No supervisors assigned — nothing to send
      return new Response(
        JSON.stringify({ message: "No supervisors found for site" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!resendApiKey) {
      console.warn("RESEND_API_KEY not set — skipping email");
      return new Response(
        JSON.stringify({ message: "Email skipped — no API key" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send email to each supervisor
    const results = [];
    for (const link of supervisorLinks) {
      const profile = (link as any).profiles;
      if (!profile?.email) continue;

      const emailHtml = `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #d97706;">שעות חדשות לאישור — קזז</h2>
          <p>שלום ${profile.full_name || "מפקח/ת"},</p>
          <p>הסטודנט/ית <strong>${studentName || "לא ידוע"}</strong> דיווח/ה על שעות חדשות באתר <strong>${siteName}</strong>.</p>
          <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">תאריך</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${date || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">משך (דקות)</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${durationMinutes || "—"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; background: #f9fafb; font-weight: bold;">תיאור</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">${description || "—"}</td>
            </tr>
          </table>
          <a href="${appUrl}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            כניסה לאישור שעות
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">הודעה זו נשלחה אוטומטית ממערכת קזז.</p>
        </div>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Kazzaz <noreply@kazzaz-app.vercel.app>",
          to: [profile.email],
          subject: `שעות חדשות לאישור — ${studentName} באתר ${siteName}`,
          html: emailHtml,
        }),
      });

      results.push({
        email: profile.email,
        status: res.status,
        ok: res.ok,
      });
    }

    return new Response(JSON.stringify({ sent: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-supervisor-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
