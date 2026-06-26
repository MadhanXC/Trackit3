import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { Resend } from 'resend';

/**
 * @fileOverview Official Inbound Email Webhook Handler
 * 
 * 1. Verifies the webhook signature using Resend/Svix official method.
 * 2. Fetches the full email body (text/html) using the Received Email API.
 * 3. Maps the sender to a workspace user and generates a "to-do entry".
 */

const resend = new Resend(process.env.RESEND_API_KEY || "re_1KiAbyLN_2t5q2DTkAUqhDbPD5Aj6yrNb");
const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || "whsec_YuWNpFjh0fSYOIHTLzmus65vp7YiZmb6";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.text();
    
    // Official Svix/Resend Headers
    const id = req.headers.get('svix-id');
    const timestamp = req.headers.get('svix-timestamp');
    const signature = req.headers.get('svix-signature');

    if (!id || !timestamp || !signature) {
      console.error('[Inbound Email] Missing verification headers');
      return NextResponse.json({ error: 'Unauthorized', message: 'Missing Svix headers' }, { status: 401 });
    }

    // Verify the Webhook Signature
    let event: any;
    try {
      event = resend.webhooks.verify({
        payload,
        headers: {
          'svix-id': id,
          'svix-timestamp': timestamp,
          'svix-signature': signature,
        },
        webhookSecret: webhookSecret,
      });
    } catch (err: any) {
      console.error('[Inbound Email] Signature verification failed:', err.message);
      return NextResponse.json({ error: 'Unauthorized', message: 'Invalid signature' }, { status: 401 });
    }

    const { data: emailMetadata } = event;
    const emailId = emailMetadata.email_id;
    const fromRaw = emailMetadata.from || '';

    // Extract clean email from "Name <email@example.com>"
    const extractEmail = (str: string) => {
      const match = str.match(/<(.+?)>/) || str.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
      return match ? (match[1] || match[0]) : str;
    };

    const fromEmail = extractEmail(fromRaw).toLowerCase().trim();
    if (!fromEmail) {
      return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
    }

    console.log(`[Inbound Email] Processing email_id: ${emailId} from ${fromEmail}`);

    // FETCH THE FULL EMAIL BODY (Since it's not in the webhook payload)
    const fullEmailResponse = await resend.emails.get(emailId);
    
    if (fullEmailResponse.error) {
      console.error('[Inbound Email] Failed to fetch email content:', fullEmailResponse.error);
      return NextResponse.json({ error: 'Retrieval Failed', details: fullEmailResponse.error }, { status: 500 });
    }

    const emailContent = fullEmailResponse.data;
    const body = emailContent?.text || emailContent?.html || 'No content provided.';
    const subject = emailContent?.subject || 'Inbound Task';

    const { firestore } = initializeFirebase();
    
    // Identify user profile associated with the sender
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('email', '==', fromEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`[Inbound Email] Sender email not recognized: ${fromEmail}`);
      return NextResponse.json({ error: 'Sender not found in workspace' }, { status: 200 });
    }

    const userDoc = querySnapshot.docs[0];
    const userId = userDoc.id;

    const workItemsRef = collection(firestore, 'workItems');
    const workItemRef = doc(workItemsRef);
    const now = new Date().toISOString();

    const newWorkItem = {
      id: workItemRef.id,
      userId: userId,
      title: subject,
      description: body,
      siteAddressStreet: "Email Ingestion Location",
      workItemType: "Job",
      priority: "Medium",
      overallWorkStatus: "Pending",
      confirmationStatus: "Pending",
      source: "to-do entry",
      createdAt: now,
      updatedAt: now,
      permitRequired: false,
      surveyRequired: false,
      materialsRequired: false,
      shipmentRequired: false
    };

    await setDoc(workItemRef, newWorkItem);
    console.log(`[Inbound Email] Successfully logged task ${workItemRef.id} for user ${userId}`);

    return NextResponse.json({ 
      success: true, 
      id: workItemRef.id, 
      message: 'Task ingested with full content retrieval.' 
    });

  } catch (error: any) {
    console.error('[Inbound Email] Fatal Ingestion Error:', error);
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}
