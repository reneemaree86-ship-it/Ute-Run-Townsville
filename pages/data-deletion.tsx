import React, { useState } from 'react';
import Head from 'next/head';

interface FormData {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
  reason: string;
}

interface FormStatus {
  loading: boolean;
  error: string | null;
  success: boolean;
}

export default function DataDeletionPage() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    phone: '',
    preferredContact: 'email',
    reason: '',
  });

  const [status, setStatus] = useState<FormStatus>({
    loading: false,
    error: null,
    success: false,
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus({ loading: true, error: null, success: false });

    // Validate form
    if (!formData.email && !formData.phone) {
      setStatus({
        loading: false,
        error: 'Please provide either an email address or phone number',
        success: false,
      });
      return;
    }

    try {
      // Send to backend API
      const response = await fetch('/api/data-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit data deletion request');
      }

      setStatus({
        loading: false,
        error: null,
        success: true,
      });

      // Reset form
      setFormData({
        email: '',
        phone: '',
        preferredContact: 'email',
        reason: '',
      });

      // Scroll to success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error instanceof Error
            ? error.message
            : 'An error occurred. Please try again or email uteruntownsville@gmail.com',
        success: false,
      });
    }
  };

  return (
    <>
      <Head>
        <title>Data Deletion Request - Ute Run Townsville</title>
        <meta
          name="description"
          content="Request to delete your Ute Run Townsville account and personal data"
        />
      </Head>

      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Data Deletion Request
          </h1>
          <p className="text-gray-600 mb-6">
            Submit a request to delete your Ute Run Townsville account and
            associated personal data.
          </p>

          {status.success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800">
                ✓ Your data deletion request has been received. We will process
                it as soon as reasonably possible and send a confirmation to
                your provided contact information.
              </p>
            </div>
          )}

          {status.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{status.error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address (optional)
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (optional)
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+61 7 XXXX XXXX"
              />
              <p className="text-xs text-gray-500 mt-1">
                Please provide at least one contact method
              </p>
            </div>

            <div>
              <label htmlFor="preferredContact" className="block text-sm font-medium text-gray-700 mb-1">
                Preferred Contact Method
              </label>
              <select
                id="preferredContact"
                name="preferredContact"
                value={formData.preferredContact}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Deletion (optional)
              </label>
              <textarea
                id="reason"
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Please tell us why you'd like to delete your account..."
              />
            </div>

            <button
              type="submit"
              disabled={status.loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
            >
              {status.loading ? 'Submitting...' : 'Submit Data Deletion Request'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Alternative Methods
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              You can also submit a data deletion request by emailing:
            </p>
            <a
              href="mailto:uteruntownsville@gmail.com?subject=Data%20Deletion%20Request"
              className="text-blue-600 hover:underline font-medium"
            >
              uteruntownsville@gmail.com
            </a>
            <p className="text-gray-600 text-sm mt-3">
              Please include the email address or phone number used in the app
              so we can locate your account.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Processing Information
            </h2>
            <p className="text-gray-600 text-sm">
              Data deletion requests are reviewed and actioned as soon as
              reasonably possible. You will receive a confirmation once your
              request has been processed.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
