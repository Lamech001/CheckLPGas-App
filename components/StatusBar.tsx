import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBarProps {
  batteryLevel?: number;
  showNotifications?: boolean;
}

export const CustomStatusBar: React.FC<StatusBarProps> = ({ 
  batteryLevel = 85,
  showNotifications = true 
}) => {
  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <View style={styles.statusBar}>
      {/* Time */}
      <Text style={styles.timeText}>{currentTime}</Text>

      {/* Right side icons */}
      <View style={styles.rightIcons}>
        {/* Notifications */}
        {showNotifications && (
          <View style={styles.iconContainer}>
            <FontAwesome5 name="bell" size={12} color="#333" />
          </View>
        )}

        {/* Signal */}
        <View style={styles.iconContainer}>
          <FontAwesome5 name="signal" size={12} color="#333" />
        </View>

        {/* WiFi */}
        <View style={styles.iconContainer}>
          <FontAwesome5 name="wifi" size={12} color="#333" />
        </View>

        {/* Battery */}
        <View style={styles.batteryContainer}>
          <FontAwesome5 name="battery-three-quarters" size={14} color="#333" />
          <Text style={styles.batteryText}>{batteryLevel}%</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#2E7D32',
    height: 36,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  rightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginLeft: 8,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  batteryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 2,
  },
});
