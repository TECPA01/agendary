import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StepIndicatorProps {
  current: number; // 1-indexed
  total: number;
}

export function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isDone = step < current;
        const isCurrent = step === current;

        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <View style={[styles.line, isDone && styles.lineDone]} />
            )}
            <View
              style={[
                styles.dot,
                isCurrent && styles.dotCurrent,
                isDone && styles.dotDone,
              ]}
            >
              {isDone ? (
                <Text style={styles.check}>✓</Text>
              ) : (
                <Text style={[styles.num, isCurrent && styles.numCurrent]}>
                  {step}
                </Text>
              )}
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCurrent: {
    backgroundColor: '#7c3aed',
  },
  dotDone: {
    backgroundColor: '#7c3aed',
  },
  num: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  numCurrent: {
    color: '#fff',
  },
  check: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  lineDone: {
    backgroundColor: '#7c3aed',
  },
});
