import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

/**
 * 画面上部に表示するエラーバナー。
 * dismiss ボタン付き。
 */
export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={8} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: '#dc2626',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
});
