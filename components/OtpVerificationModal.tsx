import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface OtpVerificationModalProps {
  visible: boolean;
  phoneNumber: string;
  onClose: () => void;
  onVerify: (otp: string) => Promise<boolean>;
  onVerified?: () => void;
  onResend: () => Promise<boolean>;
  expiresAt: number;
  resendEnabled?: boolean;
}

export const OtpVerificationModal: React.FC<OtpVerificationModalProps> = ({
  visible,
  phoneNumber,
  onClose,
  onVerify,
  onVerified,
  onResend,
  expiresAt,
  resendEnabled = true,
}) => {
  const [otp, setOtp] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setOtp('');
      setAttempts(0);
      // Focus input after modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, expiresAt]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

const handleVerify = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit OTP');
      return;
    }

    const isValid = await onVerify(otp);

    if (isValid) {
      Alert.alert('Success', 'Phone number verified successfully!');
      // Call the onVerified callback if provided
      if (onVerified) {
        onVerified();
      }
      onClose();
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= 2) {
        Alert.alert('Too Many Attempts', 'Please request a new OTP');
      } else {
        Alert.alert('Invalid OTP', 'The code you entered is incorrect. Please try again.');
      }
      setOtp('');
    }
  };

const handleResend = async () => {
    await onResend();
    setOtp('');
    setAttempts(0);
    Alert.alert('OTP Resent', `A new OTP has been sent to ${phoneNumber}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Verify Your Phone</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Phone Icon */}
          <View style={styles.iconContainer}>
            <FontAwesome5 name="mobile-alt" size={50} color="#4CAF50" />
          </View>

{/* Instructions */}
          <Text style={styles.instructions}>
            We&apos;ve sent a 6-digit verification code to
          </Text>
          <Text style={styles.phoneNumber}>{phoneNumber}</Text>

          {/* OTP Input */}
          <TextInput
            ref={inputRef}
            style={styles.otpInput}
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="------"
            placeholderTextColor="#ccc"
            textAlign="center"
          />

          {/* Timer */}
          <Text style={[styles.timer, timeLeft < 60 && styles.timerWarning]}>
            Code expires in: {formatTime(timeLeft)}
          </Text>

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyButton, otp.length !== 6 && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={otp.length !== 6 || timeLeft === 0}
          >
            <Text style={styles.verifyButtonText}>Verify</Text>
          </TouchableOpacity>

{/* Resend Section */}
          {resendEnabled && (
            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Attempts Warning */}
          {attempts > 0 && (
            <Text style={styles.attemptsText}>
              Attempt {attempts} of 3
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: '600',
    color: '#333',
    letterSpacing: 12,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    marginBottom: 16,
  },
  timer: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  timerWarning: {
    color: '#FF5722',
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#666',
  },
  resendLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  attemptsText: {
    fontSize: 12,
    color: '#FF5722',
    textAlign: 'center',
    marginTop: 12,
  },
});
