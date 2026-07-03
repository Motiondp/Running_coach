import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

import { color } from "@/theme/tokens";

// Web-first: load the Crucible typefaces from Google Fonts and paint the page void.
// (Native will switch to @expo-google-fonts when we turn on iOS.)
if (Platform.OS === "web" && typeof document !== "undefined") {
  const id = "crucible-fonts";
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Expanded:wght@600;700;800&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
  }
  document.body.style.backgroundColor = color.void;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.void },
        }}
      >
        <Stack.Screen name="checkin" options={{ presentation: "modal" }} />
        <Stack.Screen name="plan-edit" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
