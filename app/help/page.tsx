"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/app-layout";

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const faqs = [
    {
      question: "How do I create a new bid?",
      answer: "Navigate to the Bids section from the sidebar, then click the 'New Bid' button. Fill in the required information including tender details, bid amount, and submission deadline.",
    },
    {
      question: "What is Format 1 Analysis?",
      answer: "Format 1 Analysis is a feature that helps you analyze tender documents in a standardized format. It extracts key information and helps you prepare your bid more efficiently.",
    },
    {
      question: "How do I track my bid status?",
      answer: "You can track your bid status in the 'My Tasks' section. Each bid will show its current status (Draft, Submitted, Under Review, etc.) along with important dates and deadlines.",
    },
    {
      question: "Can I export reports?",
      answer: "Yes, you can export reports in various formats including PDF and Excel. Go to the Reports section and select the data you want to export, then choose your preferred format.",
    },
    {
      question: "How do I manage vendor queries?",
      answer: "Navigate to the Vendor Queries section to view and respond to queries from vendors. You can filter queries by status, date, or vendor name to find specific queries quickly.",
    },
    {
      question: "What payment methods are accepted?",
      answer: "We accept various payment methods including credit/debit cards, UPI, net banking, and bank transfers. You can manage your billing and payment methods in the Billing section.",
    },
    {
      question: "How do I change my password?",
      answer: "Go to Settings > Security section. Enter your current password and your new password, then confirm it. Click 'Update Password' to save the changes.",
    },
    {
      question: "Can I customize my dashboard?",
      answer: "Currently, the dashboard shows default widgets. Customization options will be available in a future update. You can provide feedback through the Help section.",
    },
  ];

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Help & Support</h1>
          <p className="mt-1 text-slate-500">Find answers to common questions and get support</p>
        </header>

        {/* Search */}
        <section className="mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pl-10 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </section>

        {/* Quick Links */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a href="/dashboard" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Dashboard</div>
                <div className="text-xs text-slate-500">View your overview</div>
              </div>
            </a>
            <a href="/billing" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Billing</div>
                <div className="text-xs text-slate-500">Manage payments</div>
              </div>
            </a>
            <a href="/settings" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Settings</div>
                <div className="text-xs text-slate-500">Configure preferences</div>
              </div>
            </a>
            <a href="/reports" className="flex items-center gap-3 rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <svg className="h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Reports</div>
                <div className="text-xs text-slate-500">View analytics</div>
              </div>
            </a>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {filteredFaqs.length === 0 ? (
              <div className="py-8 text-center text-slate-500">
                No results found. Try a different search term.
              </div>
            ) : (
              filteredFaqs.map((faq, index) => (
                <details key={index} className="group">
                  <summary className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
                    <span className="text-sm font-medium text-slate-900">{faq.question}</span>
                    <svg
                      className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-2 px-4 pb-4 text-sm text-slate-600">{faq.answer}</div>
                </details>
              ))
            )}
          </div>
        </section>

        {/* Contact Support */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Contact Support</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Email Support</div>
                <div className="text-xs text-slate-500">support@bidmitra.ai</div>
                <div className="text-xs text-slate-500">We typically respond within 24 hours</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Phone Support</div>
                <div className="text-xs text-slate-500">+91 1800-XXX-XXXX</div>
                <div className="text-xs text-slate-500">Monday - Friday, 9 AM - 6 PM IST</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">Live Chat</div>
                <div className="text-xs text-slate-500">Available in the bottom right corner</div>
                <div className="text-xs text-slate-500">Average response time: 2 minutes</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

