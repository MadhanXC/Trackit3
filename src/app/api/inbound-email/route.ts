import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { firestore } from "@/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY!);
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // Read raw payload (required for signature verification)
    const payload = await req.text();

    const id = req.headers.get("svix-id");
    const timestamp = req.headers.get("svix-timestamp");
    const signature = req.headers.get("svix-signature");

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

    // Parse verified payload
    const event = JSON.parse(payload);
    const emailMetadata = event.data;

    const emailId = emailMetadata.email_id;
    const fromRaw = emailMetadata.from ?? "";

    // Extract sender email
    const extractEmail = (value: string) => {
      const match =
        value.match(/<(.+?)>/) ??
        value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

      return match ? (match[1] ?? match[0]) : value;
    };

    const fromEmail = extractEmail(fromRaw).toLowerCase().trim();

    console.log("Sender:", fromEmail);

    // Find the user
    const usersSnapshot = await firestore
      .collection("users")
      .where("email", "==", fromEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log("User not found:", fromEmail);

      return NextResponse.json({
        success: true,
        message: "Sender not registered",
      });
    }

    const userId = usersSnapshot.docs[0].id;

    console.log("Matched user:", userId);

    //
    // Fetch full email
    //
    let subject = emailMetadata.subject || "New Email";
    let emailBody = "No content provided.";

    try {
      const fullEmailResponse = await resend.emails.get(emailId);
      console.log("========== FULL EMAIL RESPONSE ==========");
console.log(JSON.stringify(fullEmailResponse, null, 2));
console.log("=========================================");

      if (!fullEmailResponse.error && fullEmailResponse.data) {
        const emailContent = fullEmailResponse.data;

        subject = emailContent.subject || subject;

        emailBody =
          emailContent.text ||
          emailContent.html ||
          emailBody;
      } else {
        console.warn("Unable to fetch email body.");
      }
    } catch (err) {
      console.warn("Failed to fetch full email:", err);
    }

    //
    // Create Todo
    //
    const todoRef = firestore
      .collection("users")
      .doc(userId)
      .collection("todos")
      .doc();

    await todoRef.set({
      id: todoRef.id,
      title: subject,
      description: emailBody,
      completed: false,
      createdAt: new Date().toISOString(),
      source: "to-do entry",
    });

    console.log("Todo created:", todoRef.id);

    return NextResponse.json({
      success: true,
      todoId: todoRef.id,
      message: "Todo created successfully.",
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