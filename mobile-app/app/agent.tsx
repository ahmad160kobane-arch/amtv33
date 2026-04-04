import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, TextInput, RefreshControl, Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowBackIcon, ShieldIcon, InfoIcon, WalletIcon, KeyIcon, CheckCircleIcon,
  ClockIcon, TagIcon, GridIcon, PlusIcon, ListIcon, ReceiptIcon, CopyIcon,
  MinusIcon, CloseCircleIcon, ArrowDownCircleIcon, ArrowUpCircleIcon,
} from '@/components/AppIcons';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import Colors from '@/constants/Colors';
import {
  fetchAgentInfo, fetchAgentPlans, fetchAgentCodes, createActivationCodes, cancelActivationCode,
  fetchAgentTransactions,
  AgentInfo, SubscriptionPlan, ActivationCode, AgentTransaction,
} from '@/constants/Api';

type Tab = 'dashboard' | 'create' | 'codes' | 'transactions';
type FilterStatus = 'all' | 'unused' | 'used' | 'cancelled';

export default function AgentScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [totalCodes, setTotalCodes] = useState(0);

  // Create code state
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [creating, setCreating] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ id: string; code: string }[]>([]);

  // Codes filter
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Transactions
  const [transactions, setTransactions] = useState<AgentTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);

  const loadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [agentInfo, agentPlans] = await Promise.all([
        fetchAgentInfo(),
        fetchAgentPlans(),
      ]);
      setInfo(agentInfo);
      setPlans(agentPlans);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadCodes = useCallback(async () => {
    const status = filterStatus === 'all' ? undefined : filterStatus;
    const result = await fetchAgentCodes({ status, limit: 50 });
    setCodes(result.codes);
    setTotalCodes(result.total);
  }, [filterStatus]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    const result = await fetchAgentTransactions({ limit: 50 });
    setTransactions(result.transactions);
    setTxTotal(result.total);
    setTxLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (tab === 'codes') loadCodes(); }, [tab, loadCodes]);
  useEffect(() => { if (tab === 'transactions') loadTransactions(); }, [tab, loadTransactions]);

  const handleCreateCode = async () => {
    if (!selectedPlan) return Alert.alert('خطأ', 'اختر خطة الاشتراك أولاً');
    const qty = parseInt(quantity) || 1;
    if (qty < 1 || qty > 50) return Alert.alert('خطأ', 'الكمية يجب أن تكون بين 1 و 50');

    const plan = plans.find(p => p.id === selectedPlan);
    const cost = (plan?.price_usd || 0) * qty;
    const balance = info?.agent.balance || 0;

    if (cost > balance) {
      return Alert.alert('رصيد غير كافٍ', `المطلوب: $${cost.toFixed(2)} | رصيدك: $${balance.toFixed(2)}`);
    }

    Alert.alert(
      'تأكيد الإنشاء',
      `إنشاء ${qty} كود ${plan?.name} بتكلفة $${cost.toFixed(2)}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إنشاء', onPress: async () => {
            setCreating(true);
            try {
              const result = await createActivationCodes(selectedPlan, qty);
              setLastCreated(result.codes);
              setInfo(prev => prev ? {
                ...prev,
                agent: { ...prev.agent, balance: result.remaining_balance },
                stats: { ...prev.stats, totalCodes: prev.stats.totalCodes + qty, unusedCodes: prev.stats.unusedCodes + qty },
              } : prev);
              Alert.alert('تم! ✅', `تم إنشاء ${result.codes.length} كود ${result.plan.name} بنجاح`);
            } catch (e: any) {
              Alert.alert('خطأ', e.message);
            } finally {
              setCreating(false);
            }
          },
        },
      ]
    );
  };

  const handleCopy = (code: string) => {
    Clipboard.setString(code);
    Alert.alert('تم النسخ', `تم نسخ الكود: ${code}`);
  };

  const handleCancelCode = (codeId: string, codeText: string) => {
    Alert.alert('إلغاء الكود', `هل تريد إلغاء الكود وإعادة الرصيد؟\n${codeText}`, [
      { text: 'لا', style: 'cancel' },
      {
        text: 'نعم، إلغاء', style: 'destructive', onPress: async () => {
          try {
            const result = await cancelActivationCode(codeId);
            Alert.alert('تم الإلغاء', `تم استرجاع $${result.refunded.toFixed(2)} لرصيدك`);
            loadCodes();
            loadData();
          } catch (e: any) {
            Alert.alert('خطأ', e.message);
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unused': return '#22C55E';
      case 'used': return Colors.brand.primary;
      case 'cancelled': return '#EF4444';
      default: return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'unused': return 'غير مستخدم';
      case 'used': return 'مستخدم';
      case 'cancelled': return 'ملغى';
      default: return status;
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.brand.primary} />
      </View>
    );
  }

  if (!info) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowBackIcon size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>لوحة الوكيل</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <InfoIcon size={56} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>غير مصرح لك بالوصول</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowBackIcon size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>لوحة الوكيل</Text>
        <View style={[styles.agentBadge]}>
          <ShieldIcon size={14} color={Colors.brand.primary} />
          <Text style={[styles.agentBadgeText, { color: Colors.brand.primary }]}>وكيل</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.cardBackground }]}>
        {([
          { key: 'dashboard', label: 'الرئيسية', iconKey: 'grid' },
          { key: 'create', label: 'إنشاء كود', iconKey: 'plus' },
          { key: 'codes', label: 'الكودات', iconKey: 'list' },
          { key: 'transactions', label: 'المعاملات', iconKey: 'receipt' },
        ] as { key: Tab; label: string; iconKey: string }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: Colors.brand.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
          >
            {t.iconKey === 'grid' ? <GridIcon size={18} color={tab === t.key ? Colors.brand.primary : colors.textSecondary} /> : t.iconKey === 'plus' ? <PlusIcon size={18} color={tab === t.key ? Colors.brand.primary : colors.textSecondary} /> : t.iconKey === 'list' ? <ListIcon size={18} color={tab === t.key ? Colors.brand.primary : colors.textSecondary} /> : <ReceiptIcon size={18} color={tab === t.key ? Colors.brand.primary : colors.textSecondary} />}
            <Text style={[styles.tabLabel, { color: tab === t.key ? Colors.brand.primary : colors.textSecondary }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={Colors.brand.primary} />}
        contentContainerStyle={styles.scroll}
      >
        {/* ═══ TAB: Dashboard ═══ */}
        {tab === 'dashboard' && (
          <>
            {/* بطاقة الرصيد */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceTop}>
                <WalletIcon size={22} color="#FFD700" />
                <Text style={styles.balanceLabel}>رصيدك الحالي</Text>
              </View>
              <Text style={styles.balanceAmount}>${(info.agent.balance || 0).toFixed(2)}</Text>
              <Text style={styles.balanceSub}>دولار أمريكي</Text>
            </View>

            {/* إحصائيات */}
            <View style={styles.statsRow}>
              {[
                { label: 'إجمالي الكودات', value: info.stats.totalCodes, color: Colors.brand.primary, iconKey: 'key' },
                { label: 'مستخدم', value: info.stats.usedCodes, color: '#22C55E', iconKey: 'check' },
                { label: 'غير مستخدم', value: info.stats.unusedCodes, color: '#F59E0B', iconKey: 'clock' },
              ].map(s => (
                <View key={s.label} style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
                  {s.iconKey === 'key' ? <KeyIcon size={20} color={s.color} /> : s.iconKey === 'check' ? <CheckCircleIcon size={20} color={s.color} /> : <ClockIcon size={20} color={s.color} />}
                  <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* أسعار الخطط */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>أسعار الكودات</Text>
            {plans.map(p => (
              <View key={p.id} style={[styles.priceRow, { backgroundColor: colors.cardBackground }]}>
                <View style={[styles.planDot, { backgroundColor: Colors.brand.primary + '33' }]}>
                  <TagIcon size={18} color={Colors.brand.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planRowName, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[styles.planRowDays, { color: colors.textSecondary }]}>{p.duration_days} يوماً</Text>
                </View>
                <Text style={[styles.planRowPrice, { color: Colors.brand.primary }]}>${p.price_usd.toFixed(2)}/كود</Text>
              </View>
            ))}

            <View style={[styles.noticeCard, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
              <InfoIcon size={18} color={Colors.brand.primary} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                يُخصم سعر الكود من رصيدك عند الإنشاء. يمكن إلغاء الكودات غير المستخدمة واسترجاع الرصيد.
              </Text>
            </View>
          </>
        )}

        {/* ═══ TAB: Create Code ═══ */}
        {tab === 'create' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>اختر خطة الاشتراك</Text>
            {plans.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.planSelectCard,
                  { backgroundColor: colors.cardBackground },
                  selectedPlan === p.id && { borderColor: Colors.brand.primary, borderWidth: 2 },
                ]}
                onPress={() => setSelectedPlan(p.id)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planSelectName, { color: colors.text }]}>{p.name}</Text>
                  <Text style={[styles.planSelectDays, { color: colors.textSecondary }]}>{p.duration_days} يوماً لكل كود</Text>
                </View>
                <Text style={[styles.planSelectPrice, { color: Colors.brand.primary }]}>${p.price_usd.toFixed(2)}</Text>
                {selectedPlan === p.id && (
                  <View style={styles.selectedCheck}>
                    <CheckCircleIcon size={22} color={Colors.brand.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>الكمية</Text>
            <View style={[styles.qtyRow, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity
                onPress={() => setQuantity(q => String(Math.max(1, parseInt(q || '1') - 1)))}
                style={styles.qtyBtn}
              >
                <MinusIcon size={22} color={colors.text} />
              </TouchableOpacity>
              <TextInput
                style={[styles.qtyInput, { color: colors.text }]}
                value={quantity}
                onChangeText={t => setQuantity(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity
                onPress={() => setQuantity(q => String(Math.min(50, parseInt(q || '1') + 1)))}
                style={styles.qtyBtn}
              >
                <PlusIcon size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* ملخص التكلفة */}
            {selectedPlan && (
              <View style={[styles.summaryCard, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>الخطة</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{plans.find(p => p.id === selectedPlan)?.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>الكمية</Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>{quantity}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>التكلفة الإجمالية</Text>
                  <Text style={[styles.summaryValue, { color: Colors.brand.primary }]}>
                    ${((plans.find(p => p.id === selectedPlan)?.price_usd || 0) * parseInt(quantity || '0')).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>رصيدك</Text>
                  <Text style={[styles.summaryValue, { color: '#22C55E' }]}>${(info.agent.balance || 0).toFixed(2)}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.createBtn, { opacity: creating || !selectedPlan ? 0.6 : 1 }]}
              onPress={handleCreateCode}
              disabled={creating || !selectedPlan}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <PlusIcon size={20} color="#fff" />
                  <Text style={styles.createBtnText}>إنشاء الكودات</Text>
                </>
              )}
            </TouchableOpacity>

            {/* آخر الكودات المنشأة */}
            {lastCreated.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>الكودات المنشأة حديثاً</Text>
                {lastCreated.map(c => (
                  <View key={c.id} style={[styles.newCodeRow, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.newCodeText, { color: Colors.brand.primary }]}>{c.code}</Text>
                    <TouchableOpacity onPress={() => handleCopy(c.code)} style={styles.copyBtn}>
                      <CopyIcon size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ═══ TAB: Transactions ═══ */}
        {tab === 'transactions' && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>سجل المعاملات ({txTotal})</Text>
            {txLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator size="large" color={Colors.brand.primary} />
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <ReceiptIcon size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد معاملات بعد</Text>
              </View>
            ) : transactions.map(tx => (
              <View key={tx.id} style={[styles.txCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.txRow}>
                  <View style={[styles.txIcon, { backgroundColor: tx.type === 'credit' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)' }]}>
                    {tx.type === 'credit' ? <ArrowDownCircleIcon size={20} color="#22C55E" /> : <ArrowUpCircleIcon size={20} color="#EF4444" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.txDesc, { color: colors.text }]} numberOfLines={1}>{tx.description}</Text>
                    <Text style={[styles.txDate, { color: colors.textSecondary }]}>{formatDate(tx.created_at)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: tx.type === 'credit' ? '#22C55E' : '#EF4444' }]}>
                      {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                    </Text>
                    <Text style={[styles.txBalance, { color: colors.textSecondary }]}>رصيد: ${tx.balance_after.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ═══ TAB: Codes List ═══ */}
        {tab === 'codes' && (
          <>
            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {(['all', 'unused', 'used', 'cancelled'] as FilterStatus[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterBtn,
                    { backgroundColor: filterStatus === f ? Colors.brand.primary : colors.cardBackground },
                  ]}
                  onPress={() => setFilterStatus(f)}
                >
                  <Text style={[styles.filterText, { color: filterStatus === f ? '#fff' : colors.textSecondary }]}>
                    {f === 'all' ? 'الكل' : getStatusLabel(f)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.codesCount, { color: colors.textSecondary }]}>{totalCodes} كود</Text>

            {codes.length === 0 ? (
              <View style={styles.emptyState}>
                <KeyIcon size={48} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>لا توجد كودات</Text>
              </View>
            ) : codes.map(c => (
              <View key={c.id} style={[styles.codeCard, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.codeCardTop}>
                  <TouchableOpacity onPress={() => handleCopy(c.code)} style={{ flex: 1 }}>
                    <Text style={[styles.codeCardText, { color: colors.text }]}>{c.code}</Text>
                  </TouchableOpacity>
                  <View style={[styles.statusPill, { backgroundColor: getStatusColor(c.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(c.status) }]}>{getStatusLabel(c.status)}</Text>
                  </View>
                </View>
                <View style={styles.codeCardMeta}>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                    {c.plan_name} · {c.duration_days} يوم
                  </Text>
                  <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDate(c.created_at)}</Text>
                </View>
                {c.activated_by_username && (
                  <Text style={[styles.metaText, { color: colors.textSecondary, marginTop: 2 }]}>
                    فُعّل بواسطة: {c.activated_by_username}
                    {c.activated_at ? ` • ${formatDate(c.activated_at)}` : ''}
                  </Text>
                )}
                {c.status === 'unused' && (
                  <View style={styles.codeActions}>
                    <TouchableOpacity onPress={() => handleCopy(c.code)} style={[styles.codeAction, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                      <CopyIcon size={15} color={Colors.brand.primary} />
                      <Text style={[styles.codeActionText, { color: Colors.brand.primary }]}>نسخ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleCancelCode(c.id, c.code)} style={[styles.codeAction, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                      <CloseCircleIcon size={15} color="#EF4444" />
                      <Text style={[styles.codeActionText, { color: '#EF4444' }]}>إلغاء</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: Colors.fonts.bold, fontSize: 18 },
  agentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  agentBadgeText: { fontFamily: Colors.fonts.bold, fontSize: 12 },
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, borderRadius: 14, marginBottom: 4,
  },
  tabItem: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
    flexDirection: 'column', gap: 2,
  },
  tabLabel: { fontFamily: Colors.fonts.medium, fontSize: 10 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 12, gap: 12 },
  balanceCard: {
    borderRadius: 18, padding: 22, alignItems: 'center',
    backgroundColor: '#6C3DE0', gap: 6,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { fontFamily: Colors.fonts.medium, color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  balanceAmount: { fontFamily: Colors.fonts.extraBold, color: '#FFD700', fontSize: 38 },
  balanceSub: { fontFamily: Colors.fonts.regular, color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontFamily: Colors.fonts.extraBold, fontSize: 24 },
  statLabel: { fontFamily: Colors.fonts.regular, fontSize: 10, textAlign: 'center' },
  sectionTitle: { fontFamily: Colors.fonts.bold, fontSize: 15 },
  priceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  planDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  planRowName: { fontFamily: Colors.fonts.bold, fontSize: 14 },
  planRowDays: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  planRowPrice: { fontFamily: Colors.fonts.extraBold, fontSize: 15 },
  noticeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, padding: 14,
  },
  noticeText: { fontFamily: Colors.fonts.regular, fontSize: 12, flex: 1, lineHeight: 18 },

  planSelectCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 14, padding: 16, borderWidth: 0,
  },
  planSelectName: { fontFamily: Colors.fonts.bold, fontSize: 15 },
  planSelectDays: { fontFamily: Colors.fonts.regular, fontSize: 12 },
  planSelectPrice: { fontFamily: Colors.fonts.extraBold, fontSize: 18 },
  selectedCheck: { position: 'absolute', top: 12, left: 12 },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    overflow: 'hidden',
  },
  qtyBtn: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  qtyInput: {
    flex: 1, fontFamily: Colors.fonts.extraBold, fontSize: 22,
    textAlign: 'center', paddingVertical: 12,
  },

  summaryCard: { borderRadius: 14, padding: 16, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: Colors.fonts.regular, fontSize: 13 },
  summaryValue: { fontFamily: Colors.fonts.bold, fontSize: 14 },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brand.primary, borderRadius: 14, paddingVertical: 16,
  },
  createBtnText: { fontFamily: Colors.fonts.bold, color: '#fff', fontSize: 16 },

  newCodeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, padding: 14,
  },
  newCodeText: { fontFamily: Colors.fonts.bold, fontSize: 15, letterSpacing: 1 },
  copyBtn: { padding: 8 },

  filterRow: { paddingBottom: 8, gap: 8 },
  filterBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  filterText: { fontFamily: Colors.fonts.medium, fontSize: 13 },
  codesCount: { fontFamily: Colors.fonts.regular, fontSize: 12 },

  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { fontFamily: Colors.fonts.medium, fontSize: 14 },

  codeCard: { borderRadius: 14, padding: 14, gap: 6 },
  codeCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  codeCardText: { fontFamily: Colors.fonts.bold, fontSize: 14, letterSpacing: 1 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: Colors.fonts.bold, fontSize: 11 },
  codeCardMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { fontFamily: Colors.fonts.regular, fontSize: 11 },
  codeActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  codeAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  codeActionText: { fontFamily: Colors.fonts.medium, fontSize: 12 },

  txCard: { borderRadius: 14, padding: 14 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontFamily: Colors.fonts.medium, fontSize: 13 },
  txDate: { fontFamily: Colors.fonts.regular, fontSize: 11, marginTop: 2 },
  txAmount: { fontFamily: Colors.fonts.extraBold, fontSize: 14 },
  txBalance: { fontFamily: Colors.fonts.regular, fontSize: 10, marginTop: 2 },
});
