import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

import { color, font } from "@/theme/tokens";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return <MaterialCommunityIcons name={name} size={22} color={focused ? color.bone : color.ash} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.bone,
        tabBarInactiveTintColor: color.ash,
        tabBarStyle: {
          backgroundColor: color.void,
          borderTopColor: color.line,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: font.mono,
          fontSize: 10,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <TabIcon name="clock-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ focused }) => <TabIcon name="chat-outline" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          tabBarIcon: ({ focused }) => <TabIcon name="line-scan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="lift"
        options={{
          title: "Lift",
          tabBarIcon: ({ focused }) => <TabIcon name="dumbbell" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "Log",
          tabBarIcon: ({ focused }) => <TabIcon name="format-list-bulleted" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
