import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StatusBar as RNStatusBar } from "react-native";
interface AppStatusBarProps {
  backgroundColor?: string;
  /** @deprecated Always uses dark-content (dark icons) app-wide */
  barStyle?: "default" | "light-content" | "dark-content";
  navBarButtonColor?: "light" | "dark";
}

/** Status bar with dark system icons (battery, time, signal) on every screen. */
export const AppStatusBar: React.FC<AppStatusBarProps> = ({
  backgroundColor = "#FFFFFF",
}) => {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    RNStatusBar.setBarStyle("dark-content", true);
    RNStatusBar.setBackgroundColor(backgroundColor, true);
    RNStatusBar.setTranslucent(false);
    // Some SDK versions don't expose setButtonStyleAsync; avoid crashing + satisfy lint.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NavigationBar = require("expo-navigation-bar");
      if (typeof NavigationBar?.setButtonStyleAsync === "function") {
        NavigationBar.setButtonStyleAsync("dark").catch(() => {});
      }
    } catch {
      // NavigationBar not available on this platform
    }
  }, [backgroundColor]);

  return <StatusBar style="dark" />;
};
