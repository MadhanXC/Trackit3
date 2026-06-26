import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { firestore } from "@/firebase-admin";

const resend = new Resend(process.env.RESEND_API_KEY!);
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    // Read raw body for signature verification
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

    // Verify webhook
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
    const email = event.data;

    const extractEmail = (value: string) => {
      const match =
        value.match(/<(.+?)>/) ??
        value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

      return match ? (match[1] ?? match[0]) : value;
    };

    const fromEmail = extractEmail(email.from ?? "")
      .toLowerCase()
      .trim();

    const subject = email.subject || "New Email";

    console.log("Looking up user:", fromEmail);

    // Find the user document
    const usersSnapshot = await firestore
      .collection("users")
      .where("email", "==", fromEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log("No user found for:", fromEmail);

      return NextResponse.json({
        success: true,
        message: "Sender not registered",
      });
    }

    const userId = usersSnapshot.docs[0].id;

    console.log("Matched user:", userId);

    // Create todo
    const todoRef = firestore
      .collection("users")
      .doc(userId)
      .collection("todos")
      .doc();

    await todoRef.set({
      id: todoRef.id,
      title: subject,
      completed: false,
      createdAt: new Date().toISOString(),
      source: "to-do entry",
    });

    console.log("Todo created:", todoRef.id);

    return NextResponse.json({
      success: true,
      todoId: todoRef.id,
    });
  } catch (err: any) {
    console.error("Inbound email error:", err);

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