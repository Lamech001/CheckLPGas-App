import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface InputFieldProps {
  icon: string;
  iconColor?: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  showToggle?: boolean;
  error?: string;
  helperText?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  icon,
  iconColor = '#4CAF50',
  placeholder,
  value,
  onChangeText,
  onBlur,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  showToggle = false,
  error,
  helperText,
}) => {
  const [isVisible, setIsVisible] = useState(!secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return '#f44336';
    if (isFocused) return iconColor;
    return '#E0E0E0';
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputContainer, { borderColor: getBorderColor() }]}>
        <View style={styles.inputIconContainer}>
          <FontAwesome5 
            name={icon} 
            size={18} 
            color={error ? '#f44336' : iconColor} 
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          onFocus={() => setIsFocused(true)}
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
        {error && (
          <FontAwesome5 name="exclamation-circle" size={16} color="#f44336" style={styles.errorIcon} />
        )}
      </View>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      {!error && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIconContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 8,
  },
  toggleContainer: {
    padding: 8,
  },
  errorIcon: {
    marginLeft: 8,
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 40,
    marginBottom: 8,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 40,
    marginBottom: 8,
  },
});
