import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface InputFieldProps {
  icon: string;
  iconColor?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showToggle?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  icon,
  iconColor = '#4CAF50',
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  showToggle = false,
}) => {
  const [isVisible, setIsVisible] = useState(!secureTextEntry);

  return (
    <View style={styles.inputContainer}>
      <View style={styles.inputIconContainer}>
        <FontAwesome5 name={icon} size={18} color={iconColor} />
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !isVisible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor="#999"
      />
      {showToggle && secureTextEntry && (
        <TouchableOpacity onPress={() => setIsVisible(!isVisible)} style={styles.toggleContainer}>
          <FontAwesome5 name={isVisible ? 'eye-slash' : 'eye'} size={18} color="#666" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 50,
  },
  inputIconContainer: {
    width: 30,
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  toggleContainer: {
    padding: 8,
  },
});
