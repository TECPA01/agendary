import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { signInWithEmail, signUpWithEmail } from '@/lib/auth';

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------

export default function AuthScreen() {
  const [mode, setMode]         = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const isSignIn = mode === 'signin';

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim()) { setError('メールアドレスを入力してください'); return; }
    if (!password)     { setError('パスワードを入力してください'); return; }
    if (!isSignIn && password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = isSignIn
        ? await signInWithEmail(email.trim(), password)
        : await signUpWithEmail(email.trim(), password);

      if (authError) {
        setError(localizeAuthError(authError.message));
        return;
      }

      // サインアップ成功: メール確認が必要なケース
      if (!isSignIn) {
        Alert.alert(
          '確認メールを送信しました',
          `${email.trim()} に確認メールを送りました。メール内のリンクをタップしてアカウントを有効化してください。`,
          [{ text: 'OK', onPress: () => setMode('signin') }],
        );
      }
      // サインイン成功: _layout.tsx の onAuthStateChange が自動遷移
    } catch (e) {
      setError('予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    Alert.alert('準備中', 'Apple でサインイン機能は近日対応予定です');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── ロゴ・タイトル ── */}
        <View style={styles.header}>
          <Text style={styles.logo}>📋</Text>
          <Text style={styles.appName}>AGENDARY</Text>
          <Text style={styles.tagline}>学習PDCAを習慣に</Text>
        </View>

        {/* ── タブ切替 ── */}
        <View style={styles.modeTabs}>
          <TouchableOpacity
            style={[styles.modeTab, isSignIn && styles.modeTabActive]}
            onPress={() => { setMode('signin'); setError(null); }}
          >
            <Text style={[styles.modeTabText, isSignIn && styles.modeTabTextActive]}>
              ログイン
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, !isSignIn && styles.modeTabActive]}
            onPress={() => { setMode('signup'); setError(null); }}
          >
            <Text style={[styles.modeTabText, !isSignIn && styles.modeTabTextActive]}>
              新規登録
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── フォーム ── */}
        <View style={styles.form}>
          {/* エラーバナー */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>メールアドレス</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(t) => { setEmail(t); setError(null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              placeholder="example@mail.com"
              placeholderTextColor="#94a3b8"
              returnKeyType="next"
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>パスワード{!isSignIn && '（6文字以上）'}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              secureTextEntry
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
          </View>

          {/* 送信ボタン */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {isSignIn ? 'ログイン' : 'アカウント作成'}
              </Text>
            )}
          </TouchableOpacity>

          {/* 区切り線 */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Apple サインイン */}
          <TouchableOpacity
            style={styles.appleBtn}
            onPress={handleAppleSignIn}
            activeOpacity={0.85}
          >
            <Text style={styles.appleBtnIcon}></Text>
            <Text style={styles.appleBtnText}>Apple でサインイン</Text>
          </TouchableOpacity>
        </View>

        {/* ── フッター ── */}
        <Text style={styles.footer}>
          {isSignIn ? 'アカウントをお持ちでない方は ' : 'すでにアカウントをお持ちの方は '}
          <Text
            style={styles.footerLink}
            onPress={() => { setMode(isSignIn ? 'signup' : 'signin'); setError(null); }}
          >
            {isSignIn ? '新規登録' : 'ログイン'}
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// エラーメッセージのローカライズ
// ---------------------------------------------------------------------------

function localizeAuthError(message: string): string {
  if (message.includes('Invalid login credentials'))   return 'メールアドレスまたはパスワードが違います';
  if (message.includes('Email not confirmed'))         return 'メールアドレスの確認が完了していません';
  if (message.includes('User already registered'))     return 'このメールアドレスはすでに登録済みです';
  if (message.includes('Password should be at least')) return 'パスワードは6文字以上で入力してください';
  if (message.includes('rate limit'))                  return 'しばらく時間をおいてから再試行してください';
  if (message.includes('network'))                     return 'ネットワークエラーが発生しました';
  return message;
}

// ---------------------------------------------------------------------------
// スタイル
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 48,
  },

  // ヘッダー
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 48,
    marginBottom: 12,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },

  // タブ切替
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  modeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  modeTabTextActive: {
    color: '#0f172a',
  },

  // フォーム
  form: {
    gap: 16,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 18,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },

  // 送信ボタン
  submitBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#a78bfa',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  // 区切り線
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#cbd5e1',
  },
  dividerLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },

  // Apple サインイン
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    paddingVertical: 17,
  },
  appleBtnIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  appleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.2,
  },

  // フッター
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748b',
    marginTop: 32,
  },
  footerLink: {
    color: '#7c3aed',
    fontWeight: '600',
  },
});
