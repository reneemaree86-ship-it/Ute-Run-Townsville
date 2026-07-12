import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "./ui";
import { colors, spacing, radius } from "@/src/theme";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App crash caught by ErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="warning-outline" size={40} color={colors.error} />
            </View>
            <Txt variant="h2" style={{ marginTop: spacing.md, textAlign: "center" }}>
              Something went wrong
            </Txt>
            <Txt variant="sub" style={{ marginTop: spacing.sm, textAlign: "center" }}>
              The app hit an unexpected error. You can try again or restart the app.
            </Txt>
            {this.state.error && (
              <ScrollView style={styles.errorBox} horizontal={false}>
                <Txt variant="caption" color={colors.muted} style={{ fontFamily: "monospace" }}>
                  {this.state.error.message}
                </Txt>
              </ScrollView>
            )}
            <Pressable style={styles.button} onPress={this.handleReset} testID="error-retry">
              <Txt variant="bodyBold" color="#fff">Try Again</Txt>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    width: "100%",
    maxWidth: 400,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.error + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    maxHeight: 120,
    width: "100%",
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
});
