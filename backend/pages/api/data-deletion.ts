import type { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from 'nodemailer';

interface DataDeletionRequest {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
  reason: string;
}

interface ResponseData {
  success?: boolean;
  message?: string;
  error?: string;
}

// Configure your email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, phone, preferredContact, reason }: DataDeletionRequest =
      req.body;

    // Validation
    if (!email && !phone) {
      return res.status(400).json({
        error: 'Please provide either an email address or phone number',
      });
    }

    // Create email content
    const emailContent = `
Data Deletion Request Received

Contact Information:
${email ? `Email: ${email}` : ''}
${phone ? `Phone: ${phone}` : ''}
Preferred Contact Method: ${preferredContact}

${reason ? `Reason: ${reason}` : 'No reason provided'}

Timestamp: ${new Date().toISOString()}

---
This is an automated data deletion request submission.
`;

    // Send email to support
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: 'uteruntownsville@gmail.com',
      subject: 'Data Deletion Request Submission',
      text: emailContent,
      html: `
        <h2>Data Deletion Request Received</h2>
        <p><strong>Contact Information:</strong></p>
        <ul>
          ${email ? `<li>Email: ${email}</li>` : ''}
          ${phone ? `<li>Phone: ${phone}</li>` : ''}
          <li>Preferred Contact Method: ${preferredContact}</li>
        </ul>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p><small>Timestamp: ${new Date().toISOString()}</small></p>
      `,
    });

    // Optional: Send confirmation email to user
    if (email) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Data Deletion Request Received - Ute Run Townsville',
        text: `
Thank you for submitting your data deletion request.

We have received your request and will process it as soon as reasonably possible.
You will receive a confirmation email once your account and associated data have been deleted.

If you have any questions, please reply to this email or contact us at uteruntownsville@gmail.com

Best regards,
Ute Run Townsville Team
        `,
        html: `
          <p>Thank you for submitting your data deletion request.</p>
          <p>We have received your request and will process it as soon as reasonably possible.</p>
          <p>You will receive a confirmation email once your account and associated data have been deleted.</p>
          <p>If you have any questions, please reply to this email or contact us at <a href="mailto:uteruntownsville@gmail.com">uteruntownsville@gmail.com</a></p>
          <p>Best regards,<br/>Ute Run Townsville Team</p>
        `,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Data deletion request received successfully',
    });
  } catch (error) {
    console.error('Error processing data deletion request:', error);
    res.status(500).json({
      error: 'Failed to process data deletion request. Please try again later.',
    });
  }
}
