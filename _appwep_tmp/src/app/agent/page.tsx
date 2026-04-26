'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  fetchAgentInfo, fetchAgentPlans, fetchAgentCodes,
  createActivationCodes, SubscriptionPlan, AgentStats,
} from '@/constants/api';

interface AgentCode {
  id: string;
  code: string;
  status: string;
  max_connections: number;
  plan_name: string;
  duration_days: number;
  plan_max_connections: number;
  activated_by_username?: string;
  created_at: string;
  activated_at?: string;
}

export default function AgentPage() {
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [codes, setCodes] = useState<AgentCode[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [createdCodes, setCreatedCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [tab, setTab] = useState<'create' | 'codes'>('create');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [info, plansData, codesData] = await Promise.all([
        fetchAgentInfo(),
        fetchAgentPlans(),
        fetchAgentCodes({ limit: 100 }),
      ]);
      if (info) {
        setStats(info.stats);
        setBalance(info.agent?.balance || 0);
      }
      setPlans(plansData);
      setCodes(codesData.codes || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) { setError('اختر خطة الاشتراك'); return; }
    setError(''); setSuccess(''); setCreating(true); setCreatedCodes([]);
    try {
      const res = await createActivationCodes(selectedPlan, quantity);
      setCreatedCodes(res.codes.map((c: any) => c.code));
      setSuccess(`تم إنشاء ${res.codes.length} كود بنجاح — التكلفة: $${res.cost.toFixed(2)}`);
      setBalance(res.remaining_balance);
      await loadData();
    } catch (err: any) { setError(err.message); }
    finally { setCreating(false); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  };

  const copyAllCodes = () => {
    navigator.clipboard.writeText(createdCodes.join('\n'));
    setCopied('all');
    setTimeout(() => setCopied(''), 2000);
  };

  const plan = plans.find(p => p.id === selectedPlan);
  const totalCost = plan ? plan.price_usd * quantity : 0;

  const filteredCodes = codes.filter(c =>
    (!codeFilter || c.status === codeFilter)
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || (user.role !== 'agent' && user.role !== 'admin' && !user.is_admin)) {
    return (
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center gap-4 px-4">
        <svg className="w-14 h-14 text-red-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-lg font-bold text-light-text dark:text-dark-text">لوحة الوكيل</h2>
        <p className="text-sm text-light-muted dark:text-dark-muted text-center">هذه الصفحة مخصصة للوكلاء فقط</p>
        <Link href="/account" className="px-6 py-2.5 rounded-xl bg-brand-primary text-black font-bold text-sm">
          تسجيل الدخول
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-light-text dark:text-dark-text">لوحة الوكيل</h1>
            <p className="text-sm text-light-muted dark:text-dark-muted">مرحباً {user.display_name || user.username}</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/10 border border-emerald-500/30 rounded-2xl px-5 py-3 text-center">
            <p className="text-xs text-emerald-400/80">الرصيد</p>
            <p className="text-lg font-black text-emerald-400">${balance.toFixed(2)}</p>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'إجمالي الأكواد', value: stats.totalCodes, color: 'text-blue-400' },
              { label: 'مستخدمة', value: stats.usedCodes, color: 'text-amber-400' },
              { label: 'متاحة', value: stats.unusedCodes, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-light-card dark:bg-dark-card rounded-xl p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-light-muted dark:text-dark-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'create' as const, label: 'إنشاء أكواد' },
            { id: 'codes' as const, label: 'الأكواد' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
                tab === t.id
                  ? 'bg-brand-primary text-black'
                  : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted hover:text-light-text dark:hover:text-dark-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Create Tab */}
        {tab === 'create' && (
          <div className="space-y-4">
            {/* Plan Selection */}
            <div className="bg-light-card dark:bg-dark-card rounded-2xl p-5">
              <h3 className="font-bold text-light-text dark:text-dark-text mb-4">اختر خطة الاشتراك</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {plans.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`relative rounded-xl p-4 text-right transition border-2 ${
                      selectedPlan === p.id
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-transparent bg-light-input dark:bg-dark-input hover:border-brand-primary/30'
                    }`}
                  >
                    {selectedPlan === p.id && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <p className="font-bold text-light-text dark:text-dark-text text-sm">{p.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold">
                        {p.duration_days} يوم
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-bold">
                        {p.max_connections} {p.max_connections === 1 ? 'جهاز' : p.max_connections === 2 ? 'جهازين' : 'أجهزة'}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-black text-brand-primary">${p.price_usd.toFixed(2)}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + Create */}
            <div className="bg-light-card dark:bg-dark-card rounded-2xl p-5">
              <h3 className="font-bold text-light-text dark:text-dark-text mb-3">عدد الأكواد</h3>
              <form onSubmit={handleCreate}>
                <div className="flex items-center gap-3 mb-4">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text font-bold text-lg flex items-center justify-center hover:bg-brand-primary/20 transition">−</button>
                  <input
                    type="number" min={1} max={50} value={quantity}
                    onChange={e => setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text rounded-xl py-2 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
                  />
                  <button type="button" onClick={() => setQuantity(Math.min(50, quantity + 1))} className="w-10 h-10 rounded-xl bg-light-input dark:bg-dark-input text-light-text dark:text-dark-text font-bold text-lg flex items-center justify-center hover:bg-brand-primary/20 transition">+</button>
                </div>

                {plan && (
                  <div className="bg-light-input dark:bg-dark-input rounded-xl p-3 mb-4 space-y-1 text-sm">
                    <div className="flex justify-between text-light-muted dark:text-dark-muted">
                      <span>الخطة</span>
                      <span className="font-bold text-light-text dark:text-dark-text">{plan.name}</span>
                    </div>
                    <div className="flex justify-between text-light-muted dark:text-dark-muted">
                      <span>الاتصالات</span>
                      <span className="font-bold text-purple-400">{plan.max_connections} {plan.max_connections === 1 ? 'جهاز' : plan.max_connections === 2 ? 'جهازين' : 'أجهزة'}</span>
                    </div>
                    <div className="flex justify-between text-light-muted dark:text-dark-muted">
                      <span>سعر الكود</span>
                      <span className="font-bold text-light-text dark:text-dark-text">${plan.price_usd.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-light-muted dark:text-dark-muted">
                      <span>العدد</span>
                      <span className="font-bold text-light-text dark:text-dark-text">×{quantity}</span>
                    </div>
                    <hr className="border-light-muted/20 dark:border-dark-muted/20" />
                    <div className="flex justify-between font-bold">
                      <span className="text-light-text dark:text-dark-text">الإجمالي</span>
                      <span className="text-brand-primary text-base">${totalCost.toFixed(2)}</span>
                    </div>
                    {totalCost > balance && (
                      <p className="text-xs text-red-400 text-center mt-1">رصيدك غير كافٍ</p>
                    )}
                  </div>
                )}

                {success && (
                  <div className="mb-3 p-3 rounded-xl bg-brand-success/10 border border-brand-success/20 text-brand-success text-sm text-center font-medium">
                    {success}
                  </div>
                )}
                {error && (
                  <div className="mb-3 p-3 rounded-xl bg-brand-error/10 border border-brand-error/20 text-brand-error text-sm text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creating || !selectedPlan || totalCost > balance}
                  className="w-full py-3 rounded-xl bg-brand-primary hover:bg-brand-dark text-black font-bold text-sm transition disabled:opacity-50"
                >
                  {creating ? 'جارٍ الإنشاء...' : `إنشاء ${quantity} كود — $${totalCost.toFixed(2)}`}
                </button>
              </form>
            </div>

            {/* Created Codes */}
            {createdCodes.length > 0 && (
              <div className="bg-light-card dark:bg-dark-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-light-text dark:text-dark-text">الأكواد المُنشأة</h3>
                  <button onClick={copyAllCodes} className="text-xs px-3 py-1.5 rounded-lg bg-brand-primary/20 text-brand-primary font-bold hover:bg-brand-primary/30 transition">
                    {copied === 'all' ? 'تم النسخ ✓' : 'نسخ الكل'}
                  </button>
                </div>
                <div className="space-y-2">
                  {createdCodes.map(code => (
                    <div key={code} className="flex items-center justify-between bg-light-input dark:bg-dark-input rounded-xl px-4 py-2.5">
                      <code className="font-mono font-bold text-sm text-brand-primary tracking-wider" dir="ltr">{code}</code>
                      <button onClick={() => copyCode(code)} className="text-xs text-light-muted dark:text-dark-muted hover:text-brand-primary transition">
                        {copied === code ? '✓' : 'نسخ'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Codes Tab */}
        {tab === 'codes' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {[
                { id: '', label: 'الكل' },
                { id: 'unused', label: 'متاحة' },
                { id: 'used', label: 'مستخدمة' },
                { id: 'expired', label: 'منتهية' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setCodeFilter(f.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    codeFilter === f.id
                      ? 'bg-brand-primary text-black'
                      : 'bg-light-card dark:bg-dark-card text-light-muted dark:text-dark-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Codes List */}
            {filteredCodes.length === 0 ? (
              <div className="text-center py-10 text-light-muted dark:text-dark-muted text-sm">
                لا توجد أكواد
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCodes.map(c => (
                  <div key={c.id} className="bg-light-card dark:bg-dark-card rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <code className="font-mono font-bold text-sm text-brand-primary tracking-wider" dir="ltr">{c.code}</code>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        c.status === 'unused' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.status === 'used' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {c.status === 'unused' ? 'متاح' : c.status === 'used' ? 'مستخدم' : 'منتهي'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-light-muted dark:text-dark-muted">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">{c.plan_name}</span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400">{c.max_connections || c.plan_max_connections} اتصال</span>
                      <span>{new Date(c.created_at).toLocaleDateString('ar-SA')}</span>
                      {c.activated_by_username && (
                        <span className="text-amber-400">← {c.activated_by_username}</span>
                      )}
                    </div>
                    {c.status === 'unused' && (
                      <button
                        onClick={() => copyCode(c.code)}
                        className="mt-2 text-xs px-3 py-1 rounded-lg bg-brand-primary/10 text-brand-primary font-bold hover:bg-brand-primary/20 transition"
                      >
                        {copied === c.code ? 'تم النسخ ✓' : 'نسخ الكود'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
