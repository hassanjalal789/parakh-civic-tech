/**
 * Shared building blocks. Touch targets are at least 48dp, every control has
 * a screen-reader role and label, and state changes are announced (NFR-25).
 */
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useDirection } from "../i18n";

const colors = {
  ink: "#1b1b1b",
  muted: "#4a4a4a",
  brand: "#0b5d3b",
  danger: "#a4161a",
  line: "#c8c8c8",
  disabled: "#9a9a9a",
};

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView style={styles.safe} testID={testID}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { text } = useDirection();
  return (
    <Text accessibilityRole="header" style={[styles.title, text]}>
      {children}
    </Text>
  );
}

export function Body({ children }: { children: ReactNode }) {
  const { text } = useDirection();
  return <Text style={[styles.body, text]}>{children}</Text>;
}

/** An error or status line announced politely by screen readers. */
export function Notice({ children, kind = "error" }: { children: ReactNode; kind?: "error" | "info" }) {
  const { text } = useDirection();
  return (
    <Text
      accessibilityRole={kind === "error" ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[styles.body, text, kind === "error" ? styles.error : styles.info]}
    >
      {children}
    </Text>
  );
}

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const disabled = props.disabled || props.busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!disabled, busy: !!props.busy }}
      disabled={disabled}
      onPress={props.onPress}
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
    >
      <Text style={styles.buttonText}>{props.busy ? "…" : props.label}</Text>
    </Pressable>
  );
}

export function LinkButton(props: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={styles.link}
    >
      <Text style={[styles.linkText, props.disabled ? { color: colors.disabled } : null]}>{props.label}</Text>
    </Pressable>
  );
}

/** One separately labelled and announced choice — never a combined checkbox (FR-AUTH.3). */
export function Checkbox(props: {
  label: string;
  tag: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const { text, row } = useDirection();
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="checkbox"
      accessibilityLabel={`${props.tag}: ${props.label}`}
      accessibilityState={{ checked: props.checked }}
      onPress={() => props.onChange(!props.checked)}
      style={[styles.checkRow, row]}
    >
      <View style={[styles.box, props.checked ? styles.boxChecked : null]}>
        {props.checked ? <Text style={styles.tick}>✓</Text> : null}
      </View>
      <View style={styles.checkText}>
        <Text style={[styles.tag, text]}>{props.tag}</Text>
        <Text style={[styles.body, text]}>{props.label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 24, fontWeight: "700", color: colors.ink },
  body: { fontSize: 17, lineHeight: 26, color: colors.ink },
  error: { color: colors.danger },
  info: { color: colors.muted },
  button: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  buttonDisabled: { backgroundColor: colors.disabled },
  buttonText: { color: "#ffffff", fontSize: 18, fontWeight: "600" },
  link: { minHeight: 48, justifyContent: "center", alignItems: "center" },
  linkText: { color: colors.brand, fontSize: 17, textDecorationLine: "underline" },
  checkRow: { alignItems: "flex-start", gap: 12, paddingVertical: 8, minHeight: 48 },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  tick: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  checkText: { flex: 1, gap: 2 },
  tag: { fontSize: 14, fontWeight: "700", color: colors.muted },
});
