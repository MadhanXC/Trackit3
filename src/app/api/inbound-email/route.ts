import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { firestore } from "@/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY!);
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // Read raw payload for signature verification
    const payload = await req.text();

    const id = req.headers.get("svix-id");
    const timestamp = req.headers.get("svix-timestamp");
    const signature = req.headers.get("svix-signature");

    console.log("Webhook headers:", {
      id,
      timestamp,
      signature,
      webhookSecretPrefix: webhookSecret?.slice(0, 10),
    });

    if (!id || !timestamp || !signature) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Missing Svix headers",
        },
        { status: 401 }
      );
    }

    // Verify webhook signature
    try {
      resend.webhooks.verify({
        payload,
        headers: {
          id,
          timestamp,
          signature,
        },
        webhookSecret,
      });
    } catch (err) {
      console.error("Webhook verification failed:", err);

      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid signature",
        },
        { status: 401 }
      );
    }

    const body = JSON.parse(payload);
    const email = body.data;

    const fromRaw = email.from ?? "";
    const subject = email.subject ?? "Inbound Task";

    const extractEmail = (value: string) => {
      const match =
        value.match(/<(.+?)>/) ??
        value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

      return match ? (match[1] ?? match[0]) : value;
    };

    const fromEmail = extractEmail(fromRaw).toLowerCase().trim();

    console.log("Sender:", fromEmail);

    // Find the user by email
    const usersSnapshot = await firestore
      .collection("users")
      .where("email", "==", fromEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log("Unknown sender:", fromEmail);

      return NextResponse.json({
        success: true,
        message: "Sender not registered",
      });
    }

    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;

    // OPTIONAL:
    // Later you can fetch the full email body using email.email_id
    // For now we'll use a placeholder.
    const description =
      "Email received successfully. Fetch full body using Resend Received Email API.";

    const workItemRef = firestore.collection("workItems").doc();

    const now = new Date().toISOString();

    await workItemRef.set({
      id: workItemRef.id,
      userId,
      title: subject,
      description,
      source: "to-do entry",
      workItemType: "Job",
      priority: "Medium",
      overallWorkStatus: "Pending",
      confirmationStatus: "Pending",
      siteAddressStreet: "Email",
      createdAt: now,
      updatedAt: now,
      permitRequired: false,
      surveyRequired: false,
      materialsRequired: false,
      shipmentRequired: false,
    });

    console.log("Created work item:", workItemRef.id);

    return NextResponse.json({
      success: true,
      id: workItemRef.id,
    });
  } catch (err: any) {
    console.error("Inbound Email Error:", err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}