'use client';

import React, { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { Button } from '@/components/ui/Button';
import { LocationSelector, LocationValue } from '@/components/location/LocationSelector';
import { StepCategory } from '@/components/post-ad/wizard/StepCategory';
import { StepDetails } from '@/components/post-ad/wizard/StepDetails';
import { StepImages } from '@/components/post-ad/wizard/StepImages';
import { StepPreview } from '@/components/post-ad/wizard/StepPreview';
import { StepPromotion } from '@/components/post-ad/wizard/StepPromotion';
import {
  INITIAL_WIZARD,
  WizardData,
} from '@/components/post-ad/wizard/wizardData';
import { getCurrentSession } from '@/lib/session';
import { addAd } from '@/lib/adStore';
import { saveAd, getCategoryTree, getLocationTree, LocationNode } from '@/services/ads';
import { isSupabaseConfigured, getSupabaseBrowser } from '@/lib/supabase/client';
import { Check, ChevronLeft, ChevronRight, Send, ShieldCheck, Tag, ImageIcon, MapPin, Eye, Rocket } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Category', icon: Tag },
  { id: 2, label: 'Details', icon: Tag },
  { id: 3, label: 'Images', icon: ImageIcon },
  { id: 4, label: 'Location', icon: MapPin },
  { id: 5, label: 'Preview', icon: Eye },
  { id: 6, label: 'Promotion', icon: Rocket },
];

function WizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editAdId = searchParams.get('edit');

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL_WIZARD);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [contactEmail, setContactEmail] = useState(getCurrentSession().user.email);

  const patch = (p: Partial<WizardData>) => setData((d) => ({ ...d, ...p }));

  /** Walk the location tree to find the DB uuid for the chosen city/locality. */
  const resolveLocationId = (
    tree: LocationNode[],
    loc: { countryIso: string; stateIso: string; city: string },
    localityParts: (string | undefined)[]
  ): LocationNode | null => {
    let node: LocationNode | undefined =
      tree.find((c) => c.id === loc.countryIso || c.slug === loc.countryIso) ??
      tree.find((c) => c.name.toLowerCase() === loc.city.toLowerCase());
    if (!node?.children.length) return null;
    const state = node.children.find((s) => s.id === loc.stateIso || s.slug === loc.stateIso);
    if (!state) return null;
    const city = state.children.find(
      (ct) => ct.name.toLowerCase() === loc.city.toLowerCase()
    );
    if (!city) return state;
    const localityName = localityParts.filter(Boolean)[0]?.toLowerCase();
    const locality = city.children.find((l) => l.name.toLowerCase() === localityName);
    return locality ?? city;
  };

  const validateStep = (s: number): string => {
    switch (s) {
      case 1:
        return data.category ? '' : 'Please select a category to continue.';
      case 2:
        if (data.title.trim().length < 5) return 'Title must be at least 5 characters.';
        if (!data.price || Number(data.price) <= 0) return 'Please enter a valid price.';
        if (data.description.trim().length < 20) return 'Description must be at least 20 characters.';
        return '';
      case 3:
        return data.images.length > 0 ? '' : 'Add at least one photo of your item.';
      case 4:
        if (!data.location.countryIso) return 'Please choose a country.';
        if (!data.location.city) return 'Please choose a city.';
        return '';
      default:
        return '';
    }
  };

  const next = () => {
    const err = validateStep(step);
    setError(err);
    if (!err) setStep((s) => Math.min(s + 1, 6));
  };

  const back = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  const publish = async (submitForReview: boolean) => {
    const err = validateStep(step >= 4 ? 4 : step);
    if (submitForReview) {
      const v = validateStep(2) || validateStep(3) || validateStep(4);
      setError(v);
      if (v) return;
    }
    setPublishing(true);

    try {
      /* ---- Real backend path ---- */
      const [categoryTree, locationTree] = await Promise.all([getCategoryTree(), getLocationTree()]);
      const cat = categoryTree.find((c) => c.name === data.category || c.slug === data.category.toLowerCase().replace(/[^a-z]+/g, '-'));
      const sub = cat?.children.find((s) => s.name === data.extra.subcategoryName);
      const loc = resolveLocationId(locationTree, data.location, [data.locality, data.address]);

      const adId = await saveAd(
        {
          title: data.title.trim(),
          description: data.description.trim(),
          price: Number(data.price),
          condition: data.condition,
          categoryId: cat?.id ?? null,
          subcategoryId: sub?.id ?? null,
          locationId: loc?.id ?? null,
          locationLabel: [data.locality, data.location.city].filter(Boolean).join(', '),
          attributes: Object.fromEntries(Object.entries(data.extra).filter(([, v]) => v)),
          contactShowPhone: data.contactPrefs.showPhone,
          contactShowWhatsapp: data.contactPrefs.allowWhatsApp,
          contactAllowMessages: true,
          images: data.images.map((i) => ({ src: i.src, name: i.name })),
          submitForReview,
        },
        editAdId ?? undefined
      );

      // In-app notification for submission
      if (submitForReview && isSupabaseConfigured) {
        const sbc = getSupabaseBrowser();
        const { data: auth } = (await sbc!.auth.getUser()) as any;
        if (auth?.user?.id) {
          await sbc!.from('notifications').insert({
            user_id: auth.user.id,
            type: 'pending',
            title: 'Your advertisement is awaiting review.',
            body: data.title.trim(),
          });
        }
      }

      setPublishing(false);
      router.push(submitForReview ? '/dashboard/my-ads?status=submitted' : '/dashboard/my-ads?status=draft');
      void adId;
    } catch (e: any) {
      /* ---- Fallback: mock/localStorage so demo keeps working ---- */
      if (e.message === 'BACKEND_NOT_CONFIGURED') {
        const user = getCurrentSession().user;
        addAd({
          userId: user.id,
          title: data.title.trim(),
          description: data.description.trim(),
          price: Number(data.price),
          currency: '₹',
          condition: data.condition,
          images: data.images.map((i) => i.src),
          contactEmail,
          addressText: [data.locality, data.address].filter(Boolean).join(', '),
          countryIso: data.location.countryIso,
          stateIso: data.location.stateIso,
          city: data.location.city,
          postalCode: '',
          categorySlug: data.category.toLowerCase().replace(/[^a-z]+/g, '-'),
          categoryName: data.category,
          subcategorySlug: '',
          subcategoryName: data.category,
          status: submitForReview ? 'Pending Review' : 'Active',
        });
        setPublishing(false);
        router.push('/dashboard/my-ads?status=success');
        return;
      }
      if (e.message === 'NOT_AUTHENTICATED') {
        setPublishing(false);
        setError('Please log in to publish an advertisement.');
        return;
      }
      setPublishing(false);
      setError(e.message || 'Unable to save your advertisement. Please try again.');
    }
  };

  const stepError = useMemo(() => error, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      <Header />

      <main className="flex-grow py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: 'Post an Ad' }]} />

          <div className="mb-8 mt-2">
            <h1 className="text-3xl font-black tracking-tight">Post an Ad</h1>
            <p className="text-sm text-slate-500 mt-1">Create a free listing in minutes.</p>
          </div>

          {/* Step indicator */}
          <ol className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6 flex items-center justify-between overflow-x-auto">
            {STEPS.map((s, idx) => (
              <React.Fragment key={s.id}>
                <li className="flex items-center gap-2 shrink-0">
                  <span
                    aria-current={step === s.id ? 'step' : undefined}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${
                      step === s.id
                        ? 'bg-[#E53935] text-white'
                        : step > s.id
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {step > s.id ? <Check className="w-4 h-4" /> : s.id}
                  </span>
                  <span
                    className={`text-xs font-semibold hidden sm:block ${
                      step === s.id ? 'text-[#0F172A]' : step > s.id ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 rounded ${step > s.id ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                )}
              </React.Fragment>
            ))}
          </ol>

          {/* Step body */}
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm mb-6 min-h-[380px]">
            {step === 1 && (
              <StepCategory value={data.category} onChange={(category) => patch({ category })} />
            )}

            {step === 2 && (
              <StepDetails
                category={data.category}
                title={data.title}
                description={data.description}
                price={data.price}
                condition={data.condition}
                extra={data.extra}
                onChange={(p) => patch(p)}
                onExtraChange={(key, value) => setData((d) => ({ ...d, extra: { ...d.extra, [key]: value } }))}
              />
            )}

            {step === 3 && <StepImages images={data.images} onChange={(images) => patch({ images })} />}

            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-[#0F172A] mb-1">Where is your ad located?</h3>
                  <p className="text-xs text-slate-400 mb-5">Each dropdown filters based on your previous choice.</p>
                </div>
                <LocationSelector
                  value={data.location}
                  onChange={(location: LocationValue) => patch({ location })}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="locality" className="block text-sm font-semibold text-slate-700 mb-1.5">Locality</label>
                    <input
                      id="locality"
                      type="text"
                      value={data.locality}
                      onChange={(e) => patch({ locality: e.target.value })}
                      placeholder="e.g., Sector 150"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
                    <input
                      id="address"
                      type="text"
                      value={data.address}
                      onChange={(e) => patch({ address: e.target.value })}
                      placeholder="Street / building details"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
                    />
                  </div>
                </div>
                <fieldset>
                  <legend className="block text-sm font-semibold text-slate-700 mb-3 pt-2 border-t border-slate-100 w-full">Contact preferences</legend>
                  <div className="space-y-2">
                    {(
                      [
                        ['showPhone', 'Show phone number on my ad'],
                        ['showEmail', 'Allow buyers to email me'],
                        ['allowWhatsApp', 'Enable WhatsApp contact button'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={data.contactPrefs[key]}
                          onChange={(e) => patch({ contactPrefs: { ...data.contactPrefs, [key]: e.target.checked } })}
                          className="w-4 h-4 accent-[#E53935]"
                        />
                        <span className="text-xs text-slate-600">{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 5 && <StepPreview data={data} />}

            {step === 6 && <StepPromotion value={data.promotion} onChange={(promotion) => patch({ promotion })} />}
          </div>

          {/* Errors */}
          {stepError && (
            <div role="alert" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-[#D32F2F]">
              {stepError}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between pb-8">
            {step > 1 ? (
              <button
                onClick={back}
                className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <span />
            )}

            {step < 6 ? (
              <>
                <button
                  onClick={() => publish(false)}
                  disabled={publishing}
                  className="px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 text-sm font-bold text-slate-600 transition-colors disabled:opacity-50"
                >
                  {publishing ? 'Saving...' : 'Save Draft'}
                </button>
                <Button variant="primary" size="lg" onClick={next} className="gap-2 shadow-md">
                  Continue <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={() => publish(false)}
                  disabled={publishing}
                  className="px-6 py-3 rounded-xl border border-slate-200 hover:border-slate-300 text-sm font-bold text-slate-600 transition-colors disabled:opacity-50"
                >
                  Save as Draft
                </button>
                <Button variant="primary" size="lg" onClick={() => publish(true)} isLoading={publishing} className="gap-2 shadow-lg shadow-red-200">
                  {!publishing && <Send className="w-4 h-4" />}
                  {publishing ? 'Submitting...' : 'Publish Advertisement'}
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 justify-center pb-4">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <p className="text-xs text-slate-400">Your personal details stay private on FindIt.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function PostAdPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <p className="text-sm font-medium text-slate-400">Loading wizard...</p>
        </div>
      }
    >
      <WizardContent />
    </Suspense>
  );
}