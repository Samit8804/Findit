'use client';

import React, { useState } from 'react';
import { Mail, Clock, MessageCircle, Send, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SupportHero } from '@/components/pages/StaticShell';
import { Input } from '@/components/ui/Form';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: 'General Question', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.name.trim().length < 3) errs.name = 'Please enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email address.';
    if (form.message.trim().length < 20) errs.message = 'Message must be at least 20 characters.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />
      <SupportHero
        title="Contact Support"
        subtitle="Can't find an answer? Our team typically responds within a few hours."
      />

      <main className="flex-grow py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 order-2 md:order-1">
            {sent ? (
              <div className="text-center py-10" role="status">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-lg font-bold">Message sent!</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  Thanks for reaching out, {form.name.split(' ')[0]}. We&apos;ve received your message and will reply to{' '}
                  <strong className="text-[#0F172A]">{form.email}</strong> shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate className="space-y-5" aria-label="Contact form">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Input label="Your Name" name="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} error={errors.name} placeholder="Full name" />
                  <Input label="Email" name="c-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} error={errors.email} placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="c-subject" className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
                  <select
                    id="c-subject"
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                  >
                    {['General Question', 'Problem with my Ad', 'Payment / Refund', 'Report a User', 'Business Directory', 'Other'].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="c-message" className="block text-sm font-semibold text-slate-700 mb-1.5">Message</label>
                  <textarea
                    id="c-message"
                    rows={6}
                    maxLength={1000}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    aria-invalid={!!errors.message}
                    aria-describedby="c-msg-count"
                    placeholder="Describe your issue in detail — include ad IDs or order numbers if relevant."
                    className={`w-full px-4 py-3 border rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent resize-y ${
                      errors.message ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  <p id="c-msg-count" className="text-xs text-slate-400 mt-1">{form.message.length}/1000</p>
                  {errors.message && <p role="alert" className="text-xs text-red-600 font-medium -mt-1">{errors.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-[#E53935] hover:bg-[#D32F2F] disabled:opacity-70 text-white text-sm font-bold transition-colors shadow-lg shadow-red-200"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Info sidebar */}
          <aside className="space-y-4 order-1 md:order-2">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <span className="w-10 h-10 rounded-xl bg-red-50 text-[#E53935] flex items-center justify-center mb-3">
                <Mail className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold">Email Us</p>
              <a href="mailto:support@findit.example" className="text-xs text-[#E53935] font-semibold hover:underline mt-1 block">
                support@findit.example
              </a>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold">Response Time</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Typical first reply within 2–4 hours. Complex payment cases within 24 hours.</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                <MessageCircle className="w-5 h-5" />
              </span>
              <p className="text-sm font-bold">Live Chat</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">Available inside Messages for logged-in users, 24/7.</p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}