import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View } from "react-native";
import { colors, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function TabsLayout() {
  const { user } = useAuth();
  const isDriver = user?.active_role === "driver";

  const icon =
    (name: keyof typeof Ionicons.glyphMap, focused: boolean, color: string) => (
      <Ionicons name={focused ? name : (`${name}-outline` as any)} size={24} color={color} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 86 : 66,
          paddingTop: 8,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
        },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isDriver ? "Find Jobs" : "Home",
          tabBarIcon: ({ focused, color }) => icon(isDriver ? "map" : "home", focused, color),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: isDriver ? "My Runs" : "My Jobs",
          tabBarIcon: ({ focused, color }) => icon("briefcase", focused, color),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Chat",
          tabBarIcon: ({ focused, color }) => icon("chatbubble", focused, color),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: isDriver ? "Earnings" : "Payments",
          tabBarIcon: ({ focused, color }) => icon(isDriver ? "wallet" : "card", focused, color),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, color }) => icon("person", focused, color),
        }}
      />
    </Tabs>
  );
}
