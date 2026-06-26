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

/**
 * @fileOverview Inbound Email Webhook Handler
 * 
 * Receives POST requests from Resend Inbound.
 * Uses EMAIL_WEBHOOK_SECRET environment variable for authentication.
 */

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-webhook-secret');
    const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET;
    
    if (!secret || secret !== expectedSecret) {
      console.error('Unauthorized inbound email attempt.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    
    const fromEmailRaw = payload.from?.email || payload.from || '';
    const fromEmail = typeof fromEmailRaw === 'string' ? fromEmailRaw : fromEmailRaw.email || '';
    
    const subject = payload.subject || 'No Subject';
    const body = payload.text || payload.html || 'No content provided.';

    if (!fromEmail) {
      return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();
    
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('email', '==', fromEmail.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn(`Inbound email from unrecognized sender: ${fromEmail}`);
      return NextResponse.json({ error: 'Sender email not recognized' }, { status: 200 });
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
      siteAddressStreet: "Inbound Email Submission",
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

    return NextResponse.json({ 
      success: true, 
      id: workItemRef.id, 
      message: 'Email converted to to-do entry.' 
    });

  } catch (error: any) {
    console.error('Inbound Email Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
