import { FontAwesome5 } from "@expo/vector-icons";
import React from "react";
import { Switch, Text, View } from "react-native";

export type SettingItemProps = {
  icon: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  styles?: {
    settingItem: any;
    settingIconContainer: any;
    settingTextContainer: any;
    settingTitle: any;
    settingSubtitle: any;
  };
};

export const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  styles,
}) => {
  return (
    <View style={styles?.settingItem}>
      <View style={styles?.settingIconContainer}>
        <FontAwesome5 name={icon} size={20} color="#1976D2" />
      </View>

      <View style={styles?.settingTextContainer}>
        <Text style={styles?.settingTitle}>{title}</Text>
        {subtitle ? (
          <Text style={styles?.settingSubtitle}>{subtitle}</Text>
        ) : null}
      </View>

      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#767577", true: "#81b0ff" }}
        thumbColor={value ? "#1976D2" : "#f4f3f4"}
      />
    </View>
  );
};
