import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { initializeFirebase } from "@/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
} from "firebase/firestore";

const resend = new Resend(process.env.RESEND_API_KEY!);

const webhookSecret = process.env.RESEND_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
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

    let event;

    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          id,
          timestamp,
          signature,
        },
        webhookSecret,
      });
    } catch (e: any) {
      console.error("Verification failed:", e);

      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Invalid signature",
        },
        { status: 401 }
      );
    }

    const body = JSON.parse(payload);

    console.log("Verified event:", body.type);

    const email = body.data;

    const emailId = email.email_id;
    const fromRaw = email.from ?? "";

    const extractEmail = (value: string) => {
      const match =
        value.match(/<(.+?)>/) ??
        value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);

      return match ? match[1] ?? match[0] : value;
    };

    const fromEmail = extractEmail(fromRaw).toLowerCase().trim();

    const { firestore } = initializeFirebase();

    const q = query(
      collection(firestore, "users"),
      where("email", "==", fromEmail)
    );

    const users = await getDocs(q);

    if (users.empty) {
      console.log("Unknown sender:", fromEmail);

      return NextResponse.json({
        success: true,
        message: "Sender not registered",
      });
    }

    const userId = users.docs[0].id;

    // NOTE:
    // Replace this with the proper Received Email API once verification works.
    // For now just use webhook metadata.

    const subject = email.subject ?? "Inbound Task";

    const description =
      "Email received successfully. Fetch full body using the Received Email API.";

    const workItemRef = doc(collection(firestore, "workItems"));

    const now = new Date().toISOString();

    await setDoc(workItemRef, {
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

    return NextResponse.json({
      success: true,
      id: workItemRef.id,
    });
  } catch (err: any) {
    console.error(err);

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