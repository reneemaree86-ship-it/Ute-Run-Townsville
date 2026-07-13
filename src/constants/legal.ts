// UteRun Townsville — Terms and Policies content.
export const LEGAL_EFFECTIVE_DATE = "June 2026";

export interface LegalSection {
  n?: string;
  heading: string;
  body?: string;
  bullets?: string[];
}

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    n: "1",
    heading: "Introduction",
    body:
      'Welcome to UteRun Townsville ("Platform"), operated by UteRun Townsville Pty Ltd ("we", "us", "our"). These Terms of Service and Policies govern your use of our platform connecting customers with drivers for pickups, deliveries, dump runs, and small moves.',
  },
  {
    n: "2",
    heading: "User Agreement",
    body:
      "By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.",
  },
  {
    n: "3",
    heading: "Services",
    body:
      "UteRun is a marketplace platform. We do not provide transportation services ourselves but connect Customers with independent Driver contractors.",
  },
  {
    n: "4",
    heading: "User Accounts and Registration",
    bullets: [
      "You must be at least 18 years old and provide accurate information.",
      "Drivers must pass background checks, hold valid licenses, and maintain insurance.",
      "Businesses must provide valid ABN and business details.",
    ],
  },
  {
    n: "5",
    heading: "Bookings, Payments & Fees",
    bullets: [
      "All bookings are subject to acceptance.",
      "Platform charges 15% commission on jobs.",
      "Payments processed via Stripe.",
      "Cancellations may incur fees.",
    ],
  },
  {
    n: "6",
    heading: "Driver Responsibilities",
    body: "Drivers are independent contractors responsible for:",
    bullets: [
      "Safe and timely service",
      "Vehicle maintenance and insurance",
      "Compliance with all laws",
      "Providing proof of delivery photos",
    ],
  },
  {
    n: "7",
    heading: "Customer Responsibilities",
    body: "Customers must:",
    bullets: [
      "Provide accurate job details and photos",
      "Ensure safe access for pickup/delivery",
      "Pay for services promptly",
      "Not misuse the platform",
    ],
  },
  {
    n: "8",
    heading: "Privacy Policy",
    body:
      "We collect and process personal data as described in our Privacy Policy. By using the Platform, you consent to such collection.",
  },
  {
    n: "9",
    heading: "Limitation of Liability",
    body:
      "To the fullest extent permitted by law, UteRun is not liable for acts or omissions of Drivers or Customers. Our liability is limited to the fees paid in the preceding 12 months.",
  },
  {
    n: "10",
    heading: "Termination",
    body: "We may suspend or terminate accounts for violations of these Terms.",
  },
  {
    n: "11",
    heading: "Governing Law",
    body: "These Terms are governed by the laws of Queensland, Australia.",
  },
  {
    heading: "Contact Us",
    body: "UteRun Townsville\nEmail: support@uterun.com.au\nPhone: 1300 UTE RUN",
  },
];
